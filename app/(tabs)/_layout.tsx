import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

export default function TabsLayout() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.background },
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.outline,
          borderTopWidth: theme.outlineWidth,
          paddingTop: 8,
          height: 72,
        },
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: { fontFamily: Fonts.bodyBold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Events', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarAccessibilityLabel: 'Create event',
          // The main action gets a raised round button in the middle of the bar
          tabBarIcon: () => (
            <View style={{
              width: 54, height: 54, borderRadius: 27, marginTop: 12, backgroundColor: c.primary,
              justifyContent: 'center', alignItems: 'center',
              borderWidth: theme.outlineWidth, borderColor: theme.isDark ? c.primary : c.outline,
              transform: [{ rotate: '-6deg' }],
              ...(theme.isDark ? {} : { boxShadow: `3px 3px 0px ${c.outline}` }),
            }}>
              <Ionicons name="add" size={30} color={c.onPrimary} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'You', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={25} color={color} /> }}
      />
    </Tabs>
  );
}
