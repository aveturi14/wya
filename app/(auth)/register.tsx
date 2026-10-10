import AuthShell from '@/components/AuthShell';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

export default function RegisterScreen() {
  const router = useRouter();
  usePageTitle('Create account');
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) { setError('Fill in your name, email and a password'); return; }
    if (password.length < 6) { setError('Your password needs at least 6 characters'); return; }
    setLoading(true); setError('');
    // The database creates the profile (name, phone) from this metadata in the same step as the account
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone } } });
    setLoading(false);
    if (error) { setError(error.message); return; }
    // No session means email confirmation is on; the root layout navigates once a session exists
    if (!data.session) setConfirmEmailSent(true);
  };

  return (
    <AuthShell
      heading="Join the party"
      subheading="Create an account to RSVP, chat, and host your own events."
      error={error}
      notice={confirmEmailSent ? 'Check your email to confirm your account, then sign in.' : undefined}
    >
      <TextField label="Your name" required value={fullName} onChangeText={setFullName} placeholder="Alex Rivera" autoCapitalize="words" autoComplete="name" />
      <TextField label="Email" required value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <TextField label="Phone" value={phone} onChangeText={setPhone} placeholder="+1 555 000 0000" keyboardType="phone-pad" autoComplete="tel" />
      <TextField label="Password" required value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry autoComplete="new-password" onSubmitEditing={handleRegister} />
      <Button title="Create account" size="lg" onPress={handleRegister} loading={loading} />
      <Button
        title="Already have an account? Sign in"
        variant="ghost"
        onPress={() => router.push({ pathname: '/(auth)/login', params: returnTo ? { returnTo } : {} })}
      />
    </AuthShell>
  );
}
