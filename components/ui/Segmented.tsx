import { Fonts, Radius } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { haptics } from '@/lib/haptics';
import { Text, View } from 'react-native';
import PressableScale from './PressableScale';

/** Pill toggle between a few options (Upcoming / Past, Details / Chat). */
export default function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.track}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            haptic={false}
            onPress={() => { if (!active) { haptics.select(); onChange(o.value); } }}
            style={[styles.option, active && styles.active]}
          >
            <Text style={[styles.text, { color: active ? theme.colors.onPrimary : theme.colors.textSecondary }]}>{o.label}</Text>
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
    padding: 4,
    gap: 4,
    borderWidth: t.isDark ? 0 : t.outlineWidth,
    borderColor: t.colors.outline,
  },
  option: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: Radius.pill },
  active: { backgroundColor: t.colors.primary },
  text: { fontFamily: Fonts.bodyBold, fontSize: 14 },
}));
