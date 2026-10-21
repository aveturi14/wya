import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Logo from '@/components/ui/Logo';
import Screen from '@/components/ui/Screen';
import { useTopInset } from '@/components/ui/TabScreen';
import { Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { collectAction, CollectionPreview, firstName, formatDeadline } from '@/lib/collections';
import { friendlyError } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

/**
 * https://wya.expo.app/c/<code>: the booking page behind a collection link
 * (stage 1.1b). Opens signed out, from a group chat. "I'm in" asks the organiser
 * to let you in; nothing is owed and no PayID is shown until they do. People
 * already on the event join straight away. Never anyone's name but the organiser's.
 */
export default function CollectLinkScreen() {
  const { code, go } = useLocalSearchParams<{ code: string; go?: string }>();
  const { session, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const topInset = useTopInset();
  const [preview, setPreview] = useState<CollectionPreview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const autoAsked = useRef(false);
  usePageTitle(preview?.link_status === 'open' ? `${preview.title} · ${formatMoney(preview.per_person_cents)} each` : 'Collect money');

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_collection_preview', { p_code: code });
    setPreview((data as CollectionPreview | null) ?? null);
    setLoaded(true);
  }, [code]);
  // Again once signed in, so "me" says where you stand
  useEffect(() => { if (!authLoading) load(); }, [load, authLoading, session?.user.id]);

  const ask = useCallback(async () => {
    setBusy('ask');
    try {
      const r = await collectAction('request_to_join', { p_code: code }) as { collection_id: string; state: string };
      haptics.success();
      // On the event already, or the organiser: straight to the collection
      if (r.state === 'member' || r.state === 'organiser') router.replace(`/collect/${r.collection_id}`);
      else await load();
    } catch (e) {
      showAlert("Couldn't ask to join", friendlyError(e));
      await load();
    }
    setBusy(null);
  }, [code, load, router]);

  // Back from signing in with ?go=1: the tap they made before signing in goes through
  useEffect(() => {
    if (go !== '1' || autoAsked.current || !session || preview?.link_status !== 'open') return;
    if (preview.status !== 'open' || !['none', 'withdrawn', 'guest'].includes(preview.me ?? '')) return;
    autoAsked.current = true;
    ask();
  }, [go, session, preview, ask]);

  const goHome = () => router.replace(session ? '/(tabs)/home' : '/(auth)/welcome');

  if (!loaded || authLoading) {
    return <Screen style={styles.center}><ActivityIndicator color={theme.colors.textSecondary} size="large" /></Screen>;
  }
  if (!preview || preview.link_status === 'off') {
    return (
      <Screen style={[styles.center, { gap: Space.lg }]}>
        <Ionicons name="link-outline" size={36} color={theme.colors.textSecondary} />
        <View style={{ gap: Space.sm, alignItems: 'center' }}>
          <Text style={[theme.type.heading, { textAlign: 'center' }]} accessibilityRole="header">
            {preview ? 'This link is turned off' : "This link doesn't work"}
          </Text>
          <Text style={[theme.type.bodySecondary, { textAlign: 'center', maxWidth: 360 }]}>
            {preview
              ? `${firstName(preview.organiser_name)} turned off the link for ${preview.title}. Ask them for a new one.`
              : 'It may be mistyped, or the organiser made a new one. Ask them to send it again.'}
          </Text>
        </View>
        <Button title="Go home" variant="soft" size="lg" onPress={goHome} style={{ alignSelf: 'stretch', maxWidth: 420 }} />
      </Screen>
    );
  }

  const p = preview;
  const org = firstName(p.organiser_name);
  const amount = formatMoney(p.per_person_cents);
  const open = p.status === 'open' && new Date(p.deadline) > new Date();
  const full = p.max_people != null && p.joined >= p.max_people;
  const returnTo = `/c/${code}?go=1`;

  const report = async () => {
    const ok = await confirmAction('Report this collection?', "Tell us if this looks like a scam or isn't from someone you know. We'll take a look.", 'Report', true);
    if (!ok) return;
    try {
      await collectAction('report_collection', { p_code: code, p_reason: null });
      showAlert('Thanks', "We'll take a look. Don't send money if you're unsure.");
    } catch (e) {
      showAlert("Couldn't send that", friendlyError(e));
    }
  };

  // The one next step, by where you stand
  let action: ReactNode;
  if (!session) {
    action = open ? (
      <>
        <Button title={`I'm in, ${amount}`} size="lg" icon="hand-right-outline"
          onPress={() => router.push({ pathname: '/(auth)/register', params: { returnTo } })} />
        <Button title="I already have an account" variant="ghost"
          onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo } })} />
        <Text style={[theme.type.caption, { textAlign: 'center' }]}>You'll make a wya account (a minute), then come straight back.</Text>
      </>
    ) : <Text style={theme.type.bodySecondary}>This collection isn't taking people any more.</Text>;
  } else if (p.me === 'organiser' || p.me === 'member' || p.me === 'approved') {
    action = (
      <>
        <Text style={theme.type.value}>{p.me === 'organiser' ? "You're collecting this one." : "You're in."}</Text>
        <Button title="Open the collection" size="lg" onPress={() => router.replace(`/collect/${p.id}`)} />
      </>
    );
  } else if (p.me === 'requested') {
    action = (
      <>
        <View style={styles.waiting}>
          <Ionicons name="time-outline" size={18} color={theme.colors.textSecondary} />
          <Text style={[theme.type.body, { flex: 1 }]}>Waiting for {org} to let you in. You don't owe anything until then.</Text>
        </View>
        <Button title="Withdraw my request" variant="ghost" loading={busy === 'withdraw'}
          onPress={async () => {
            setBusy('withdraw');
            try { await collectAction('withdraw_request', { p_collection_id: p.id }); await load(); } catch (e) { showAlert('Something went wrong', friendlyError(e)); }
            setBusy(null);
          }} />
      </>
    );
  } else if (p.me === 'declined') {
    action = <Text style={theme.type.bodySecondary}>{org} said no to this one.</Text>;
  } else if (!open) {
    action = <Text style={theme.type.bodySecondary}>This collection isn't taking people any more.</Text>;
  } else if (full) {
    action = <Text style={theme.type.bodySecondary}>It's full.</Text>;
  } else {
    action = <Button title={`I'm in, ${amount}`} size="lg" icon="hand-right-outline" loading={busy === 'ask'} onPress={ask} />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: topInset + Space.lg }]} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Logo size={20} />
        </View>

        {/* Who's asking, up front: the first thing to check */}
        <View style={styles.organiser}>
          <Avatar name={p.organiser_name} url={p.organiser_avatar} seed={p.id} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={theme.type.heading} numberOfLines={2}>{p.organiser_name ?? 'Someone'}</Text>
            <Text style={theme.type.bodySecondary}>is collecting money</Text>
          </View>
        </View>

        <Card style={{ gap: Space.md }}>
          <Text style={theme.type.title} accessibilityRole="header">{p.title}</Text>
          <View style={styles.facts}>
            <Fact label="Each" value={amount} />
            <Fact label="Pay by" value={formatDeadline(p.deadline)} />
            <Fact label="In so far" value={`${p.joined}${p.max_people ? ` of ${p.max_people}` : ''}`} />
          </View>
          {!!p.merchant_note && <Text style={theme.type.caption}>Booking: {p.merchant_note}</Text>}
          <Text style={theme.type.caption}>
            Needs {p.min_people} {p.min_people === 1 ? 'person' : 'people'} paid. If that doesn't happen by the deadline, it closes and anyone who paid is refunded.
          </Text>
        </Card>

        <Note icon="person-outline">
          {org} lets each person in. You only pay once you're in, straight to {org} by PayID from your bank.
        </Note>
        <Note icon="shield-checkmark-outline">
          wya never holds the money. When you pay, check your bank shows <Text style={styles.noteStrong}>{p.organiser_name ?? org}</Text>. If it doesn't, don't send it.
        </Note>

        <View style={styles.actions}>{action}</View>

        {session && p.me !== 'organiser' && (
          <Button title="Report this" variant="ghost" size="sm" icon="flag-outline" onPress={report} style={{ alignSelf: 'center' }} />
        )}
      </ScrollView>
    </Screen>
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

function Note({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.note}>
      <Ionicons name={icon} size={16} color={theme.colors.textSecondary} style={{ marginTop: 2 }} />
      <Text style={[theme.type.caption, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  center: { justifyContent: 'center', alignItems: 'center', padding: Space.xl },
  page: { flexGrow: 1, paddingHorizontal: Space.lg, paddingBottom: Space.xxl, gap: Space.md },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  organiser: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  facts: { flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' },
  fact: { flex: 1, minWidth: 90, gap: 2, padding: Space.sm + 2, borderRadius: Radius.md, backgroundColor: t.colors.surfaceAlt },
  note: { flexDirection: 'row', gap: Space.sm, padding: Space.md, borderRadius: Radius.md, backgroundColor: t.colors.surfaceAlt },
  noteStrong: { color: t.colors.text, fontFamily: t.type.sectionHeading.fontFamily },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.md, borderRadius: Radius.md, backgroundColor: t.colors.surfaceAlt },
  actions: { gap: Space.xs, marginTop: Space.sm },
}));
