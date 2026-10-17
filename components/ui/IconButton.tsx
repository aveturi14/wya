import { Fonts } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import PressableScale from './PressableScale';

/** Round frosted button with an icon (the Activity bell, back), with an optional count badge. */
export default function IconButton({ icon, onPress, label, badge, size = 46 }: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  badge?: number;
  size?: number;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const count = badge && badge > 0 ? (badge > 9 ? '9+' : String(badge)) : null;
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.button, { width: size, height: size, borderRadius: size / 2 }]}
      hoverStyle={styles.hover}
      accessibilityLabel={count ? `${label}, ${count} unread` : label}
    >
      <Ionicons name={icon} size={22} color={theme.colors.text} />
      {count && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  button: {
    justifyContent: 'center', alignItems: 'center', ...t.glass,
  },
  hover: { backgroundColor: t.colors.surfaceAlt },
  badge: {
    position: 'absolute', top: -7, right: -7, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: t.colors.secondary, justifyContent: 'center', alignItems: 'center',
    // A ring in the page colour separates the badge from the button's outline
    borderWidth: 2, borderColor: t.colors.background,
  },
  badgeText: { fontFamily: Fonts.bodyBold, fontSize: 11, color: t.colors.onSecondary },
}));
