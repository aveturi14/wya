import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

/** A small pill label, optionally tilted like a sticker slapped on. */
export default function Sticker({ label, bg, fg, tilt = 0, style }: {
  label: string;
  bg?: string;
  fg?: string;
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: bg ?? theme.colors.highlight,
          borderRadius: Radius.pill,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderWidth: theme.isDark ? 0 : 1.5,
          borderColor: theme.colors.outline,
          transform: tilt ? [{ rotate: `${tilt}deg` }] : undefined,
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 11, letterSpacing: 0.3, color: fg ?? theme.colors.onHighlight }}>{label}</Text>
    </View>
  );
}
