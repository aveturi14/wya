import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Logo from '@/components/ui/Logo';
import Poster, { PosterSticker } from '@/components/ui/Poster';
import Screen from '@/components/ui/Screen';
import { useTopInset } from '@/components/ui/TabScreen';
import { eventTheme } from '@/constants/eventThemes';
import { Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { formatCutoff, formatMoney } from '@/lib/pledges';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

type InvitePreview = {
  event_id: string; title: string; date: string; host_name: string | null; cover_image: string | null; theme: string;
  // Phase 8.1: the host approves new people; the link may have expired or run out of uses.
  // Phase 9.3: 'full' once the guest limit is reached
  requires_approval: boolean; link_status: 'open' | 'expired' | 'used_up' | 'full';
  // Phase 9.3: enough to draw the poster and explain the pledge before sign-up (never the address or who's going)
  poster_line: string | null; stickers: string[] | null; venue_name: string | null; kind: 'fixed' | 'open';
  going_count: number; maybe_count: number; deposit_mode: 'none' | 'pledge'; deposit_cents: number; cutoff_hours: number;
};

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const topInset = useTopInset();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');
  // Asked to join a link that needs the host's approval
  const [waiting, setWaiting] = useState(false);
  usePageTitle(preview ? `You're invited to ${preview.title}` : "You're invited");

  // Works logged out: only shows what the invite screen needs, never the address
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc('get_invite_preview', { p_code: code });
      setPreview(data?.[0] ?? null);
      setLoading(false);
    };
    load();
  }, [code]);

  // Once logged in, joining the event is what makes it visible to this user
  useEffect(() => {
    if (loading || authLoading || !preview || !session) return;
    const accept = async () => {
      const { data: eventId, error } = await supabase.rpc('accept_invite', { p_code: code });
      if (error || !eventId) { setError(error?.message ?? 'This invite link is no longer valid.'); return; }
      // Until the host lets them in, someone asking to join can't open the event
      const { data: mine } = await supabase.from('rsvps').select('status').eq('event_id', eventId).eq('user_id', session.user.id).maybeSingle();
      if (mine?.status === 'requested') { setWaiting(true); return; }
      router.replace(`/event/${eventId}`);
    };
    accept();
  }, [loading, authLoading, preview, session, code, router]);

  const goHome = () => router.replace(session ? '/(tabs)/home' : '/(auth)/welcome');

  if (loading || authLoading || (preview && session && !error && !waiting)) {
    return <Screen style={styles.center}><ActivityIndicator color={theme.colors.textSecondary} size="large" /></Screen>;
  }

  const hostFirst = preview?.host_name?.split(' ')[0] ?? 'the host';
  const hostSticker = (preview?.stickers ?? []).map((s, i): PosterSticker => ({ label: s, tone: i === 0 ? 'lime' : 'pink' }));

  // Wrong link, deleted event, or a link that stopped working: say which, and what to do
  if (!preview || error || preview.link_status !== 'open') {
    const reason = !preview
      ? { title: "This invite doesn't work", body: 'The link may be wrong, or the event was deleted. Ask the host for a new one.' }
      : error
        ? { title: "This invite doesn't work", body: error }
        : {
          expired: { title: 'This invite has expired', body: `The link for ${preview.title} has run out. Ask ${hostFirst} for a new one.` },
          used_up: { title: 'This invite is used up', body: `The link for ${preview.title} has been used as many times as ${hostFirst} allowed. Ask them for a new one.` },
          full: { title: 'This event is full', body: `${preview.title} has hit its guest limit. Ask ${hostFirst} to make room, or watch for the next one.` },
          open: { title: '', body: '' },
        }[preview.link_status];
    return (
      <Screen style={[styles.center, { gap: Space.lg }]}>
        {preview && (
          <View style={styles.greyed} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Poster title={preview.title} theme={preview.theme} imageUrl={preview.cover_image} date={preview.date} open={preview.kind === 'open'} height={200} lift={false} wobble={false} maxTitleSize={34} />
          </View>
        )}
        <View style={{ gap: Space.sm, alignItems: 'center' }}>
          <Text style={[theme.type.heading, { textAlign: 'center' }]} accessibilityRole="header">{reason.title}</Text>
          <Text style={[theme.type.bodySecondary, { textAlign: 'center', maxWidth: 360 }]}>{reason.body}</Text>
        </View>
        <Button title="Go home" variant="soft" size="lg" onPress={goHome} style={{ alignSelf: 'stretch', maxWidth: 420 }} />
      </Screen>
    );
  }

  const t = eventTheme(preview.theme);

  if (waiting) return (
    <Screen style={[styles.page, { paddingTop: topInset + Space.lg }]} glow={{ theme: preview.theme, imageUrl: preview.cover_image }}>
      <Poster title={preview.title} theme={preview.theme} imageUrl={preview.cover_image} line="you've asked to join" date={preview.date} open={preview.kind === 'open'} place={preview.venue_name} height={230} stickers={[{ label: 'waiting', tone: 'light' }]} />
      <View style={{ gap: Space.sm }}>
        <Text style={theme.type.heading} accessibilityRole="header">{hostFirst} will let you know</Text>
        <Text style={theme.type.bodySecondary}>You asked to join {preview.title}. You'll get a note in Activity when {hostFirst} answers.</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Button title="Go home" variant="soft" size="lg" onPress={() => router.replace('/(tabs)/home')} />
    </Screen>
  );

  const pledge = preview.deposit_mode === 'pledge';
  const cutoff = formatCutoff({ date: preview.date, cutoff_hours: preview.cutoff_hours });

  return (
    <Screen glow={{ theme: preview.theme, imageUrl: preview.cover_image }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: topInset + Space.lg }]} showsVerticalScrollIndicator={false}>
        <View style={styles.inviter}>
          <Avatar name={preview.host_name} seed={preview.event_id} size={28} />
          <Text style={theme.type.value}>
            <Text style={{ fontFamily: theme.type.sectionHeading.fontFamily }}>{preview.host_name ?? 'Someone'}</Text>
            <Text style={{ color: theme.colors.textSecondary }}> invited you</Text>
          </Text>
          <View style={{ flex: 1 }} />
          <Logo size={20} />
        </View>

        <Poster
          title={preview.title}
          theme={preview.theme}
          imageUrl={preview.cover_image}
          line={preview.poster_line}
          date={preview.date}
          open={preview.kind === 'open'}
          place={preview.venue_name}
          stickers={hostSticker}
          height={240}
        />

        {(preview.going_count > 0 || preview.maybe_count > 0) && (
          <Text style={theme.type.caption}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.type.sectionHeading.fontFamily }}>{preview.going_count} going</Text>
            {` · ${preview.maybe_count} maybe`}
          </Text>
        )}

        {pledge && (
          <Note icon="shield-checkmark-outline">
            <Text style={styles.noteStrong}>Saying I'm in is a {formatMoney(preview.deposit_cents)} pledge. </Text>
            {preview.kind === 'open' ? 'It starts once the time is picked. ' : `Cancel free until ${cutoff}. `}
            Only if you don't show do you pay {hostFirst}, directly.
          </Note>
        )}
        <Note icon="lock-closed-outline">
          {preview.requires_approval
            ? `${hostFirst} approves new guests. The address shows once you're in.`
            : "The address shows once you're in."}
        </Note>

        <View style={styles.actions}>
          {/* Come back here after auth so the invite gets accepted */}
          <Button
            title={preview.requires_approval ? 'Sign up to ask to join' : 'Sign up to RSVP'}
            size="lg"
            color={{ bg: t.a, fg: t.ink }}
            onPress={() => router.push({ pathname: '/(auth)/register', params: { returnTo: `/invite/${code}` } })}
          />
          {/* Also for people already on the event, who can always reopen the link */}
          <Button
            title="I already have an account"
            variant="ghost"
            onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: `/invite/${code}` } })}
          />
        </View>
      </ScrollView>
    </Screen>
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
  inviter: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  greyed: { width: 200, opacity: 0.45, filter: 'grayscale(1)' } as any,
  note: { flexDirection: 'row', gap: Space.sm, padding: Space.md, borderRadius: Radius.md, backgroundColor: t.colors.surfaceAlt },
  noteStrong: { color: t.colors.text, fontFamily: t.type.sectionHeading.fontFamily },
  actions: { gap: Space.xs, marginTop: Space.sm },
}));
