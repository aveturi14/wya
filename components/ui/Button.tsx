import { Radius, Space, TOUCH } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleProp, Text, ViewStyle } from 'react-native';
import PressableScale from './PressableScale';

// primary: the text colour as a pill (white in dark, black in light) · soft: a grey chip ·
// line: a hairline outline · danger: outlined in red · ghost: text only.
// `secondary` and `outline` are the pre-Phase 9 names for soft and line.
type Variant = 'primary' | 'soft' | 'line' | 'danger' | 'ghost' | 'secondary' | 'outline';

export default function Button({ title, onPress, variant = 'primary', icon, loading, disabled, size = 'md', style, color, accessibilityLabel }: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  // sm: a compact pill in rows · md: 44pt, the default · lg: 52pt for the one big action on a page
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  // Fill and text in the event's colour (RSVP and pay buttons)
  color?: { bg: string; fg: string };
  accessibilityLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;

  const v = variant === 'secondary' ? 'soft' : variant === 'outline' ? 'line' : variant;
  const palette: Record<typeof v, { bg: string; fg: string; edge?: string }> = {
    primary: { bg: c.primary, fg: c.onPrimary },
    soft: { bg: c.surfaceAlt, fg: c.text },
    line: { bg: 'transparent', fg: c.text, edge: c.lineStrong },
    danger: { bg: 'transparent', fg: c.dangerText, edge: c.dangerText },
    ghost: { bg: 'transparent', fg: c.textSecondary },
  };
  const p = color ? { bg: color.bg, fg: color.fg, edge: undefined } : palette[v];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel}
      hitSlop={size === 'sm' ? 6 : undefined}
      style={[
        styles.base,
        styles[size],
        { backgroundColor: p.bg },
        p.edge && { borderWidth: 1, borderColor: p.edge },
        style,
      ]}
      hoverStyle={v === 'ghost' || v === 'line' || v === 'danger' ? styles.ghostHover : styles.hover}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 14 : 17} color={p.fg} />}
          <Text style={[theme.type.button, size === 'sm' && styles.smText, { color: p.fg }]} numberOfLines={1}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.sm - 2, borderRadius: Radius.pill },
  sm: { minHeight: 32, paddingVertical: 6, paddingHorizontal: 13 },
  md: { minHeight: TOUCH, paddingHorizontal: 18 },
  lg: { minHeight: 52, paddingHorizontal: 22 },
  smText: { fontSize: 13 },
  hover: { opacity: 0.88 },
  ghostHover: { backgroundColor: t.colors.surfaceAlt },
}));
