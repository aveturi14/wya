import AuthShell from '@/components/AuthShell';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Where the reset email lands (outside the (auth) group, so the signed-in redirect
 * leaves it alone). The link carries a short-lived recovery session in the URL
 * fragment; the client doesn't read URLs by itself (detectSessionInUrl is off), so
 * this page hands it over, then sets the new password.
 */
export default function ResetPasswordScreen() {
  usePageTitle('Pick a new password');
  const router = useRouter();
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') { setChecked(true); return; }
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    const linkError = hash.get('error_description');
    // Don't leave the tokens sitting in the address bar or history
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    if (linkError) { setError(linkError); setChecked(true); return; }
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error: e }) => {
        if (e) setError('This link has expired or was already used. Ask for a new one.');
        setChecked(true);
      });
    } else {
      setChecked(true);
    }
  }, []);

  const save = async () => {
    if (password.length < 6) { setError('Your password needs at least 6 characters'); return; }
    setLoading(true); setError('');
    const { error: e } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (e) { setError(e.message); return; }
    router.replace('/(tabs)/home');
  };

  const noLink = checked && !session;
  return (
    <AuthShell
      heading="Pick a new"
      accent="password"
      subheading={noLink ? 'Open the link from your reset email on this device, or ask for a new one.' : "Then you're straight back to your plans."}
      error={error}
    >
      {noLink ? (
        <Button title="Send a new link" size="lg" onPress={() => router.replace('/(auth)/forgot')} />
      ) : (
        <>
          <TextField label="New password" value={password} onChangeText={setPassword} placeholder="Make one up" secure hint="At least 6 characters" autoComplete="new-password" textContentType="newPassword" onSubmitEditing={save} />
          <Button title="Save and sign in" size="lg" onPress={save} loading={loading} disabled={!checked} />
        </>
      )}
    </AuthShell>
  );
}
