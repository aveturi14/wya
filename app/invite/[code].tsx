import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    const resolve = async () => {
      const { data } = await supabase.from('events').select('id').eq('invite_code', code).single();
      if (data) setEventId(data.id);
      setLoading(false);
    };
    resolve();
  }, [code]);

  useEffect(() => {
    if (!loading && eventId && session) {
      router.replace(`/event/${eventId}`);
    }
  }, [loading, eventId, session, router]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;

  if (!eventId) return (
    <View style={styles.center}>
      <Text style={styles.title}>Invalid Invite</Text>
      <Text style={styles.sub}>This invite link is no longer valid.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(auth)/welcome')}>
        <Text style={styles.btnText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );

  if (!session) return (
    <View style={styles.center}>
      <Text style={styles.logo}>wya</Text>
      <Text style={styles.title}>You've been invited!</Text>
      <Text style={styles.sub}>Create an account or sign in to view this event and RSVP.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.push({ pathname: '/(auth)/register', params: { returnTo: `/event/${eventId}` } })}>
        <Text style={styles.btnText}>Create Account</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: `/event/${eventId}` } })}>
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
  sub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  btn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  btnText: { color: Colors.background, fontSize: 17, fontWeight: '700' },
  secondaryBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, borderWidth: 1, borderColor: Colors.border },
  secondaryBtnText: { color: Colors.text, fontSize: 17, fontWeight: '500' },
});
