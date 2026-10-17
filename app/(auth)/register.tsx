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
      heading="Make your"
      accent="account"
      subheading={returnTo ? "Takes a minute. Then you're straight back to your invite." : 'Takes a minute. Then you can RSVP, chat and host your own events.'}
      error={error}
      notice={confirmEmailSent ? 'Check your email to confirm your account, then sign in.' : undefined}
      footer={
        <Button
          title="Already have an account? Sign in"
          variant="ghost"
          onPress={() => router.push({ pathname: '/(auth)/login', params: returnTo ? { returnTo } : {} })}
        />
      }
    >
      <TextField label="Your name" value={fullName} onChangeText={setFullName} placeholder="Alex Rivera" autoCapitalize="words" autoComplete="name" textContentType="name" />
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      <TextField label="Password" value={password} onChangeText={setPassword} placeholder="Make one up" secure hint="At least 6 characters" autoComplete="new-password" textContentType="newPassword" />
      <TextField label="Phone" optional value={phone} onChangeText={setPhone} placeholder="+61 4…" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" onSubmitEditing={handleRegister} />
      <Button title="Create account" size="lg" onPress={handleRegister} loading={loading} />
    </AuthShell>
  );
}
