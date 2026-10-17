import AuthShell from '@/components/AuthShell';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { usePageTitle } from '@/hooks/usePageTitle';
import { webUrl } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

/**
 * Forgot password: Supabase emails a reset link that opens /reset-password on the web
 * app (the Site URL redirect allows https://wya.expo.app/**), where you pick a new one.
 */
export default function ForgotScreen() {
  usePageTitle('Reset your password');
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!email.includes('@')) { setError('Enter the email you signed up with'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: webUrl('reset-password') });
    setLoading(false);
    if (error) { setError(error.message); return; }
    // Said the same way whether or not there's an account, so the page can't be used to check emails
    setSent(true);
  };

  return (
    <AuthShell
      heading="Forgot your"
      accent="password?"
      subheading="We'll email you a link to pick a new one."
      error={error}
      notice={sent ? `If ${email.trim()} has a wya account, a reset link is on its way. It works once, for an hour.` : undefined}
    >
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" onSubmitEditing={send} />
      <Button title={sent ? 'Send it again' : 'Send reset link'} size="lg" variant={sent ? 'soft' : 'primary'} onPress={send} loading={loading} />
    </AuthShell>
  );
}
