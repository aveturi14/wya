import { makeStyles } from '@/hooks/useTheme';
import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

// Phones use the full width; on tablets and desktop browsers the app sits in a
// centered column instead of stretching edge to edge
export const MAX_CONTENT_WIDTH = 560;

export default function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={styles.page}>
      <View style={[styles.column, style]}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  page: { flex: 1, backgroundColor: t.colors.background, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH },
}));
