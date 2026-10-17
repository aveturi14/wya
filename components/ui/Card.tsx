import { Radius, Space } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';
import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import PressableScale from './PressableScale';

/** Surface block: chunky ink outline + hard shadow in light, hairline in dark. Tappable if onPress is set. */
export default function Card({ children, onPress, style, padded = true, raised = true }: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  raised?: boolean;
}) {
  const styles = useStyles();
  const cardStyle = [styles.card, raised && styles.raised, padded && styles.padded, style];
  if (onPress) {
    return <PressableScale onPress={onPress} style={cardStyle} hoverStyle={styles.hover} scaleTo={0.98}>{children}</PressableScale>;
  }
  return <View style={cardStyle}>{children}</View>;
}

const useStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: Radius.lg,
    borderWidth: t.outlineWidth,
    borderColor: t.colors.outline,
    overflow: 'hidden',
  },
  raised: t.shadow(4),
  padded: { padding: Space.lg },
  hover: t.shadow(6),
}));
