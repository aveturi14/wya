import DuesPanel from '@/components/dues/DuesPanel';
import { WithTopBar } from '@/components/nav/AppTabBar';
import IconButton from '@/components/ui/IconButton';
import TabScreen from '@/components/ui/TabScreen';
import { Fonts, Space } from '@/constants/theme';
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
  const router = useRouter();
  const { dues } = useDues();
  usePageTitle('Your dues');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/account'));

  const page = (
    <TabScreen withTabBar={false} contentContainerStyle={{ paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.lg }}>
      <View style={{ alignSelf: 'flex-start' }}><IconButton icon="chevron-back" label="Back" onPress={goBack} /></View>
      <View style={{ gap: Space.xs }}>
        <Text style={theme.type.title} accessibilityRole="header">Your <Text style={{ fontFamily: Fonts.serif, fontSize: 31 }}>dues</Text></Text>
        <Text style={theme.type.bodySecondary}>Who you owe, who owes you, and why. Tap any row to see the items behind it.</Text>
      </View>
      {dues == null
        ? <View style={{ paddingVertical: Space.xxl, alignItems: 'center' }}><ActivityIndicator color={theme.colors.textSecondary} /></View>
        : <DuesPanel dues={dues} />}
      <Text style={theme.type.caption}>wya never touches the money: you pay each other by PayID, then tap "I've paid".</Text>
    </TabScreen>
  );
  return <WithTopBar>{page}</WithTopBar>;
}
