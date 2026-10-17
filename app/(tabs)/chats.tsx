import EmptyState from '@/components/ui/EmptyState';
import { ListGroup } from '@/components/ui/ListRow';
import { PosterThumb } from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Screen from '@/components/ui/Screen';
import TabScreen from '@/components/ui/TabScreen';
import { Fonts, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useUnread } from '@/hooks/useUnread';
import { supabase } from '@/lib/supabase';
import { format, isToday, isYesterday } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';

type ChatRow = {
  event_id: string;
  title: string;
  theme: string;
  cover_image: string | null;
  date: string;
  last_message: string | null;
  last_sender_id: string | null;
  last_sender_name: string | null;
  last_message_at: string | null;
  unread: number;
};

function when(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export default function ChatsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { refresh: refreshBadges } = useUnread();
  usePageTitle('Chats');
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_my_chats');
    setChats(data ?? []);
    setLoading(false);
    setRefreshing(false);
    refreshBadges();
  }, [refreshBadges]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <Screen style={styles.center}><ActivityIndicator color={theme.colors.textSecondary} size="large" /></Screen>;

  return (
    <TabScreen
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.textSecondary} />}
      >
        <Text style={theme.type.title} accessibilityRole="header">Chats</Text>
        {chats.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="No chats yet"
            body="Each event you host, or say Going or Maybe to, gets a group chat. They'll all show up here."
          />
        ) : (
          <ListGroup>
            {chats.map((chat) => {
              const unread = chat.unread > 0;
              const sender = chat.last_sender_id === user?.id ? 'You' : chat.last_sender_name?.split(' ')[0];
              return (
                <PressableScale
                  key={chat.event_id}
                  scaleTo={0.99}
                  onPress={() => router.push({ pathname: '/event/[id]', params: { id: chat.event_id, tab: 'chat' } })}
                  style={styles.row}
                  hoverStyle={styles.rowHover}
                  accessibilityLabel={`${chat.title}${unread ? `, ${chat.unread} unread` : ''}`}
                >
                  <PosterThumb title={chat.title} theme={chat.theme} imageUrl={chat.cover_image} />
                  <View style={styles.rowText}>
                    <View style={styles.rowTop}>
                      <Text style={[theme.type.value, styles.title, { fontFamily: unread ? Fonts.bodyBold : Fonts.bodySemiBold }]} numberOfLines={1}>{chat.title}</Text>
                      {chat.last_message_at && <Text style={theme.type.micro}>{when(chat.last_message_at)}</Text>}
                    </View>
                    <View style={styles.rowTop}>
                      <Text style={[theme.type.caption, { flex: 1 }, unread && { color: theme.colors.text }]} numberOfLines={1}>
                        {chat.last_message ? `${sender ? `${sender}: ` : ''}${chat.last_message}` : 'No messages yet. Say hi!'}
                      </Text>
                      {unread && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{chat.unread > 9 ? '9+' : chat.unread}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </PressableScale>
              );
            })}
          </ListGroup>
        )}
    </TabScreen>
  );
}

const useStyles = makeStyles((t) => ({
  center: { justifyContent: 'center', alignItems: 'center' },
  // Phones: TabScreen sets the top and bottom padding (safe area, floating bar)
  content: { paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md, paddingHorizontal: Space.md + 2 },
  rowHover: { backgroundColor: t.colors.surfaceAlt },
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  title: { flex: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: t.colors.secondary, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontFamily: Fonts.bodyBold, fontSize: 11, color: t.colors.onSecondary },
}));
