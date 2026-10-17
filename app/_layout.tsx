import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { UnreadProvider } from '@/hooks/useUnread';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import { Stack, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Phones: keep the splash up until the fonts are in (see RootLayout)
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  const { theme } = useTheme();
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const params = useGlobalSearchParams<{ returnTo?: string; id?: string }>();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inInviteGroup = segments[0] === 'invite';
    if (!session && segments[0] === 'pay') {
      // Pay links (8.3) come back here after signing in
      const id = Array.isArray(params.id) ? params.id[0] : params.id;
      router.replace({ pathname: '/(auth)/login', params: { returnTo: `/pay/${id ?? ''}` } });
    } else if (!session && !inAuthGroup && !inInviteGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
      router.replace((returnTo as any) ?? '/(tabs)/home');
    }
  }, [session, loading, segments]);

  // A stack (not a bare Slot) so pages opened from the tabs, like Activity and
  // events, slide in on phones and can be swiped back
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />;
}

function ThemedRoot() {
  const { theme } = useTheme();

  // Keeps the area behind the app (and the web page) in the theme's background
  useEffect(() => { SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {}); }, [theme]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <AuthProvider>
        <UnreadProvider>
          <RootLayoutNav />
        </UnreadProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  // On phones, text drawn before its font has loaded keeps the system font for good,
  // so hold the splash until the (bundled, near-instant) fonts are ready. The web waits
  // too (otherwise it flashes Times New Roman first), but never more than 3 seconds.
  // A failed or slow load falls back to system fonts.
  const [webGaveUp, setWebGaveUp] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const t = setTimeout(() => setWebGaveUp(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const [loaded, error] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  const ready = loaded || !!error || webGaveUp;
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;

  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}
