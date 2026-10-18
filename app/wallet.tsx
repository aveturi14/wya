import { WithTopBar } from '@/components/nav/AppTabBar';
import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import IconButton from '@/components/ui/IconButton';
import { IconSquare, ListGroup } from '@/components/ui/ListRow';
import Money from '@/components/ui/Money';
import Sheet from '@/components/ui/Sheet';
import TabScreen from '@/components/ui/TabScreen';
import AddCardForm from '@/components/wallet/AddCardForm';
import CashOutPanel from '@/components/wallet/CashOutPanel';
import TopUpPanel from '@/components/wallet/TopUpPanel';
import { BalanceCard, MethodArt } from '@/components/wallet/WalletArt';
import { Fonts, Space } from '@/constants/theme';
import { APPLE_PAY_BUTTON, WALLET_CARD } from '@/constants/wallet';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { confirmAction, showError } from '@/lib/alert';
import { friendlyError } from '@/lib/errors';
import { billMoney } from '@/lib/receipts';
import { addApplePay, removeMethod, setDefaultMethod, useWallet, WalletMethod } from '@/lib/wallet';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

/**
 * Your wallet (9.13): the balance, topping up, your saved ways to pay and every
 * movement. A test balance for now: cards and Apple Pay are a proof of concept
 * and nothing is charged. Paying a share happens from the bill (PaySheet).
 */
export default function WalletScreen() {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { wallet, error, reload } = useWallet();
  const [sheet, setSheet] = useState<'topup' | 'card' | 'cashout' | null>(null);
  const [topUpWith, setTopUpWith] = useState<string | undefined>(undefined);
  usePageTitle('Your wallet');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/account'));

  const addApple = async () => {
    try { await addApplePay(); reload(); } catch (e) { showError("Couldn't add Apple Pay", e); }
  };
  // "Add money with Apple Pay": set it up if needed, then straight to the amount
  const topUpWithApplePay = async () => {
    try {
      const id = wallet?.methods.find((m) => m.kind === 'apple_pay')?.id ?? await addApplePay();
      await reload();
      setTopUpWith(id);
      setSheet('topup');
    } catch (e) { showError("Couldn't start Apple Pay", e); }
  };
  const remove = async (m: WalletMethod) => {
    if (!(await confirmAction(`Remove ${m.label}?`, 'You can add it again any time.', 'Remove', true))) return;
    try { await removeMethod(m.id); reload(); } catch (e) { showError("Couldn't remove it", e); }
  };
  const makeDefault = async (m: WalletMethod) => {
    try { await setDefaultMethod(m.id); reload(); } catch (e) { showError("Couldn't change it", e); }
  };

  let body;
  if (!wallet && error) {
    body = <EmptyState icon="cloud-offline-outline" title="Couldn't open your wallet" body={friendlyError(error)}
      action={<Button title="Try again" icon="refresh" variant="soft" onPress={reload} />} />;
  } else if (!wallet) {
    body = <View style={{ paddingVertical: Space.xxl, alignItems: 'center' }}><ActivityIndicator color={theme.colors.textSecondary} /></View>;
  } else {
    const hasApple = wallet.methods.some((m) => m.kind === 'apple_pay');
    body = (
      <>
        <BalanceCard cents={wallet.balance_cents} testMode={wallet.test_mode}>
          <View style={styles.balanceButtons}>
            <Button title="Add money" icon="add" color={{ bg: WALLET_CARD.onInk, fg: WALLET_CARD.ink }} onPress={() => { setTopUpWith(undefined); setSheet('topup'); }} style={{ flex: 1 }} />
            <Button title="Cash out" icon="arrow-down" variant="ghost" color={{ bg: 'transparent', fg: WALLET_CARD.onInk }} onPress={() => setSheet('cashout')} disabled={wallet.balance_cents < 100} style={{ flex: 1 }} />
          </View>
          <Text style={styles.balanceNote}>Every bill and pledge is paid from here, with one tap. Cash out takes your money back out any time.</Text>
        </BalanceCard>

        <View style={styles.section}>
          <Text style={theme.type.label}>Add money</Text>
          <View style={styles.addRow}>
            <Button title="Add with Apple Pay" icon="logo-apple" color={APPLE_PAY_BUTTON} onPress={topUpWithApplePay} style={styles.addButton} />
            <Button title="Add with a card" icon="card-outline" variant="soft" onPress={() => {
              const card = wallet.methods.find((m) => m.kind === 'card');
              if (card) { setTopUpWith(card.id); setSheet('topup'); } else setSheet('card');
            }} style={styles.addButton} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={theme.type.label}>Your cards and Apple Pay</Text>
          {wallet.methods.length > 0 && (
            <ListGroup>
              {wallet.methods.map((m) => (
                <View key={m.id} style={styles.methodRow}>
                  <MethodArt applePay={m.kind === 'apple_pay'} brand={m.brand} size="sm" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={theme.type.value} numberOfLines={1}>{m.label}</Text>
                    <Text style={theme.type.caption}>
                      {m.kind === 'card' ? `Expires ${String(m.exp_month).padStart(2, '0')}/${String(m.exp_year).slice(2)}` : 'On this device'}
                      {m.is_default ? ' · Default' : ''}
                    </Text>
                  </View>
                  {!m.is_default && <Button title="Make default" size="sm" variant="ghost" onPress={() => makeDefault(m)} />}
                  <IconButton icon="trash-outline" label={`Remove ${m.label}`} onPress={() => remove(m)} size={36} />
                </View>
              ))}
            </ListGroup>
          )}
          <View style={styles.addRow}>
            {!hasApple && <Button title="Add Apple Pay" icon="logo-apple" color={APPLE_PAY_BUTTON} onPress={addApple} style={styles.addButton} />}
            <Button title="Add a card" icon="card-outline" variant="soft" onPress={() => setSheet('card')} style={styles.addButton} />
          </View>
          <Text style={theme.type.caption}>Proof of concept: nothing is charged. wya keeps only a card's brand, last 4 digits and expiry.</Text>
        </View>

        <View style={styles.section}>
          <Text style={theme.type.label}>Activity</Text>
          {wallet.activity.length === 0 ? (
            <Card><Text style={theme.type.bodySecondary}>No movements yet. Top up, then pay your share of a bill from here.</Text></Card>
          ) : (
            <ListGroup>
              {wallet.activity.map((a) => (
                <View key={`${a.id}-${a.direction}`} style={styles.activityRow}>
                  {a.other_id
                    ? <Avatar name={a.other_name} seed={a.other_id} size={34} />
                    : <IconSquare icon={a.kind === 'topup' ? 'add' : a.kind === 'cashout' ? 'arrow-down' : 'swap-horizontal'} />}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={theme.type.value} numberOfLines={1}>{a.title}</Text>
                    <Text style={theme.type.caption} numberOfLines={1}>
                      {[a.subtitle, format(new Date(a.created_at), 'EEE d MMM, h:mm a')].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Money value={`${a.amount_cents > 0 ? '+' : '−'}${billMoney(Math.abs(a.amount_cents))}`} tone={a.amount_cents > 0 ? 'success' : 'text'} />
                </View>
              ))}
            </ListGroup>
          )}
        </View>

        <Card style={{ gap: Space.xs }}>
          <Text style={theme.type.value}>How paying works</Text>
          <Text style={theme.type.caption}>
            When a bill is locked, Pay takes exactly your share and sends it to the person who paid. Nobody else can pay it,
            it can't be a different amount, and it can't happen twice. Nothing moves until you tap Pay.
          </Text>
        </Card>
      </>
    );
  }

  return (
    <WithTopBar>
      <TabScreen withTabBar={false} contentContainerStyle={styles.content}>
        <View style={{ alignSelf: 'flex-start' }}><IconButton icon="chevron-back" label="Back" onPress={goBack} /></View>
        <Text style={theme.type.title} accessibilityRole="header">Your <Text style={{ fontFamily: Fonts.serif, fontSize: 31 }}>wallet</Text></Text>
        {body}
      </TabScreen>

      <Sheet visible={sheet === 'topup'} onClose={() => setSheet(null)} title="Add money">
        {wallet && sheet === 'topup' && (
          <TopUpPanel wallet={wallet} initialMethodId={topUpWith} onChanged={reload} onDone={() => { reload(); setSheet(null); }} onCancel={() => setSheet(null)} />
        )}
      </Sheet>
      <Sheet visible={sheet === 'cashout'} onClose={() => setSheet(null)} title="Cash out">
        {wallet && sheet === 'cashout' && (
          <CashOutPanel wallet={wallet} onDone={() => { reload(); setSheet(null); }} onCancel={() => setSheet(null)} onAddMethod={() => setSheet('card')} />
        )}
      </Sheet>
      <Sheet visible={sheet === 'card'} onClose={() => setSheet(null)} title="Add a card">
        {sheet === 'card' && <AddCardForm onAdded={() => { reload(); setSheet(null); }} onCancel={() => setSheet(null)} />}
      </Sheet>
    </WithTopBar>
  );
}

const useStyles = makeStyles((t) => ({
  content: { paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.lg },
  balanceButtons: { flexDirection: 'row', gap: Space.sm },
  balanceNote: { fontFamily: Fonts.body, fontSize: 12, color: WALLET_CARD.onInkSoft },
  section: { gap: Space.sm },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.sm, paddingHorizontal: Space.md },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 10, paddingHorizontal: Space.md },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  addButton: { flexGrow: 1, flexBasis: 160 },
}));
