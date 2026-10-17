import DuesPanel from '@/components/dues/DuesPanel';
import { StandaloneSidebar } from '@/components/nav/AppTabBar';
import IconButton from '@/components/ui/IconButton';
import Screen from '@/components/ui/Screen';
import TabScreen from '@/components/ui/TabScreen';
import { Space } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme } from '@/hooks/useTheme';
import { useDues } from '@/lib/dues';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

/**
 * Your dues (Phase 8.18): everything you owe and are owed, across every event,
 * and why. Bills, even splits and pledges, from get_my_dues. Linked from You
 * and from each event's Bills tab.
 */
export default function DuesScreen() {
  const { theme } = useTheme();
  const { isWide } = useLayout();
  const router = useRouter();
  const { dues } = useDues();
  usePageTitle('Your dues');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/account'));

  const page = (
    <TabScreen withTabBar={false} contentContainerStyle={{ padding: Space.xl, gap: Space.lg }}>
      <IconButton icon="arrow-back" label="Back" onPress={goBack} size={44} />
      <View style={{ gap: Space.xs }}>
        <Text style={theme.type.title}>Your dues</Text>
        <Text style={theme.type.bodySecondary}>Who you owe, who owes you, and why. Tap any row to see the items behind it.</Text>
      </View>
      {dues == null
        ? <View style={{ paddingVertical: Space.xxl, alignItems: 'center' }}><ActivityIndicator color={theme.colors.primary} /></View>
        : <DuesPanel dues={dues} />}
      <Text style={theme.type.caption}>wya never touches the money: you pay each other by PayID, then tap "I've paid".</Text>
    </TabScreen>
  );
  return isWide ? <Screen maxWidth={9999} style={{ flexDirection: 'row' }}><StandaloneSidebar />{page}</Screen> : page;
}
