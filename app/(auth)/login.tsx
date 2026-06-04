import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Type } from '@/constants/typography';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.glow} />
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </View>
      <View style={styles.form}>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </View>
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
        </View>
        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Sign In</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.link}>Don't have an account?  <Text style={styles.linkAccent}>Create one</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 28, paddingTop: 60 },
  glow: { position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: Colors.accentGlow, opacity: 0.5 },
  back: { marginBottom: 40 },
  backText: { fontFamily: Fonts.body, color: Colors.textSecondary, fontSize: 22 },
  header: { marginBottom: 40, gap: 6 },
  title: { fontSize: 38, fontFamily: Fonts.displayBold, color: Colors.text, letterSpacing: -0.5 },
  subtitle: { ...Type.subtitle, fontSize: 16 },
  form: { gap: 16 },
  errorBox: { backgroundColor: Colors.dangerSubtle, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.danger + '33' },
  errorText: { ...Type.meta, color: Colors.danger },
  fieldWrap: { gap: 8 },
  label: { fontFamily: Fonts.bodySemiBold, color: Colors.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  input: { backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15, color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border, fontFamily: Fonts.body },
  btn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 8, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6 },
  btnText: { fontFamily: Fonts.bodySemiBold, color: Colors.white, fontSize: 16, letterSpacing: 0.8 },
  link: { ...Type.link, textAlign: 'center', marginTop: 8 },
  linkAccent: { ...Type.linkAccent },
});
