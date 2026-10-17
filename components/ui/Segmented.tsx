import { Fonts, Radius } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { haptics } from '@/lib/haptics';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import PressableScale from './PressableScale';

/**
 * Pill tabs (Details · Chat · Bills · Photos, Light · Dark · Auto): a grey track with
 * the chosen option raised on the surface colour. `stretch` spreads the options across
 * the full width.
 */
export default function Segmented<T extends string>({ options, value, onChange, stretch, style }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  stretch?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.track, stretch && styles.stretch, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            haptic={false}
            scaleTo={0.98}
            onPress={() => { if (!active) { haptics.select(); onChange(o.value); } }}
            style={[styles.option, stretch && styles.optionStretch, active && styles.active]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.text, { color: active ? theme.colors.text : theme.colors.textSecondary }]} numberOfLines={1}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: Radius.pill,
    padding: 3,
  },
  stretch: { alignSelf: 'stretch' },
  option: { minHeight: 34, paddingHorizontal: 16, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  optionStretch: { flex: 1, paddingHorizontal: 6 },
  active: {
    backgroundColor: t.isDark ? t.colors.chipStrong : t.colors.surface,
    boxShadow: t.isDark ? 'none' : '0px 1px 2px rgba(0, 0, 0, 0.14)',
  },
  text: { fontFamily: Fonts.bodySemiBold, fontSize: 14 },
}));
