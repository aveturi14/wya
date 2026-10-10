import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import EventCover from '@/components/ui/EventCover';
import Logo from '@/components/ui/Logo';
import Screen from '@/components/ui/Screen';
import Sticker from '@/components/ui/Sticker';
import { eventTheme } from '@/constants/eventThemes';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

type InvitePreview = { event_id: string; title: string; date: string; host_name: string | null; cover_image: string | null; theme: string };

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');
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
      router.replace(`/event/${eventId}`);
    };
    accept();
  }, [loading, authLoading, preview, session, code, router]);

  if (loading || authLoading || (preview && session && !error)) {
    return <Screen style={styles.center}><ActivityIndicator color={theme.colors.primary} size="large" /></Screen>;
  }

  if (!preview || error) return (
    <Screen style={styles.center}>
      <EmptyState
        icon="link-outline"
        title="This invite doesn't work"
        body={error || 'The link may be wrong, or the event was deleted. Ask the host for a new one.'}
        action={<Button title="Go home" onPress={() => router.replace(session ? '/(tabs)/home' : '/(auth)/welcome')} />}
      />
    </Screen>
  );

  const t = eventTheme(preview.theme);
  const date = new Date(preview.date);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Logo size={26} />

        <View style={styles.coverWrap}>
          <EventCover seed={preview.event_id} title={preview.title} theme={preview.theme} imageUrl={preview.cover_image} style={styles.cover} initialSize={160} />
          <Sticker label="You're invited" bg={theme.isDark ? theme.colors.secondary : theme.colors.highlight} fg={theme.isDark ? theme.colors.onSecondary : theme.colors.onHighlight} tilt={-6} style={styles.sticker} />
        </View>

        <View style={styles.text}>
          <Text style={theme.type.display}>{preview.title}</Text>
          {preview.host_name && (
            <Text style={theme.type.bodySecondary}>
              Hosted by <Text style={{ color: theme.colors.text, fontFamily: Fonts.bodyBold }}>{preview.host_name}</Text>
            </Text>
          )}
        </View>

        <View style={styles.dateRow}>
          <View style={[styles.dateBlock, { backgroundColor: t.base }]}>
            <Text style={[styles.dateMonth, { color: t.ink }]}>{format(date, 'MMM').toUpperCase()}</Text>
            <Text style={[styles.dateDay, { color: t.ink }]}>{format(date, 'd')}</Text>
          </View>
          <View style={{ gap: 2 }}>
            <Text style={theme.type.heading}>{format(date, 'EEEE')}</Text>
            <Text style={theme.type.bodySecondary}>{format(date, 'h:mm a')}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {/* Come back here after auth so the invite gets accepted */}
          <Button
            title="I'm in — create account"
            size="lg"
            color={{ bg: t.base, fg: t.ink }}
            onPress={() => router.push({ pathname: '/(auth)/register', params: { returnTo: `/invite/${code}` } })}
          />
          <Button
            title="I already have an account"
            variant="outline"
            onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: `/invite/${code}` } })}
          />
          <Text style={[theme.type.caption, { textAlign: 'center' }]}>The address and guest list show up once you're in.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  center: { justifyContent: 'center', alignItems: 'center', padding: Space.xl },
  content: { padding: Space.xl, paddingTop: Space.xxxl, gap: Space.xl },
  coverWrap: { position: 'relative' },
  cover: {
    height: 300,
    borderRadius: Radius.xl,
    borderWidth: t.outlineWidth,
    borderColor: t.colors.outline,
    ...(t.isDark ? {} : { boxShadow: `5px 5px 0px ${t.colors.outline}` }),
  },
  sticker: { position: 'absolute', top: -10, right: 16 },
  text: { gap: Space.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Space.lg },
  dateBlock: {
    width: 64, height: 68, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: t.isDark ? 0 : t.outlineWidth, borderColor: t.colors.outline,
  },
  dateMonth: { ...t.type.label, color: undefined, fontSize: 11 },
  dateDay: { ...t.type.title, color: undefined, fontSize: 28, lineHeight: 30 },
  actions: { gap: Space.md, marginTop: Space.sm },
}));
