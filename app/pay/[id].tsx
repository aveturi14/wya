import { WithTopBar } from '@/components/nav/AppTabBar';
import PayCard from '@/components/pledges/PayCard';
import Card from '@/components/ui/Card';
import Money from '@/components/ui/Money';
import PaySheet, { payTargetFromObligation } from '@/components/wallet/PaySheet';
import { useDues } from '@/lib/dues';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import IconButton from '@/components/ui/IconButton';
import TabScreen from '@/components/ui/TabScreen';
import { Space } from '@/constants/theme';
import { useObligations } from '@/hooks/useObligations';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/pledges';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

/**
 * https://wya.expo.app/pay/<debt id>: one place to pay someone back, linked from
 * bills, Needs you and Activity. Needs sign-in as the person who owes (logged-out
 * visitors sign in and come back here). Bill and split shares are paid from the
 * wya wallet (9.13); pledges can use the wallet or PayID.
 */
export default function PayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const { obligations, loaded, reload } = useObligations();
  const debt = obligations.find((o) => o.id === id && o.role === 'guest');
  // The dues row has the items behind a bill share, for the confirm sheet
  const { dues, reload: reloadDues } = useDues(debt?.event_id, 0);
  const due = dues?.find((d) => d.obligation_id === id) ?? null;
  const [paying, setPaying] = useState(false);
  const who = debt?.other_name?.split(' ')[0] ?? 'them';
  usePageTitle(debt ? `Pay ${who} ${formatMoney(debt.amount_cents)}` : 'Pay');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'));

  let body;
  if (!loaded) {
    body = <View style={{ paddingVertical: Space.xxxl, alignItems: 'center' }}><ActivityIndicator color={theme.colors.textSecondary} size="large" /></View>;
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
    body = <EmptyState icon="checkmark-circle-outline" title="Paid" body={debt.paid_via === 'wallet'
      ? `You paid ${who} ${formatMoney(debt.amount_cents)} from your wallet. ${who} has it.`
      : `You told ${who} you've paid ${formatMoney(debt.amount_cents)}. Thanks for settling up.`} />;
  } else if (debt.status === 'waived') {
    body = <EmptyState icon="heart-outline" title="Nothing owed" body={`${who} let you off ${formatMoney(debt.amount_cents)}.`} />;
  } else if (debt.kind === 'split') {
    // Bills are wallet only: the exact share, to the person who paid, with a confirm step
    body = (
      <Card style={{ gap: Space.md, alignItems: 'center' }}>
        <Text style={theme.type.label}>You owe {who}</Text>
        <Money cents={debt.amount_cents} size={40} />
        <Text style={[theme.type.caption, { textAlign: 'center' }]}>
          {debt.status === 'disputed' ? `${who} hasn't received it yet. ` : ''}Your share of {debt.description ?? 'a bill'} at {debt.event_title}.
        </Text>
        <Button title={`Pay ${who} from your wallet`} icon="wallet-outline" onPress={() => setPaying(true)} style={{ alignSelf: 'stretch' }} />
      </Card>
    );
  } else {
    body = <PayCard obligation={debt} onChange={reload} />;
  }

  const page = (
    <TabScreen withTabBar={false} contentContainerStyle={{ paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.lg }}>
      <View style={{ alignSelf: 'flex-start' }}><IconButton icon="chevron-back" label="Back" onPress={goBack} /></View>
      {debt && (
        <View style={{ gap: Space.xs }}>
          <Text style={theme.type.label}>{debt.kind === 'split' ? 'Split' : 'Pledge'} · {debt.event_title}</Text>
          <Text style={theme.type.caption}>
            Paid from your wya wallet, straight to {who}: one tap, exactly what you owe. Test balance for now: no real money moves.
          </Text>
        </View>
      )}
      {body}
      {debt && <Button title="Open the event" variant="ghost" onPress={() => router.push(`/event/${debt.event_id}`)} style={{ alignSelf: 'flex-start' }} />}
      <PaySheet
        target={paying && debt ? payTargetFromObligation(debt, due) : null}
        onClose={() => setPaying(false)}
        onPaid={() => { reload(); reloadDues(); }}
      />
    </TabScreen>
  );

  // Desktop keeps the rail, like event pages and Activity
  return <WithTopBar>{page}</WithTopBar>;
}
