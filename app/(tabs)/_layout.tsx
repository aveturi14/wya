import AppTabBar from '@/components/nav/AppTabBar';
import { useTheme } from '@/hooks/useTheme';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  const { theme } = useTheme();
  return (
    <Tabs
      // One component draws both the phone bottom bar and the desktop top bar; both float over the page
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: 'bottom',
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="photos" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
