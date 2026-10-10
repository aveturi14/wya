import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type InvitePreview = { event_id: string; title: string; date: string; host_name: string | null; cover_image: string | null };

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');

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

  if (loading || authLoading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;

  if (!preview || error) return (
    <View style={styles.center}>
      <Text style={styles.title}>Invalid Invite</Text>
      <Text style={styles.sub}>{error || 'This invite link is no longer valid.'}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.replace(session ? '/(tabs)/home' : '/(auth)/welcome')}>
        <Text style={styles.btnText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );

  if (!session) return (
    <View style={styles.center}>
      <Text style={styles.logo}>wya</Text>
      <Text style={styles.title}>You've been invited!</Text>
      <Text style={styles.eventTitle}>{preview.title}</Text>
      <Text style={styles.sub}>
        {preview.host_name ? `Hosted by ${preview.host_name} · ` : ''}{format(new Date(preview.date), 'EEE, MMM d · h:mm a')}
      </Text>
      <Text style={styles.sub}>Create an account or sign in to see the details and RSVP.</Text>
      {/* Come back here after auth so the invite gets accepted */}
      <TouchableOpacity style={styles.btn} onPress={() => router.push({ pathname: '/(auth)/register', params: { returnTo: `/invite/${code}` } })}>
        <Text style={styles.btnText}>Create Account</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: `/invite/${code}` } })}>
        <Text style={styles.secondaryBtnText}>Sign In</Text>
      </TouchableOpacity>
    </View>
  );

  return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  logo: { fontSize: 60, fontWeight: '800', color: Colors.accent, letterSpacing: -3 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  eventTitle: { fontSize: 20, fontWeight: '700', color: Colors.accentLight, textAlign: 'center' },
  sub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  btn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  btnText: { color: Colors.background, fontSize: 17, fontWeight: '700' },
  secondaryBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, borderWidth: 1, borderColor: Colors.border },
  secondaryBtnText: { color: Colors.text, fontSize: 17, fontWeight: '500' },
});
