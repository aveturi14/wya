import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!fullName || !email || !password) { setError('Please fill in all required fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });
    if (error) { setError(error.message); setLoading(false); return; }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        phone: phone || null,
      });
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join wya and start hosting events</Text>

        <View style={styles.form}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={Colors.textMuted} value={fullName} onChangeText={setFullName} />
          </View>
          <View>
            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View>
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} placeholder="+1 (555) 000-0000" placeholderTextColor={Colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
          <View>
            <Text style={styles.label}>Password *</Text>
            <TextInput style={styles.input} placeholder="At least 6 characters" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.link}>Already have an account? <Text style={styles.linkAccent}>Sign in</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 28, paddingTop: 60 },
  back: { marginBottom: 32 },
  backText: { color: Colors.text, fontSize: 24 },
  title: { fontSize: 32, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 40 },
  form: { gap: 16, paddingBottom: 40 },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
  label: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border },
  btn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: Colors.background, fontSize: 17, fontWeight: '700' },
  link: { color: Colors.textSecondary, textAlign: 'center', fontSize: 14, marginTop: 8 },
  linkAccent: { color: Colors.accent, fontWeight: '600' },
});
