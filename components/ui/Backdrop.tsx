import { useTheme } from '@/hooks/useTheme';
import { StyleSheet, View } from 'react-native';

/**
 * The soft gradient behind every page (the "mesh" in the theme). Drawn by each
 * page (Screen, TabScreen) rather than once at the root, so screens sliding over
 * each other on phones stay opaque.
 */
export default function Backdrop() {
  const { theme } = useTheme();
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: theme.colors.background, pointerEvents: 'none' },
        theme.gradient(theme.gradients.mesh),
      ]}
    />
  );
}
