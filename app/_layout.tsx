import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';
import { Slot, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const params = useGlobalSearchParams<{ returnTo?: string }>();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inInviteGroup = segments[0] === 'invite';
    if (!session && !inAuthGroup && !inInviteGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
      router.replace((returnTo as any) ?? '/(tabs)/home');
    }
  }, [session, loading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  // Load fonts but never block rendering — fall back to system fonts if loading fails
  useFonts({
    'CormorantGaramond-Regular': require('../assets/fonts/CormorantGaramond-Regular.ttf'),
    'CormorantGaramond-Bold': require('../assets/fonts/CormorantGaramond-Bold.ttf'),
    'CormorantGaramond-Italic': require('../assets/fonts/CormorantGaramond-Italic.ttf'),
    'Raleway-Regular': require('../assets/fonts/Raleway-Regular.ttf'),
    'Raleway-Medium': require('../assets/fonts/Raleway-Medium.ttf'),
    'Raleway-SemiBold': require('../assets/fonts/Raleway-SemiBold.ttf'),
    'Raleway-Bold': require('../assets/fonts/Raleway-Bold.ttf'),
  });

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar style="light" />
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
