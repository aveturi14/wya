import { Radius, Space } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';
import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import PressableScale from './PressableScale';

/**
 * A surface block with no outline: it sits on the page by colour in dark and by a
 * soft shadow in light. `tone="alt"` is the grey step used for cards inside sheets.
 * Tappable if onPress is set.
 */
export default function Card({ children, onPress, style, padded = true, raised = true, tone = 'surface', accessibilityLabel }: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  raised?: boolean;
  tone?: 'surface' | 'alt';
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const cardStyle = [styles.card, tone === 'alt' && styles.alt, raised && tone === 'surface' && styles.raised, padded && styles.padded, style];
  if (onPress) {
    return <PressableScale onPress={onPress} style={cardStyle} hoverStyle={styles.hover} scaleTo={0.985} accessibilityLabel={accessibilityLabel}>{children}</PressableScale>;
  }
  return <View style={cardStyle}>{children}</View>;
}

const useStyles = makeStyles((t) => ({
  card: { backgroundColor: t.colors.surface, borderRadius: Radius.lg, overflow: 'hidden' },
  alt: { backgroundColor: t.colors.surfaceAlt },
  raised: t.shadow(4),
  padded: { padding: Space.lg },
  hover: t.isDark ? { backgroundColor: t.colors.surfaceAlt } : t.shadow(8),
}));
