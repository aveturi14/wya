import Sticker from '@/components/ui/Sticker';
import { Fonts, Radius, Space } from '@/constants/theme';
import { BRAND_ART, WALLET_CARD } from '@/constants/wallet';
import { makeStyles } from '@/hooks/useTheme';
import { gradient } from '@/lib/gradient';
import { billMoney } from '@/lib/receipts';
import { brandName, CardBrand } from '@/lib/wallet';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

/** The wallet's balance as a card (dark in both themes), with room for actions underneath. */
export function BalanceCard({ cents, testMode, children, compact, style }: {
  cents: number; testMode: boolean; children?: ReactNode; compact?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.balance, gradient(WALLET_CARD.gradient), compact && styles.balanceCompact, style]}>
      <View style={styles.balanceTop}>
        <Text style={styles.brand}>wya wallet</Text>
        {testMode && <Sticker label="test balance" size="sm" />}
      </View>
      <View style={{ gap: 2 }}>
        <Text style={styles.label}>Balance</Text>
        <Text style={[styles.amount, compact && { fontSize: 30, lineHeight: 34 }]} numberOfLines={1} adjustsFontSizeToFit>
          {billMoney(cents)}
        </Text>
      </View>
      {children}
    </View>
  );
}

/** A saved card or Apple Pay, drawn like the real thing. Shows only what's saved: brand, last 4, expiry. */
export function MethodArt({ brand, last4, expiry, name, applePay, size = 'md' }: {
  brand?: CardBrand | null; last4?: string | null; expiry?: string | null; name?: string | null; applePay?: boolean; size?: 'sm' | 'md';
}) {
  const styles = useStyles();
  const art = BRAND_ART[applePay ? 'apple_pay' : brand ?? 'card'];
  if (size === 'sm') {
    return (
      <View style={[styles.mini, gradient(art.gradient)]} accessibilityElementsHidden>
        {applePay
          ? <Ionicons name="logo-apple" size={14} color={art.ink} />
          : <Text style={[styles.miniText, { color: art.ink }]}>{brandName(brand ?? 'card').slice(0, 4).toUpperCase()}</Text>}
      </View>
    );
  }
  return (
    <View style={[styles.card, gradient(art.gradient)]}>
      <View style={styles.cardTop}>
        <Ionicons name={applePay ? 'logo-apple' : 'card-outline'} size={22} color={art.ink} />
        <Text style={[styles.cardBrand, { color: art.ink }]}>{applePay ? 'Pay' : brandName(brand ?? 'card')}</Text>
      </View>
      <Text style={[styles.cardNumber, { color: art.ink }]}>{applePay ? 'Apple Pay' : `•••• •••• •••• ${last4 || '••••'}`}</Text>
      <View style={styles.cardFoot}>
        <Text style={[styles.cardSmall, { color: art.ink }]} numberOfLines={1}>{name || (applePay ? 'Device card' : 'Card holder')}</Text>
        {!applePay && <Text style={[styles.cardSmall, { color: art.ink }]}>{expiry || 'MM/YY'}</Text>}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  balance: { borderRadius: Radius.xl, padding: Space.xl, gap: Space.lg, overflow: 'hidden', backgroundColor: WALLET_CARD.ink },
  balanceCompact: { padding: Space.lg, gap: Space.md },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: Fonts.serif, fontSize: 22, color: WALLET_CARD.onInk },
  label: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: WALLET_CARD.onInkSoft },
  amount: { fontFamily: Fonts.mono, fontSize: 44, lineHeight: 50, letterSpacing: -1.2, color: WALLET_CARD.onInk, fontVariant: ['tabular-nums'] },
  card: { width: '100%', maxWidth: 360, aspectRatio: 1.586, borderRadius: Radius.lg, padding: Space.lg, justifyContent: 'space-between', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardBrand: { fontFamily: Fonts.bodyBold, fontSize: 16, fontStyle: 'italic' },
  cardNumber: { fontFamily: Fonts.mono, fontSize: 18, letterSpacing: 1 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: Space.md },
  cardSmall: { fontFamily: Fonts.bodyMedium, fontSize: 12, opacity: 0.85, textTransform: 'uppercase', flexShrink: 1 },
  mini: { width: 40, height: 26, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  miniText: { fontFamily: Fonts.bodyBold, fontSize: 9, letterSpacing: 0.5 },
}));
