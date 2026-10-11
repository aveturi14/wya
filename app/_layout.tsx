import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { UnreadProvider } from '@/hooks/useUnread';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import { Slot, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Phones: keep the splash up until the fonts are in (see RootLayout)
SplashScreen.preventAutoHideAsync().catch(() => {});

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
  // so hold the splash until the (bundled, near-instant) fonts are ready. The web
  // swaps fonts in by itself, so it never waits. A failed load falls back to system fonts.
  const [loaded, error] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  const ready = loaded || !!error || Platform.OS === 'web';
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;

  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}
