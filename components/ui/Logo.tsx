import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Text } from 'react-native';

/** The "wya." wordmark; the dot takes the secondary accent. */
export default function Logo({ size = 28 }: { size?: number }) {
  const { theme } = useTheme();
  return (
    <Text style={{ fontFamily: Fonts.display, fontSize: size, lineHeight: size * 1.05, letterSpacing: -size * 0.05, color: theme.isDark ? theme.colors.primary : theme.colors.text }}>
      wya<Text style={{ color: theme.colors.secondary }}>.</Text>
    </Text>
  );
}
