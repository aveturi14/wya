import AuthShell from '@/components/AuthShell';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

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
    <AuthShell
      heading="Welcome"
      accent="back"
      subheading="Sign in to see your plans."
      error={error}
      glow="sunset"
      footer={
        <Button
          title="New here? Create an account"
          variant="ghost"
          onPress={() => router.push({ pathname: '/(auth)/register', params: returnTo ? { returnTo } : {} })}
        />
      }
    >
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      <TextField label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secure autoComplete="current-password" textContentType="password" onSubmitEditing={handleLogin} />
      <View style={{ alignSelf: 'flex-end', marginTop: -4 }}>
        <Button title="Forgot password?" variant="ghost" size="sm" onPress={() => router.push({ pathname: '/(auth)/forgot', params: email ? { email } : {} })} />
      </View>
      <Button title="Sign in" size="lg" onPress={handleLogin} loading={loading} />
    </AuthShell>
  );
}
