import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleProp, Text, ViewStyle } from 'react-native';
import PressableScale from './PressableScale';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export default function Button({ title, onPress, variant = 'primary', icon, loading, disabled, size = 'md', style, color }: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  // Override fill and text, e.g. to match an event's theme
  color?: { bg: string; fg: string };
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;

  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.primary, fg: c.onPrimary, border: theme.isDark ? c.primary : c.outline },
    secondary: { bg: c.secondary, fg: c.onSecondary, border: theme.isDark ? c.secondary : c.outline },
    outline: { bg: theme.isDark ? 'transparent' : c.surface, fg: c.text, border: theme.isDark ? c.border : c.outline },
    ghost: { bg: 'transparent', fg: c.textSecondary, border: 'transparent' },
    danger: { bg: theme.isDark ? 'transparent' : c.surface, fg: c.danger, border: c.danger },
  };
  const p = color ? { bg: color.bg, fg: color.fg, border: theme.isDark ? color.bg : c.outline } : palette[variant];
  // Light theme's filled buttons get a hard offset shadow, the Soft pop signature
  const popShadow = !theme.isDark && (variant === 'primary' || variant === 'secondary' || color);

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        styles[size],
        { backgroundColor: p.bg, borderColor: p.border, borderWidth: variant === 'ghost' ? 0 : theme.outlineWidth },
        popShadow && styles.popShadow,
        style,
      ]}
      hoverStyle={variant === 'ghost' ? styles.ghostHover : styles.hover}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={p.fg} />}
          <Text style={[theme.type.button, size === 'sm' && { fontSize: 13 }, { color: p.fg }]}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.sm, borderRadius: Radius.pill },
  sm: { paddingVertical: 8, paddingHorizontal: 14 },
  md: { paddingVertical: 14, paddingHorizontal: 22 },
  lg: { paddingVertical: 18, paddingHorizontal: 28 },
  popShadow: { boxShadow: `3px 3px 0px ${t.colors.outline}` },
  hover: { opacity: 0.9 },
  ghostHover: { backgroundColor: t.colors.surfaceAlt },
}));
