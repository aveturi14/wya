import PressableScale from '@/components/ui/PressableScale';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { describe, Notification, notificationHref } from '@/lib/notifications';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, Text, View } from 'react-native';

/** The latest Activity as a row of chips under the headline; tap one to open its event. */
export default function Ticker({ items }: { items: Notification[] }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((n) => {
          const d = describe(n, theme);
          return (
            <PressableScale
              key={n.id}
              onPress={() => n.event_id && router.push(notificationHref(n))}
              disabled={!n.event_id}
              scaleTo={0.97}
              style={styles.chip}
              hoverStyle={styles.chipHover}
            >
              <View style={[styles.dot, { backgroundColor: d.color }]} />
              <Text style={[theme.type.caption, { color: theme.colors.text }]} numberOfLines={1}>{d.text}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // The row fades out at the right edge on web, hinting there's more to scroll
  wrap: Platform.OS === 'web'
    ? ({ maskImage: 'linear-gradient(90deg, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, black 85%, transparent)' } as object)
    : {},
  row: { gap: Space.sm, paddingVertical: 2, paddingRight: Space.xxl },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: Space.sm, maxWidth: 300,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.pill, ...t.glass, ...t.shadow(1),
  },
  chipHover: { backgroundColor: t.colors.surface },
  dot: { width: 6, height: 6, borderRadius: 3 },
}));
