import { CollectProgress, statusChip } from '@/components/collect/CollectCard';
import { WithTopBar } from '@/components/nav/AppTabBar';
import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import IconButton from '@/components/ui/IconButton';
import { ListGroup } from '@/components/ui/ListRow';
import Sheet from '@/components/ui/Sheet';
import TabScreen from '@/components/ui/TabScreen';
import { Fonts, Radius, Space } from '@/constants/theme';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { Collection, collectAction, collectionLink, CollectPerson, firstName, formatDeadline, shareCollection, ShareState, useCollection } from '@/lib/collections';
import { friendlyError } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/pledges';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';

let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

const toDatetimeLocal = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// What each share's state is called. "Says paid" is never shown as paid (rule 3).
function stateLabel(s: ShareState, org: string) {
  return {
    in: 'In, not paid yet',
    says_paid: `Says they've paid · ${org === 'You' ? 'check your bank' : `${org} to confirm`}`,
    confirmed: 'Paid · confirmed',
    disputed: 'Not received',
    refund_requested: 'Refund due',
    refunded: 'Refunded',
  }[s];
}

/**
 * https://wya.expo.app/collect/<id>: one collection (stage 1.1). Everyone sees the
 * progress, the deadline and who's in. Participants join, pay (the pay page, PayID
 * only), leave or ask for a refund; the organiser confirms each payment, marks
 * refunds, and books once it's funded. Signed-out visitors sign in and come back.
 * Links (1.1b): the organiser shares the link and lets in each person who asks;
 * someone who asked sees that they're waiting.
 */
export default function CollectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { collection: c, error, loaded, reload } = useCollection(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [extending, setExtending] = useState<Date | null>(null);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  usePageTitle(c ? c.title : 'Collect money');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(c?.can_open_event ? `/event/${c.event_id}` : '/(tabs)/home'));

  const run = async (key: string, fn: Parameters<typeof collectAction>[0], args: Record<string, unknown>, after?: (data: unknown) => void) => {
    setBusy(key);
    try {
      const data = await collectAction(fn, args);
      haptics.success();
      await reload();
      after?.(data);
    } catch (e) {
      showAlert('Something went wrong', friendlyError(e));
    }
    setBusy(null);
  };

  let body;
  if (!loaded) {
    body = <View style={styles.center}><ActivityIndicator color={theme.colors.textSecondary} size="large" /></View>;
  } else if (!c) {
    body = (
      <EmptyState
        icon="lock-closed-outline"
        title={error?.hint === 'not_a_guest' ? 'Ask the organiser for the invite link' : "Can't open this"}
        body={error?.hint === 'not_a_guest'
          ? "This collection is for the people on the event. Once you've opened the invite, it shows up here."
          : friendlyError(error)}
        action={<Button title="Go home" onPress={() => router.replace('/(tabs)/home')} />}
      />
    );
  } else {
    body = <Body c={c} busy={busy} run={run} onExtend={() => setExtending(new Date(new Date(c.deadline).getTime() + 24 * 3600_000))} />;
  }

  const page = (
    <TabScreen withTabBar={false} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <View style={{ alignSelf: 'flex-start' }}><IconButton icon="chevron-back" label="Back" onPress={goBack} /></View>
        {body}
      </View>
      {c && (
        <Sheet
          visible={!!extending}
          onClose={() => { setExtending(null); setPicker(null); }}
          title="Extend the deadline"
          subtitle={`Now ${formatDeadline(c.deadline)}. Pick a later time, in the next 60 days.`}
          footer={
            <View style={{ flexDirection: 'row', gap: Space.sm }}>
              <Button title="Cancel" variant="soft" onPress={() => setExtending(null)} style={{ flex: 1 }} />
              <Button
                title="Extend"
                loading={busy === 'extend'}
                disabled={!extending || extending <= new Date(c.deadline)}
                onPress={() => extending && run('extend', 'extend_deadline', { p_id: c.id, p_deadline: extending.toISOString() }, () => setExtending(null))}
                style={{ flex: 1 }}
              />
            </View>
          }
        >
          {extending && (Platform.OS === 'web' ? (
            <input
              type="datetime-local"
              aria-label="New deadline"
              value={toDatetimeLocal(extending)}
              min={toDatetimeLocal(new Date(c.deadline))}
              onChange={(e) => { if (e.target.value) setExtending(new Date(e.target.value)); }}
              style={webInput(theme)}
            />
          ) : (
            <View style={{ gap: Space.sm }}>
              <View style={{ flexDirection: 'row', gap: Space.sm }}>
                <Button title={format(extending, 'EEE d MMM')} variant="soft" icon="calendar-clear-outline" onPress={() => setPicker('date')} style={{ flex: 1 }} />
                <Button title={format(extending, 'h:mm a')} variant="soft" icon="time-outline" onPress={() => setPicker('time')} style={{ flex: 1 }} />
              </View>
              {picker && DateTimePicker && (
                <View>
                  <DateTimePicker
                    value={extending}
                    mode={picker}
                    minimumDate={new Date(c.deadline)}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant={theme.isDark ? 'dark' : 'light'}
                    onValueChange={(_: unknown, d: Date) => { setExtending(d); if (Platform.OS !== 'ios') setPicker(null); }}
                    onDismiss={() => setPicker(null)}
                  />
                  {Platform.OS === 'ios' && <Button title="Done" variant="soft" size="sm" onPress={() => setPicker(null)} style={{ alignSelf: 'flex-end' }} />}
                </View>
              )}
            </View>
          ))}
        </Sheet>
      )}
    </TabScreen>
  );

  return <WithTopBar>{page}</WithTopBar>;
}

type Run = (key: string, fn: Parameters<typeof collectAction>[0], args: Record<string, unknown>, after?: (data: unknown) => void) => Promise<void>;

function Body({ c, busy, run, onExtend }: { c: Collection; busy: string | null; run: Run; onExtend: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const org = firstName(c.organiser_name);
  const amount = formatMoney(c.per_person_cents);
  const chip = statusChip(c.status, theme);
  const metMinimum = c.counts.confirmed >= c.min_people && c.counts.confirmed_cents >= c.target_cents;

  // The line under the title: where it stands, in plain words
  const headline = (() => {
    switch (c.status) {
      case 'open': return c.is_organiser ? `${amount} each, paid to you before you book` : `${amount} each, paid to ${org} before booking`;
      case 'funded': return c.is_organiser ? 'Funded! Book it, then mark it booked.' : `Funded! ${org} can book now.`;
      case 'booked': return c.is_organiser ? 'Booked. Nice work.' : `${org} booked it. You're all set.`;
      case 'expired': return c.is_organiser
        ? `This one didn't fill up.${c.counts.refunds_due > 0 ? ' Refund anyone who paid.' : ''}`
        : `This one didn't fill up.${c.counts.refunds_due > 0 ? ` ${org} will refund anyone who paid.` : ''}`;
      case 'cancelled': return c.is_organiser
        ? `Cancelled.${c.counts.refunds_due > 0 ? ' Refund anyone who paid.' : ''}`
        : `${org} cancelled it.${c.counts.refunds_due > 0 ? ' Anyone who paid gets refunded.' : ''}`;
    }
  })();

  const leave = async () => {
    const paid = c.my_state === 'says_paid' || c.my_state === 'confirmed';
    const ok = await confirmAction(
      paid ? 'Ask for a refund?' : 'Leave this collection?',
      paid ? `${org} will be asked to send your ${amount} back.` : "You won't owe anything.",
      paid ? 'Ask for a refund' : 'Leave',
      true,
    );
    if (ok) run('leave', 'leave_collection', { p_id: c.id });
  };

  const join = () => run('join', 'join_collection', { p_id: c.id }, (obligationId) => router.push(`/pay/${obligationId as string}`));

  // Your own share, as a participant: one clear next step
  const mine = !c.is_organiser && (
    <Card style={{ gap: Space.sm }}>
      <Text style={theme.type.label}>You</Text>
      {!c.my_state && c.my_request === 'requested' ? (
        <>
          <Text style={theme.type.body}>Waiting for {org} to let you in. You don't owe anything until then.</Text>
          <Button title="Withdraw my request" variant="ghost" size="sm" loading={busy === 'withdraw'}
            onPress={() => run('withdraw', 'withdraw_request', { p_collection_id: c.id })} style={{ alignSelf: 'flex-start' }} />
        </>
      ) : !c.my_state && c.my_request === 'declined' ? (
        <Text style={theme.type.bodySecondary}>{org} said no to this one.</Text>
      ) : !c.my_state && c.my_request === 'withdrawn' ? (
        <Text style={theme.type.bodySecondary}>You withdrew your request. Open the link again to ask again.</Text>
      ) : c.can_join ? (
        <>
          <Text style={theme.type.body}>Tapping "I'm in" means you'll pay {org} {amount} by {formatDeadline(c.deadline)}.</Text>
          <Button title={`I'm in, ${amount}`} icon="hand-right-outline" loading={busy === 'join'} onPress={join} />
        </>
      ) : !c.my_state ? (
        <Text style={theme.type.bodySecondary}>{c.status === 'open' ? "It's full." : "You're not in this one."}</Text>
      ) : (
        <>
          <Text style={theme.type.value}>
            {{
              in: `You're in for ${amount}`,
              disputed: `${org} hasn't received your ${amount}. Check the transfer went through.`,
              says_paid: `You've paid. ${org} hasn't confirmed it yet.`,
              confirmed: `${org} got your ${amount}. ✓`,
              refund_requested: `${org} will refund your ${amount}.`,
              refunded: `${org} refunded your ${amount}.`,
            }[c.my_state]}
          </Text>
          {(c.my_state === 'in' || c.my_state === 'disputed') && c.my_obligation_id && (
            <Button title={`Pay ${org} ${amount}`} icon="card-outline" onPress={() => router.push(`/pay/${c.my_obligation_id}`)} />
          )}
          {(c.my_state === 'in' || c.my_state === 'disputed') && c.status === 'open' && (
            <Button title="Leave" variant="ghost" size="sm" loading={busy === 'leave'} onPress={leave} style={{ alignSelf: 'flex-start' }} />
          )}
          {(c.my_state === 'says_paid' || c.my_state === 'confirmed') && (c.status === 'open' || c.status === 'funded' || c.status === 'booked') && (
            <Button title="Ask for a refund" variant="ghost" size="sm" loading={busy === 'leave'} onPress={leave} style={{ alignSelf: 'flex-start' }} />
          )}
        </>
      )}
    </Card>
  );

  // The organiser's top actions
  const tools = c.is_organiser && (c.status === 'open' || c.status === 'funded') && (
    <View style={styles.tools}>
      {c.status === 'funded' && (
        <Button title="Mark as booked" icon="checkmark-circle-outline" loading={busy === 'book'}
          onPress={async () => {
            if (await confirmAction('Mark as booked?', 'Everyone in is told it\'s booked.', 'Mark as booked')) run('book', 'mark_booked', { p_id: c.id });
          }} />
      )}
      {c.status === 'open' && c.counts.confirmed > 0 && !metMinimum && (
        <Button title="Go ahead anyway" variant="soft" loading={busy === 'ahead'}
          onPress={async () => {
            const ok = await confirmAction('Go ahead with fewer people?',
              `${c.counts.confirmed} of ${c.min_people} have paid. It's marked funded, and you cover anything short yourself if you book.`, 'Go ahead');
            if (ok) run('ahead', 'go_ahead_anyway', { p_id: c.id });
          }} />
      )}
      {c.status === 'open' && <Button title="Extend deadline" variant="soft" icon="time-outline" onPress={onExtend} />}
      <Button title="Cancel" variant="danger" loading={busy === 'cancel'}
        onPress={async () => {
          const ok = await confirmAction('Cancel this collection?',
            "Anyone who hasn't paid is let off. You'll be asked to refund anyone who has.", 'Cancel collection', true);
          if (ok) run('cancel', 'cancel_collection', { p_id: c.id });
        }} />
    </View>
  );

  // The link for the group chat (1.1b)
  const linkTools = c.is_organiser && c.link_code && (c.status === 'open' || c.status === 'funded') && (
    <Card style={{ gap: Space.sm }}>
      <Text style={theme.type.label}>Link for your group chat</Text>
      {c.link_enabled ? (
        <>
          <Text style={[theme.type.caption, styles.link]} selectable numberOfLines={1}>{collectionLink(c.link_code)}</Text>
          <Text style={theme.type.caption}>Anyone with it can ask to join. You let each person in, and nobody pays before that.</Text>
          <View style={styles.tools}>
            <Button title="Share link" icon="share-outline" onPress={() => shareCollection(c)} />
            <Button title="New link" variant="soft" loading={busy === 'newlink'}
              onPress={async () => {
                if (await confirmAction('Make a new link?', 'The old link stops working. People already in stay in.', 'New link')) {
                  run('newlink', 'set_collection_link', { p_collection_id: c.id, p_enabled: true, p_new_code: true });
                }
              }} />
            <Button title="Turn off link" variant="ghost" loading={busy === 'linkoff'}
              onPress={() => run('linkoff', 'set_collection_link', { p_collection_id: c.id, p_enabled: false, p_new_code: false })} />
          </View>
        </>
      ) : (
        <>
          <Text style={theme.type.bodySecondary}>The link is off. Nobody new can ask to join.</Text>
          <Button title="Turn the link back on" variant="soft" loading={busy === 'linkon'} style={{ alignSelf: 'flex-start' }}
            onPress={() => run('linkon', 'set_collection_link', { p_collection_id: c.id, p_enabled: true, p_new_code: false })} />
        </>
      )}
    </Card>
  );

  const requests = c.is_organiser && c.requests.length > 0 && (
    <View style={{ gap: Space.sm }}>
      <Text style={theme.type.label}>Asking to join · {c.requests.length}</Text>
      <ListGroup>
        {c.requests.map((r) => (
          <View key={r.user_id} style={styles.person}>
            <Avatar name={r.name} url={r.avatar_url} seed={r.user_id} size={36} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={theme.type.value} numberOfLines={1}>{r.name ?? 'Someone'}</Text>
              <Text style={theme.type.caption} numberOfLines={2}>Asked {format(new Date(r.requested_at), 'EEE h:mm a')}</Text>
            </View>
            <View style={styles.personActions}>
              <Button title="Let in" size="sm" icon="checkmark" loading={busy === `approve:${r.user_id}`}
                onPress={() => run(`approve:${r.user_id}`, 'approve_request', { p_collection_id: c.id, p_user_id: r.user_id })} />
              <Button title="Decline" size="sm" variant="ghost" loading={busy === `decline:${r.user_id}`}
                onPress={async () => {
                  if (await confirmAction(`Decline ${firstName(r.name, 'them')}?`, "They can't ask again with this link.", 'Decline', true)) {
                    run(`decline:${r.user_id}`, 'decline_request', { p_collection_id: c.id, p_user_id: r.user_id });
                  }
                }} />
            </View>
          </View>
        ))}
      </ListGroup>
    </View>
  );

  const personActions = (p: CollectPerson) => {
    if (!c.is_organiser || !p.obligation_id) return null;
    const ob = p.obligation_id;
    const name = firstName(p.name, 'them');
    if (p.state === 'says_paid') {
      return (
        <View style={styles.personActions}>
          <Button title="Got it" size="sm" icon="checkmark" loading={busy === `ok:${ob}`} onPress={() => run(`ok:${ob}`, 'confirm_received', { p_obligation_id: ob })} />
          <Button title="Not received" size="sm" variant="ghost" loading={busy === `no:${ob}`}
            onPress={async () => {
              if (await confirmAction('Not received?', `${name} is told it hasn't arrived.`, 'Not received')) run(`no:${ob}`, 'dispute_payment', { p_obligation_id: ob });
            }} />
        </View>
      );
    }
    if (p.state === 'refund_requested') {
      return (
        <Button title="Refunded" size="sm" variant="soft" loading={busy === `refund:${ob}`}
          onPress={async () => {
            if (await confirmAction(`Refunded ${name}?`, `Only tap this once you've sent ${formatMoney(p.amount_cents)} back to ${name}.`, 'Refunded')) {
              run(`refund:${ob}`, 'mark_refunded', { p_obligation_id: ob });
            }
          }} />
      );
    }
    return null;
  };

  const stateColor = (s: ShareState) => ({
    in: theme.colors.textSecondary, says_paid: theme.colors.warningText, confirmed: theme.colors.successText,
    disputed: theme.colors.dangerText, refund_requested: theme.colors.warningText, refunded: theme.colors.textMuted,
  }[s]);

  return (
    <View style={{ gap: Space.lg }}>
      <View style={{ gap: Space.xs }}>
        <View style={styles.headRow}>
          <Text style={theme.type.label} numberOfLines={1}>{c.standalone || !c.can_open_event ? 'Collection' : `Collection · ${c.event_title}`}</Text>
          <Chip label={chip.label} color={chip.color} />
        </View>
        <Text style={theme.type.title} accessibilityRole="header">{c.title}</Text>
        <Text style={theme.type.bodySecondary}>{headline}</Text>
      </View>

      <Card style={{ gap: Space.md }}>
        <CollectProgress c={c} />
        <View style={styles.facts}>
          <Fact label="Each" value={amount} />
          <Fact label="Need" value={`${c.min_people} ${c.min_people === 1 ? 'person' : 'people'}`} />
          <Fact label={c.status === 'open' ? 'Pay by' : 'Deadline'} value={formatDeadline(c.deadline)} />
        </View>
        {!!c.merchant_note && <Text style={theme.type.caption}>Booking: {c.merchant_note}</Text>}
        <Text style={theme.type.caption}>
          Organised by {c.is_organiser ? 'you' : c.organiser_name ?? 'someone'}. wya doesn't hold the money: each person pays {c.is_organiser ? 'you' : org} by PayID.
          {c.go_ahead_short ? ' Going ahead below the minimum.' : ''}
        </Text>
      </Card>

      {mine}
      {requests}
      {linkTools}
      {tools}

      <View style={{ gap: Space.sm }}>
        {/* Everyone listed, including shares on their way back */}
        <Text style={theme.type.label}>{c.status === 'open' || c.status === 'funded' ? "Who's in" : 'People'} · {c.people.length}</Text>
        {c.people.length === 0 ? (
          <Text style={theme.type.bodySecondary}>Nobody yet. {c.is_organiser ? 'Share the link in your group chat.' : ''}</Text>
        ) : (
          <ListGroup>
            {c.people.map((p) => (
              <View key={p.user_id} style={styles.person}>
                <Avatar name={p.name} url={p.avatar_url} seed={p.user_id} size={36} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={theme.type.value} numberOfLines={1}>{p.name ?? 'Someone'}</Text>
                  <Text style={[theme.type.caption, { color: stateColor(p.state) }]} numberOfLines={2}>
                    {stateLabel(p.state, c.is_organiser ? 'You' : org)}
                    {p.state === 'says_paid' && p.paid_at ? ` · ${format(new Date(p.paid_at), 'EEE h:mm a')}` : ''}
                  </Text>
                </View>
                {personActions(p)}
              </View>
            ))}
          </ListGroup>
        )}
      </View>

      {c.can_open_event && <Button title="Open the event" variant="ghost" onPress={() => router.push(`/event/${c.event_id}`)} style={{ alignSelf: 'flex-start' }} />}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.fact}>
      <Text style={theme.type.caption}>{label}</Text>
      <Text style={theme.type.value} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function webInput(t: ReturnType<typeof useTheme>['theme']) {
  return {
    backgroundColor: t.colors.surface, color: t.colors.text, fontSize: 15, fontFamily: Fonts.body,
    border: `1px solid ${t.isDark ? t.colors.outline : t.colors.border}`, borderRadius: Radius.md,
    padding: '12px 12px', minHeight: 46, width: '100%', minWidth: 0, boxSizing: 'border-box', colorScheme: t.isDark ? 'dark' : 'light', outline: 'none', cursor: 'pointer',
  } as any;
}

const useStyles = makeStyles((t) => ({
  content: { paddingHorizontal: Space.lg, paddingTop: Space.md },
  // A readable column on desktop
  inner: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: Space.lg },
  center: { paddingVertical: Space.xxxl, alignItems: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  facts: { flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' },
  fact: { flex: 1, minWidth: 90, gap: 2, padding: Space.sm + 2, borderRadius: Radius.md, backgroundColor: t.colors.surfaceAlt },
  tools: { flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' },
  person: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md, paddingHorizontal: Space.md + 2 },
  personActions: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  link: { padding: Space.sm + 2, borderRadius: Radius.md, backgroundColor: t.colors.surfaceAlt, color: t.colors.text },
}));
