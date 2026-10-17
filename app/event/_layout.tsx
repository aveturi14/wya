import { WithTopBar } from '@/components/nav/AppTabBar';
import { useTheme } from '@/hooks/useTheme';
import { Stack } from 'expo-router';

export default function EventLayout() {
  const { theme } = useTheme();
  // Keep the top bar on desktop so event pages don't feel like leaving the app
  return (
    <WithTopBar>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
    </WithTopBar>
  );
}
