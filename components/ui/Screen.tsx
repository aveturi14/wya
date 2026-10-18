import { makeStyles } from '@/hooks/useTheme';
import { ReactNode } from 'react';
import { GlowProps, PosterGlow } from './Poster';
import { StyleProp, View, ViewStyle } from 'react-native';

// Phones use the full width; on tablets and desktop browsers the app sits in a
// centered column instead of stretching edge to edge
export const MAX_CONTENT_WIDTH = 560;

// Multi-column desktop screens (home grid, two-column event page) use the wider cap.
// Big monitors get more room; the gutters come from the pages' own padding.
export const MAX_WIDE_CONTENT_WIDTH = 1440;

export default function Screen({ children, style, maxWidth = MAX_CONTENT_WIDTH, glow }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
  // The poster glow behind the whole window (outside the centred column)
  glow?: GlowProps | null;
}) {
  const styles = useStyles();
  return (
    <View style={styles.page}>
      {glow && <PosterGlow fill {...glow} />}
      <View style={[styles.column, { maxWidth }, style]}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  page: { flex: 1, backgroundColor: t.colors.background, alignItems: 'center' },
  column: { flex: 1, width: '100%' },
}));
