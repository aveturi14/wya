import { StandaloneSidebar } from '@/components/nav/AppTabBar';
import PayCard from '@/components/pledges/PayCard';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Sticker from '@/components/ui/Sticker';
import IconButton from '@/components/ui/IconButton';
import Screen from '@/components/ui/Screen';
import TabScreen from '@/components/ui/TabScreen';
import { Space } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { useObligations } from '@/hooks/useObligations';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/pledges';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

/**
 * https://wya.expo.app/pay/<debt id> (Phase 8.3): one place to pay someone back,
 * linked from a split card, Needs you and Activity. Needs sign-in as the person
 * who owes (logged-out visitors are sent to sign in and come back here); the
 * PayID comes from get_payment_instructions, which only answers that person.
 */
export default function PayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { isWide } = useLayout();
  const router = useRouter();
  const { obligations, loaded, reload } = useObligations();
  const debt = obligations.find((o) => o.id === id && o.role === 'guest');
  const who = debt?.other_name?.split(' ')[0] ?? 'them';
  usePageTitle(debt ? `Pay ${who} ${formatMoney(debt.amount_cents)}` : 'Pay');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'));

  let body;
  if (!loaded) {
    body = <View style={{ paddingVertical: Space.xxxl, alignItems: 'center' }}><ActivityIndicator color={theme.colors.primary} size="large" /></View>;
  } else if (!debt) {
    body = (
      <EmptyState
        icon="wallet-outline"
        title="Nothing to pay here"
        body="This link isn't for you, or it's already been dealt with."
        action={<Button title="Go home" onPress={() => router.replace('/(tabs)/home')} />}
      />
    );
  } else if (debt.status === 'paid') {
    body = <EmptyState icon="checkmark-circle-outline" title="Paid" body={`You told ${who} you've paid ${formatMoney(debt.amount_cents)}. Thanks for settling up.`} />;
  } else if (debt.status === 'waived') {
    body = <EmptyState icon="heart-outline" title="Nothing owed" body={`${who} let you off ${formatMoney(debt.amount_cents)}.`} />;
  } else {
    body = <PayCard obligation={debt} onChange={reload} />;
  }

  const page = (
    <TabScreen withTabBar={false} contentContainerStyle={{ padding: Space.xl, gap: Space.xl }}>
      <IconButton icon="arrow-back" label="Back" onPress={goBack} size={44} />
      {debt && (
        <View style={{ gap: Space.sm }}>
          <Sticker label={(debt.kind === 'split' ? `Split · ${debt.event_title}` : `Pledge · ${debt.event_title}`).toUpperCase()} bg={theme.colors.secondary} fg={theme.colors.onSecondary} tilt={-2} style={{ alignSelf: 'flex-start' }} />
          <Text style={theme.type.bodySecondary}>
            wya never touches the money: you pay {who} straight from your banking app, then tap "I've paid".
          </Text>
        </View>
      )}
      {body}
      {debt && <Button title="Open the event" variant="ghost" onPress={() => router.push(`/event/${debt.event_id}`)} style={{ alignSelf: 'flex-start' }} />}
    </TabScreen>
  );

  // Desktop keeps the rail, like event pages and Activity
  return isWide ? <Screen maxWidth={9999} style={{ flexDirection: 'row' }}><StandaloneSidebar />{page}</Screen> : page;
}
