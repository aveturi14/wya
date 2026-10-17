import { Fonts, Radius } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { haptics } from '@/lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleProp, Text, View, ViewStyle } from 'react-native';
import PressableScale from './PressableScale';

/**
 * A small rounded label. With onPress it's a filter chip (`on` fills it with the text
 * colour); without, a static tag ("Dress: sparkly", "Owes $5"). `count` shows after
 * the label, `color` tints the label (status chips).
 */
export default function Chip({ label, count, on, onPress, icon, color, style, accessibilityLabel }: {
  label: string;
  count?: number;
  on?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const fg = on ? theme.colors.background : color ?? theme.colors.textSecondary;
  const body = (
    <>
      {icon && <Ionicons name={icon} size={13} color={fg} />}
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>{label}</Text>
      {count != null && <Text style={[styles.count, { color: fg }]}>{count}</Text>}
    </>
  );
  if (!onPress) return <View style={[styles.chip, on && styles.on, style]}>{body}</View>;
  return (
    <PressableScale
      haptic={false}
      scaleTo={0.97}
      onPress={() => { haptics.select(); onPress(); }}
      style={[styles.chip, styles.tappable, on && styles.on, style]}
      hoverStyle={!on && styles.hover}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!on }}
      accessibilityLabel={accessibilityLabel ?? (count != null ? `${label}, ${count}` : label)}
    >
      {body}
    </PressableScale>
  );
}

/** A row of filter chips that scrolls sideways when it runs out of room. */
export function ChipRow<T extends string>({ options, value, onChange, style }: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={{ gap: 6 }}
      accessibilityRole="tablist"
    >
      {options.map((o) => (
        <Chip key={o.value} label={o.label} count={o.count} on={o.value === value} onPress={() => { if (o.value !== value) onChange(o.value); }} />
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingVertical: 6, paddingHorizontal: 11, borderRadius: Radius.pill, backgroundColor: t.colors.surfaceAlt,
  },
  tappable: { minHeight: 34, paddingHorizontal: 13 },
  on: { backgroundColor: t.colors.text },
  hover: { backgroundColor: t.colors.chipStrong },
  text: { fontFamily: Fonts.bodySemiBold, fontSize: 13 },
  count: { fontFamily: Fonts.mono, fontSize: 12, opacity: 0.75, fontVariant: ['tabular-nums'] },
}));
