import AuthShell from '@/components/AuthShell';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

export default function LoginScreen() {
  const router = useRouter();
  usePageTitle('Sign in');
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Enter your email and password'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
  };

  return (
    <AuthShell heading="Welcome back" subheading="Sign in to see your plans." error={error}>
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <TextField label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry autoComplete="current-password" onSubmitEditing={handleLogin} />
      <Button title="Sign in" size="lg" onPress={handleLogin} loading={loading} />
      <Button
        title="New here? Create an account"
        variant="ghost"
        onPress={() => router.push({ pathname: '/(auth)/register', params: returnTo ? { returnTo } : {} })}
      />
    </AuthShell>
  );
}
