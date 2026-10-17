import WidgetCard from '@/components/home/WidgetCard';
import { Avatar } from '@/components/ui/Avatar';
import PressableScale from '@/components/ui/PressableScale';
import { Fonts, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { describe, Notification, notificationHref } from '@/lib/notifications';
import { differenceInMinutes } from 'date-fns';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

// "2m", "18m", "1h", "3d": the dashboard has no room for "2 minutes ago"
function shortAgo(iso: string) {
  const m = Math.max(0, differenceInMinutes(new Date(), new Date(iso)));
  if (m < 60) return `${m}m`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / (60 * 24))}d`;
}

/** The latest four Activity items; tapping one marks it read and opens it, like the Activity page. */
export default function ActivityWidget({ items, unread, onMarkAllRead, onRead }: {
  items: Notification[];
  unread: number;
  onMarkAllRead: () => void;
  onRead: (n: Notification) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const shown = items.slice(0, 4);
  return (
    <WidgetCard
      label="Activity"
      dot={unread > 0 ? theme.colors.primary : undefined}
      right={unread > 0 ? 'Mark all read' : undefined}
      onRight={unread > 0 ? onMarkAllRead : undefined}
      style={{ flex: 1 }}
    >
      {shown.length === 0 ? (
        <Text style={theme.type.bodySecondary}>RSVPs, payments and photos from your plans will show up here.</Text>
      ) : (
        <View>
          {shown.map((n, i) => {
            const d = describe(n, theme);
            const actor = n.data.actor_name ?? null;
            const row = (
              <>
                <Avatar name={actor} seed={actor ?? n.id} size={34} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={[theme.type.value, { fontSize: 14 }, !n.read_at && { fontFamily: Fonts.bodyBold }]} numberOfLines={2}>{d.text}</Text>
                </View>
                <Text style={theme.type.caption}>{shortAgo(n.created_at)}</Text>
              </>
            );
            return n.event_id ? (
              <PressableScale key={n.id} scaleTo={0.98} style={[styles.row, i > 0 && styles.divider]}
                onPress={() => { onRead(n); router.push(notificationHref(n)); }}>
                {row}
              </PressableScale>
            ) : (
              <View key={n.id} style={[styles.row, i > 0 && styles.divider]}>{row}</View>
            );
          })}
        </View>
      )}
    </WidgetCard>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.sm },
  divider: { borderTopWidth: 1, borderTopColor: t.colors.border },
}));
