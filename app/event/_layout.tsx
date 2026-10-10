import { StandaloneSidebar } from '@/components/nav/AppTabBar';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';
import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function EventLayout() {
  const { theme } = useTheme();
  const { isWide } = useLayout();
  const stack = <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />;
  // Keep the sidebar on desktop so event pages don't feel like leaving the app
  if (!isWide) return stack;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.colors.background }}>
      <StandaloneSidebar />
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  );
}
