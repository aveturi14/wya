import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

/** A small uppercase pill above a card or a heading ("HOSTING · TOMORROW", "POLL"), with an optional dot. */
export default function Eyebrow({ label, dot, onDark, style }: {
  label: string;
  dot?: string;
  // On a dark photo or the hero card: light text and edge in both themes
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill,
          borderWidth: 1, borderColor: onDark ? c.scrimButton : c.outline,
          backgroundColor: onDark ? c.scrimButton : c.glass,
        },
        style,
      ]}
    >
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />}
      <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: onDark ? c.onScrim : c.textSecondary }}>
        {label}
      </Text>
    </View>
  );
}
