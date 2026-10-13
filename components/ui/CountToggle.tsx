import { Fonts, Radius } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { haptics } from '@/lib/haptics';
import { Text, View } from 'react-native';
import PressableScale from './PressableScale';

/**
 * A row of chips that switch between lists, each with its count
 * (Invited / Hosting). Compact on purpose: the page title handles Upcoming / Past.
 */
export default function CountToggle<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; count: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            haptic={false}
            scaleTo={0.98}
            onPress={() => { if (!active) { haptics.select(); onChange(o.value); } }}
            style={[styles.option, active && styles.active]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${o.label}, ${o.count}`}
          >
            <Text style={[styles.text, { color: active ? c.background : c.textSecondary }]}>{o.label}</Text>
            <View style={[styles.count, active && styles.countActive]}>
              <Text style={[styles.countText, { color: active ? c.onHighlight : c.textSecondary }]}>{o.count}</Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  track: { flexDirection: 'row', gap: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 14, borderRadius: Radius.pill,
    borderWidth: t.outlineWidth, borderColor: t.colors.outline,
  },
  active: { backgroundColor: t.colors.text, borderColor: t.colors.text },
  text: { fontFamily: Fonts.bodyBold, fontSize: 14 },
  count: { minWidth: 22, paddingHorizontal: 7, paddingVertical: 1, borderRadius: Radius.pill, backgroundColor: t.colors.surfaceAlt, alignItems: 'center' },
  countActive: { backgroundColor: t.colors.highlight },
  countText: { fontFamily: Fonts.bodyBold, fontSize: 12 },
}));
