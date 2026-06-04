import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Type } from '@/constants/typography';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!fullName || !email || !password) { setError('Please fill in all required fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone } } });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user) await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName, phone: phone || null });
    setLoading(false);
  };

  const fields = [
    { label: 'Full Name', value: fullName, onChange: setFullName, placeholder: 'Your name', required: true },
    { label: 'Email', value: email, onChange: setEmail, placeholder: 'you@example.com', keyboard: 'email-address', cap: 'none', required: true },
    { label: 'Phone', value: phone, onChange: setPhone, placeholder: '+1 (555) 000-0000', keyboard: 'phone-pad' },
    { label: 'Password', value: password, onChange: setPassword, placeholder: '••••••••', secure: true, required: true },
  ];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.glow} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join wya and start hosting</Text>
        </View>
        <View style={styles.form}>
          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          {fields.map((f) => (
            <View key={f.label} style={styles.fieldWrap}>
              <Text style={styles.label}>{f.label}{f.required && <Text style={styles.required}> *</Text>}</Text>
              <TextInput
                style={styles.input}
                placeholder={f.placeholder}
                placeholderTextColor={Colors.textMuted}
                value={f.value}
                onChangeText={f.onChange}
                keyboardType={(f as any).keyboard ?? 'default'}
                autoCapitalize={(f as any).cap ?? (f.label === 'Email' ? 'none' : 'words')}
                secureTextEntry={(f as any).secure}
              />
            </View>
          ))}
          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.link}>Already have an account?  <Text style={styles.linkAccent}>Sign in</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 28, paddingTop: 60 },
  glow: { position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.accentGlow, opacity: 0.45 },
  back: { marginBottom: 36 },
  backText: { fontFamily: Fonts.body, color: Colors.textSecondary, fontSize: 22 },
  header: { marginBottom: 36, gap: 6 },
  title: { fontSize: 38, fontFamily: Fonts.displayBold, color: Colors.text, letterSpacing: -0.5 },
  subtitle: { ...Type.subtitle, fontSize: 16 },
  form: { gap: 16, paddingBottom: 60 },
  errorBox: { backgroundColor: Colors.dangerSubtle, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.danger + '33' },
  errorText: { ...Type.meta, color: Colors.danger },
  fieldWrap: { gap: 8 },
  label: { fontFamily: Fonts.bodySemiBold, color: Colors.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  required: { color: Colors.accent },
  input: { backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15, color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border, fontFamily: Fonts.body },
  btn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 8, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6 },
  btnText: { fontFamily: Fonts.bodySemiBold, color: Colors.white, fontSize: 16, letterSpacing: 0.8 },
  link: { ...Type.link, textAlign: 'center', marginTop: 8 },
  linkAccent: { ...Type.linkAccent },
});
