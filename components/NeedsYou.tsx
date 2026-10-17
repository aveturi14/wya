import PressableScale from '@/components/ui/PressableScale';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

export type NeedsYouItem = {
  key: string;
  // owe: you owe a host · bill: tick what you had (8.18) · excuse: a guest's excuse to decide on · attendance: mark Who came? · invite: unanswered invite
  kind: 'owe' | 'bill' | 'excuse' | 'attendance' | 'invite';
  title: string;
  subtitle: string;
  action: string;
  onPress: () => void;
};

// The most urgent first, and never a wall of cards
export const NEEDS_YOU_ORDER: NeedsYouItem['kind'][] = ['owe', 'bill', 'excuse', 'attendance', 'invite'];
export const NEEDS_YOU_MAX = 3;

/** Things waiting on you, at the top of Events. Renders nothing when there's nothing to do. */
export default function NeedsYou({ items, heading = true }: { items: NeedsYouItem[]; heading?: boolean }) {
  const { theme } = useTheme();
  const styles = useStyles();
  if (items.length === 0) return null;
  const shown = [...items]
    .sort((a, b) => NEEDS_YOU_ORDER.indexOf(a.kind) - NEEDS_YOU_ORDER.indexOf(b.kind))
    .slice(0, NEEDS_YOU_MAX);
  return (
    <View style={styles.section}>
      {heading && <Text style={theme.type.sectionHeading}>Needs you</Text>}
      {shown.map((item) => <Row key={item.key} item={item} />)}
    </View>
  );
}

function Row({ item }: { item: NeedsYouItem }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  // Money owed stands out in the highlight colour; everything else is a plain card
  const owe = item.kind === 'owe';
  const icon = {
    owe: { name: 'card-outline' as const, bg: c.surface, fg: c.text },
    bill: { name: 'receipt-outline' as const, bg: c.highlight, fg: c.onHighlight },
    excuse: { name: 'chatbox-ellipses-outline' as const, bg: c.secondary, fg: c.onSecondary },
    attendance: { name: 'checkmark-done' as const, bg: c.success, fg: c.onStatus },
    invite: { name: 'mail-outline' as const, bg: c.primary, fg: c.onPrimary },
  }[item.kind];
  const button = {
    owe: { bg: c.text, fg: c.background },
    bill: { bg: c.primary, fg: c.onPrimary },
    excuse: { bg: c.primary, fg: c.onPrimary },
    attendance: { bg: c.background, fg: c.text },
    invite: { bg: c.background, fg: c.text },
  }[item.kind];

  return (
    <PressableScale onPress={item.onPress} scaleTo={0.98} style={[styles.card, owe && styles.cardOwe]} hoverStyle={styles.hover}>
      <View style={[styles.icon, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name} size={18} color={icon.fg} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, owe && { color: c.onHighlight }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[theme.type.caption, owe && styles.subtitleOwe]} numberOfLines={1}>{item.subtitle}</Text>
      </View>
      <PressableScale onPress={item.onPress} style={[styles.button, { backgroundColor: button.bg }]} accessibilityLabel={`${item.action}: ${item.title}`}>
        <Text style={[styles.buttonText, { color: button.fg }]}>{item.action}</Text>
      </PressableScale>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  section: { gap: Space.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md, paddingLeft: 14, paddingRight: Space.md,
    borderRadius: Radius.md + 2, backgroundColor: t.colors.surface, borderWidth: t.outlineWidth, borderColor: t.colors.outline,
    ...t.shadow(3),
  },
  cardOwe: { backgroundColor: t.colors.highlight },
  hover: t.shadow(5),
  icon: {
    width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    borderWidth: t.outlineWidth, borderColor: t.colors.outline,
  },
  text: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontFamily: Fonts.bodyBold, fontSize: 14, lineHeight: 19, color: t.colors.text },
  subtitleOwe: { color: t.colors.onHighlight, opacity: 0.75 },
  button: { paddingVertical: Space.sm, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: t.outlineWidth, borderColor: t.colors.outline },
  buttonText: { fontFamily: Fonts.bodyBold, fontSize: 13 },
}));
