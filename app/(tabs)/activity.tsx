import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import PressableScale from '@/components/ui/PressableScale';
import Screen from '@/components/ui/Screen';
import { Fonts, Radius, Space } from '@/constants/theme';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useUnread } from '@/hooks/useUnread';
import { describe, Notification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNowStrict } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

export default function ActivityScreen() {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { refresh: refreshBadges } = useUnread();
  usePageTitle('Activity');
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Items that were unread when this visit started stay "New" until you leave,
  // even though they're marked read in the database straight away
  const newIds = useRef(new Set<string>());

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
    (data ?? []).forEach((n) => { if (!n.read_at) newIds.current.add(n.id); });
    setItems(data ?? []);
    setLoading(false);
    setRefreshing(false);
    // Seeing the list counts as reading it; the items keep their "new" look until next time
    if ((data ?? []).some((n) => !n.read_at)) {
      await supabase.rpc('mark_notifications_read');
      refreshBadges();
    }
  }, [refreshBadges]);

  useFocusEffect(useCallback(() => {
    load();
    return () => newIds.current.clear();
  }, [load]));

  if (loading) return <Screen style={styles.center}><ActivityIndicator color={theme.colors.primary} size="large" /></Screen>;

  const isNew = (n: Notification) => !n.read_at || newIds.current.has(n.id);
  const fresh = items.filter(isNew);
  const earlier = items.filter((n) => !isNew(n));

  const renderGroup = (label: string, list: Notification[]) => list.length > 0 && (
    <View style={styles.group}>
      <Text style={theme.type.label}>{label}</Text>
      <Card padded={false}>
        {list.map((n, i) => {
          const d = describe(n, theme);
          const row = (
            <>
              <View style={[styles.icon, { backgroundColor: d.color }]}><Ionicons name={d.icon} size={18} color={d.onColor} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[theme.type.value, isNew(n) && { fontFamily: Fonts.bodyBold }]}>{d.text}</Text>
                <Text style={theme.type.caption}>{formatDistanceToNowStrict(new Date(n.created_at))} ago</Text>
              </View>
              {isNew(n) && <View style={styles.dot} />}
            </>
          );
          return n.event_id ? (
            <PressableScale key={n.id} scaleTo={0.99} onPress={() => router.push(`/event/${n.event_id}`)} style={[styles.row, i > 0 && styles.divider]} hoverStyle={styles.rowHover}>
              {row}
            </PressableScale>
          ) : (
            // Cancelled events no longer exist, so there's nothing to open
            <View key={n.id} style={[styles.row, i > 0 && styles.divider]}>{row}</View>
          );
        })}
      </Card>
    </View>
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
      >
        <Text style={theme.type.display}>Activity</Text>
        {items.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="Nothing yet"
            body="When guests RSVP to your events, or a host changes plans you're part of, it shows up here."
          />
        ) : (
          <>
            {renderGroup('New', fresh)}
            {renderGroup('Earlier', earlier)}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: Space.xl, paddingTop: Space.xxxl, paddingBottom: 120, gap: Space.xl },
  group: { gap: Space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg },
  rowHover: { backgroundColor: t.colors.surfaceAlt },
  divider: { borderTopWidth: 1, borderTopColor: t.colors.border },
  icon: {
    width: 38, height: 38, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center',
    borderWidth: t.isDark ? 0 : t.outlineWidth, borderColor: t.colors.outline,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.secondary },
}));
