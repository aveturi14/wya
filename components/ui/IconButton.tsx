import { Fonts, TOUCH } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import PressableScale from './PressableScale';

/**
 * Round icon button (the Activity bell, back, share) with an optional count badge
 * or dot. `tone`: chip (grey, the default) · glass (see-through, over a poster's glow) ·
 * dark (on photos and the receipt camera).
 */
export default function IconButton({ icon, onPress, label, badge, dot, size = TOUCH, tone = 'chip' }: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  badge?: number;
  dot?: boolean;
  size?: number;
  tone?: 'chip' | 'glass' | 'dark';
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const count = badge && badge > 0 ? (badge > 9 ? '9+' : String(badge)) : null;
  const fg = tone === 'dark' ? theme.colors.onScrim : theme.colors.text;
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.button, styles[tone], { width: size, height: size, borderRadius: size / 2 }]}
      hoverStyle={styles.hover}
      hitSlop={size < TOUCH ? (TOUCH - size) / 2 : undefined}
      accessibilityLabel={count ? `${label}, ${count} unread` : label}
    >
      <Ionicons name={icon} size={Math.round(size * 0.46)} color={fg} />
      {count ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : dot ? <View style={styles.dot} /> : null}
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  button: { justifyContent: 'center', alignItems: 'center' },
  chip: { backgroundColor: t.colors.surfaceAlt },
  glass: { backgroundColor: 'rgba(127, 127, 127, 0.22)' },
  dark: { backgroundColor: t.colors.scrimButton },
  hover: { opacity: 0.85 },
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: t.colors.secondary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: t.colors.background,
  },
  badgeText: { fontFamily: Fonts.bodyBold, fontSize: 11, color: t.colors.onSecondary },
  dot: {
    position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5,
    backgroundColor: t.colors.secondary, borderWidth: 2, borderColor: t.colors.surfaceAlt,
  },
}));
