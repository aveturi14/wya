import AppTabBar from '@/components/nav/AppTabBar';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  const { theme } = useTheme();
  const { isWide } = useLayout();
  return (
    <Tabs
      // One component draws both the phone bottom bar and the desktop sidebar
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isWide ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
