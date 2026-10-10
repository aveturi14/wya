import { useTheme } from '@/hooks/useTheme';
import { Stack } from 'expo-router';

export default function EventLayout() {
  const { theme } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />;
}
