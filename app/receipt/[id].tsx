import SplitPeople from '@/components/chat/SplitPeople';
import { WithTopBar } from '@/components/nav/AppTabBar';
import { ClaimedBar, ClaimList, PeopleStatus, ShareCard } from '@/components/receipts/ClaimView';
import DraftEditor, { Draft, draftCheck, draftFrom } from '@/components/receipts/DraftEditor';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import IconButton from '@/components/ui/IconButton';
import ImageLightbox from '@/components/ui/ImageLightbox';
import TabScreen from '@/components/ui/TabScreen';
import TextField from '@/components/ui/TextField';
import { Fonts, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { canUseDemoReceipt, DEMO_RECEIPT } from '@/lib/demoReceipt';
import { haptics } from '@/lib/haptics';
import { freshChannel } from '@/lib/realtime';
import {
  billMoney, firstName, getReceipt, parseCents, Receipt, ReceiptLine, receiptPhotoUrl, saveDraft, scanReceipt, ScanResult,
} from '@/lib/receipts';
import { supabase } from '@/lib/supabase';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

/**
 * A bill split by what each person had (Phase 8.18; docs/PHASE8.md).
 * - draft (payer only): check the lines wya read from the photo, then send
 * - claiming (everyone going): tick what you had, confirm your share; the payer locks it
 * - locked: each share is a split debt, paid through the pay page like any other
 */
export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProblem, setScanProblem] = useState<Exclude<ScanResult, { ok: true }> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [lineEdit, setLineEdit] = useState<{ id: string | null; name: string; amount: string; kind: ReceiptLine['kind'] } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  // Where the draft's lines came from, saved with the bill
  const [source, setSource] = useState<'model' | 'demo' | 'manual' | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const scanStarted = useRef(false);

  usePageTitle(receipt?.description ?? 'Split the bill');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(receipt ? `/event/${receipt.event_id}?tab=bills` : '/(tabs)/home'));

  const load = useCallback(async () => {
    try {
      const r = await getReceipt(id);
      setReceipt(r);
      // The draft editor works on its own copy, refreshed only when the lines change underneath it (a scan)
      if (r?.status === 'draft') setDraft((d) => (d && d.lines.length > 0 ? d : draftFrom(r)));
    } catch {
      setReceipt(null);
    }
    setLoaded(true);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Ticks, confirmations and edits from other people's phones
  useEffect(() => {
    if (!receipt?.event_id || receipt.status === 'draft') return;
    const filter = `receipt_id=eq.${id}`;
    const channel = freshChannel(`receipt:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipt_claims', filter }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipt_confirmations', filter }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipt_items', filter }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'receipts', filter: `id=eq.${id}` }, () => load())
      // DELETEs can't be filtered (an unticked item); reloading is cheap
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'receipt_claims' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, receipt?.event_id, receipt?.status, load]);

  useEffect(() => {
    if (receipt?.image_path) receiptPhotoUrl(receipt.image_path).then(setPhoto);
  }, [receipt?.image_path]);

  // A fresh bill with a photo: read it straight away
  const runScan = useCallback(async () => {
    setScanning(true);
    setScanProblem(null);
    const result = await scanReceipt(id);
    setScanning(false);
    if (!result.ok) { setScanProblem(result); return; }
    haptics.success();
    setSource('model');
    const r = await getReceipt(id);
    setReceipt(r);
    if (r) setDraft(draftFrom(r));
  }, [id]);
  useEffect(() => {
    if (receipt?.status === 'draft' && receipt.is_payer && receipt.image_path && !receipt.scan_source && receipt.lines.length === 0 && !scanStarted.current) {
      scanStarted.current = true;
      runScan();
    }
  }, [receipt, runScan]);

  const fillDemo = () => {
    setScanProblem(null);
    setSource('demo');
    setDraft({
      description: DEMO_RECEIPT.description,
      lines: DEMO_RECEIPT.lines.map((l) => ({ ...l, key: Crypto.randomUUID() })),
      subtotal: (DEMO_RECEIPT.subtotalCents / 100).toFixed(2),
      total: (DEMO_RECEIPT.totalCents / 100).toFixed(2),
    });
  };
  const typeItIn = () => {
    setScanProblem(null);
    setSource('manual');
    setDraft((d) => d ?? (receipt ? draftFrom(receipt) : null));
  };

  const send = async () => {
    if (!receipt || !draft) return;
    const check = draftCheck(draft);
    if (!check.ok || check.total == null) return;
    setBusy('send');
    try {
      await saveDraft(receipt.id, draft.lines, check.total, check.subtotal, draft.description, source ?? receipt.scan_source ?? 'manual');
      const { error } = await supabase.rpc('send_receipt', { p_receipt_id: receipt.id });
      if (error) throw error;
      haptics.success();
      setDraft(null);
      await load();
    } catch (e: any) {
      showAlert(e?.hint === 'payid_required' ? 'Add your PayID first' : "Couldn't send it", e?.message ?? 'Try again');
    } finally {
      setBusy(null);
    }
  };

  // Ticking is instant on screen; the database has the final say (and the share)
  const toggle = async (line: ReceiptLine) => {
    if (!receipt || !user) return;
    const mineNow = receipt.lines.filter((l) => l.kind === 'item' && l.claimers.includes(user.id)).map((l) => l.id);
    const next = mineNow.includes(line.id) ? mineNow.filter((x) => x !== line.id) : [...mineNow, line.id];
    setReceipt({
      ...receipt,
      lines: receipt.lines.map((l) => (l.id !== line.id ? l : {
        ...l, claimers: l.claimers.includes(user.id) ? l.claimers.filter((c) => c !== user.id) : [...l.claimers, user.id],
      })),
    });
    const { error } = await supabase.rpc('set_receipt_claims', { p_receipt_id: receipt.id, p_item_ids: next });
    if (error) showAlert(error.hint === 'receipt_locked' ? 'This bill is locked' : "Couldn't save that", error.message);
    load();
  };

  const confirm = async (cents: number) => {
    setBusy('confirm');
    const { error } = await supabase.rpc('confirm_receipt_share', { p_receipt_id: id, p_expected_cents: cents });
    setBusy(null);
    if (error) showAlert(error.hint === 'share_changed' ? 'Your share just changed' : "Couldn't confirm", error.message);
    else haptics.success();
    load();
  };

  const payerCall = async (fn: 'lock_receipt' | 'unlock_receipt' | 'cancel_receipt', title: string) => {
    setBusy(fn);
    const { error } = await supabase.rpc(fn, { p_receipt_id: id });
    setBusy(null);
    if (error) { showAlert(title, error.message); return false; }
    haptics.success();
    load();
    return true;
  };

  const lock = () => payerCall('lock_receipt', "Couldn't lock it");
  const unlock = async () => {
    const ok = await confirmAction('Reopen the bill?', "Everyone's ticks stay. Anyone whose share changes confirms again.", 'Reopen');
    if (ok) payerCall('unlock_receipt', "Couldn't reopen it");
  };
  const cancel = async () => {
    const ok = await confirmAction('Cancel this bill?', receipt?.status === 'locked'
      ? 'Anything still owed is let off. People who already paid you keep that between you.'
      : 'Nobody will owe anything for it.', 'Cancel bill', true);
    if (!ok) return;
    if (await payerCall('cancel_receipt', "Couldn't cancel it") && receipt?.status === 'draft') goBack();
  };

  const saveLine = async (remove = false) => {
    if (!lineEdit) return;
    const cents = parseCents(lineEdit.amount);
    if (!remove && (!lineEdit.name.trim() || cents == null || (lineEdit.kind === 'item' && cents <= 0))) {
      showAlert('Almost', 'A line needs a name and an amount.');
      return;
    }
    setBusy('line');
    const { error } = await supabase.rpc('edit_receipt_item', {
      p_receipt_id: id, p_item_id: lineEdit.id, p_name: lineEdit.name, p_quantity: 1, p_amount_cents: cents,
      p_kind: lineEdit.kind, p_delete: remove,
    });
    setBusy(null);
    if (error) { showAlert("Couldn't change the bill", error.message); return; }
    setLineEdit(null);
    load();
  };

  let body;
  if (!loaded) {
    body = <View style={styles.center}><ActivityIndicator color={theme.colors.textSecondary} size="large" /></View>;
  } else if (!receipt) {
    body = <EmptyState icon="receipt-outline" title="Bill not found" body="It may have been cancelled, or it isn't shared with you yet." />;
  } else if (receipt.status === 'cancelled') {
    body = <EmptyState icon="close-circle-outline" title="This bill was cancelled" body="Nobody owes anything for it." />;
  } else if (receipt.status === 'draft') {
    const check = draft ? draftCheck(draft) : null;
    const others = receipt.people.filter((p) => !p.is_payer).length;
    body = (
      <>
        <Header receipt={receipt} title="Split the bill" subtitle={`${receipt.event_title} · paid by you`} />
        {photo && <Button title="See the photo" icon="image-outline" variant="soft" size="sm" onPress={() => setViewer(0)} style={{ alignSelf: 'flex-start' }} />}
        {scanning ? (
          <Card style={styles.scanning}>
            <ActivityIndicator color={theme.colors.textSecondary} />
            <Text style={theme.type.value}>Reading the receipt…</Text>
            <Text style={theme.type.caption}>This takes a few seconds.</Text>
          </Card>
        ) : scanProblem ? (
          <Card style={{ gap: Space.md }}>
            <Text style={theme.type.cardTitle}>
              {scanProblem.code === 'not_configured' ? "Scanning isn't set up yet" : scanProblem.code === 'not_a_receipt' ? "That doesn't look like a receipt" : "Couldn't read it"}
            </Text>
            <Text style={theme.type.bodySecondary}>
              {scanProblem.code === 'not_configured' ? 'You can type the lines in instead.' : scanProblem.message || 'Try again, or type the lines in.'}
            </Text>
            {scanProblem.code !== 'not_configured' && <Button title="Try again" icon="refresh" variant="soft" onPress={runScan} />}
            <Button title="Type the lines in" variant="soft" onPress={typeItIn} />
            {canUseDemoReceipt(user?.email) && <Button title="Use the demo receipt" variant="ghost" onPress={fillDemo} />}
          </Card>
        ) : draft ? (
          <>
            {!receipt.image_path && draft.lines.length === 0 && canUseDemoReceipt(user?.email) && (
              <Button title="Use the demo receipt" variant="ghost" size="sm" onPress={fillDemo} style={{ alignSelf: 'flex-start' }} />
            )}
            <DraftEditor draft={draft} onChange={setDraft} />
            <Button
              title={others === 0 ? 'Nobody else is going yet' : `Send to the ${others === 1 ? '1 other person' : `${others} others`} who came`}
              icon="paper-plane"
              disabled={!check?.ok || others === 0}
              loading={busy === 'send'}
              onPress={send}
            />
          </>
        ) : null}
        <Button title="Cancel" variant="ghost" onPress={cancel} style={{ alignSelf: 'flex-start' }} />
      </>
    );
  } else {
    const locked = receipt.status === 'locked';
    const me = receipt.people.find((p) => p.user_id === user?.id);
    const myDebt = receipt.split?.find((r) => r.user_id === user?.id && r.obligation_id);
    const nobodyPaid = !!receipt.split?.every((r) => r.is_payer || r.status === 'owed');
    body = (
      <>
        <Header
          receipt={receipt}
          title={locked ? receipt.description : receipt.is_payer ? 'What did you have?' : `What did you have, ${firstName(me?.name, 'there')}?`}
          subtitle={locked
            ? `${billMoney(receipt.total_cents)} · locked · paid by ${receipt.is_payer ? 'you' : firstName(receipt.payer_name)}`
            : `Shared items split between everyone who ticks them. ${receipt.is_payer ? 'You' : firstName(receipt.payer_name)} paid ${billMoney(receipt.total_cents)}.`}
        />

        {locked && receipt.split && (
          <Card style={{ gap: Space.sm }}>
            <SplitPeople rows={receipt.split} myId={user?.id} />
            {myDebt && (myDebt.status === 'owed' || myDebt.status === 'disputed') && (
              <Button title={`Pay ${firstName(receipt.payer_name)} ${billMoney(myDebt.share_cents)}`} icon="wallet-outline" onPress={() => router.push(`/pay/${myDebt.obligation_id}`)} />
            )}
          </Card>
        )}

        {editing && receipt.is_payer && !locked && (
          <Card style={{ gap: Space.sm }}>
            <Text style={theme.type.cardTitle}>Edit the bill</Text>
            <Text style={theme.type.caption}>Tap a line to fix it. Ticks on other lines stay; anyone whose share changes confirms again.</Text>
            {lineEdit ? (
              <View style={{ gap: Space.sm }}>
                <TextField label={lineEdit.kind === 'item' ? 'Item' : 'Surcharge or discount'} value={lineEdit.name} onChangeText={(name) => setLineEdit({ ...lineEdit, name })} maxLength={80} />
                <TextField label="Amount" value={lineEdit.amount} onChangeText={(amount) => setLineEdit({ ...lineEdit, amount })} keyboardType="numbers-and-punctuation" placeholder="0.00" />
                <View style={styles.row}>
                  <Button title="Save" size="sm" onPress={() => saveLine()} loading={busy === 'line'} />
                  {lineEdit.id && <Button title="Remove" size="sm" variant="danger" onPress={() => saveLine(true)} />}
                  <Button title="Never mind" size="sm" variant="ghost" onPress={() => setLineEdit(null)} />
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <Button title="Add an item" icon="add" size="sm" variant="soft" onPress={() => setLineEdit({ id: null, name: '', amount: '', kind: 'item' })} />
                <Button title="Done" size="sm" variant="ghost" onPress={() => setEditing(false)} />
              </View>
            )}
          </Card>
        )}

        {!locked && <ClaimedBar receipt={receipt} />}
        <ClaimList
          receipt={receipt}
          myId={user?.id}
          editable={!locked}
          onToggle={toggle}
          onEditLine={editing && !locked ? (l) => setLineEdit({ id: l.id, name: l.name, amount: (l.amount_cents / 100).toFixed(2), kind: l.kind }) : undefined}
        />

        {!locked && (
          <>
            <ShareCard receipt={receipt} myId={user?.id} onConfirm={confirm} busy={busy === 'confirm'} />
            <Text style={theme.type.sectionHeading}>Who's confirmed</Text>
            <PeopleStatus receipt={receipt} myId={user?.id} />
          </>
        )}

        {receipt.is_payer && (
          <View style={{ gap: Space.sm }}>
            {!locked && (
              <>
                <Button title="Lock the split" icon="lock-closed" onPress={lock} disabled={receipt.blockers.length > 0} loading={busy === 'lock_receipt'} />
                {receipt.blockers.length > 0 && <Text style={theme.type.caption}>Not yet: {receipt.blockers.join(' · ')}.</Text>}
                {!editing && <Button title="Edit the bill" icon="create-outline" variant="soft" onPress={() => setEditing(true)} />}
              </>
            )}
            {locked && nobodyPaid && <Button title="Reopen the bill" icon="lock-open-outline" variant="soft" onPress={unlock} loading={busy === 'unlock_receipt'} />}
            <Button title="Cancel the bill" variant="ghost" onPress={cancel} style={{ alignSelf: 'flex-start' }} />
          </View>
        )}
        {photo && <Button title="See the receipt" icon="image-outline" variant="ghost" size="sm" onPress={() => setViewer(0)} style={{ alignSelf: 'flex-start' }} />}
        <Text style={theme.type.caption}>wya never touches the money: once it's locked, everyone pays {receipt.is_payer ? 'you' : firstName(receipt.payer_name)} back by PayID.</Text>
      </>
    );
  }

  const page = (
    <TabScreen withTabBar={false} keyboardAvoiding contentContainerStyle={styles.content}>
      <View style={{ alignSelf: 'flex-start' }}><IconButton icon="chevron-back" label="Back" onPress={goBack} /></View>
      {body}
      <ImageLightbox images={photo ? [photo] : []} startIndex={viewer} onClose={() => setViewer(null)} />
    </TabScreen>
  );
  return <WithTopBar>{page}</WithTopBar>;
}

function Header({ receipt, title, subtitle }: { receipt: Receipt; title: string; subtitle: string }) {
  const { theme } = useTheme();
  // The last word in the serif, like the mockups ("Split the *bill*")
  const words = title.split(' ');
  const last = words.pop();
  return (
    <View style={{ gap: 4 }}>
      <Text style={theme.type.label}>Bill · {receipt.event_title}</Text>
      <Text style={theme.type.title} accessibilityRole="header">
        {words.join(' ')} <Text style={{ fontFamily: Fonts.serif, fontSize: 31 }}>{last}</Text>
      </Text>
      <Text style={theme.type.bodySecondary}>{subtitle}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  content: { paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.lg },
  center: { paddingVertical: Space.xxxl, alignItems: 'center' },
  scanning: { alignItems: 'center', gap: Space.sm, paddingVertical: Space.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, alignItems: 'center' },
}));
