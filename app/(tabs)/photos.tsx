import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import EventCover from '@/components/ui/EventCover';
import Screen, { MAX_WIDE_CONTENT_WIDTH } from '@/components/ui/Screen';
import Sticker from '@/components/ui/Sticker';
import TabScreen from '@/components/ui/TabScreen';
import { eventTheme } from '@/constants/eventThemes';
import { Fonts, Space } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { AlbumSummary, signPaths, SignedUrls } from '@/lib/album';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';

/** Every album you can see, newest event first; tap one to open its Photos tab. */
export default function PhotosScreen() {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { isWide } = useLayout();
  usePageTitle('Photos');
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [urls, setUrls] = useState<SignedUrls>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_my_albums');
    const rows = (data ?? []) as AlbumSummary[];
    setAlbums(rows);
    // The bucket is private: thumbnails come through short-lived links, like the album itself
    try { setUrls(await signPaths(rows.flatMap((a) => a.thumb_paths))); } catch { /* retried on the next focus */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <Screen style={styles.center}><ActivityIndicator color={theme.colors.primary} size="large" /></Screen>;

  const open = (a: AlbumSummary) => router.push({ pathname: '/event/[id]', params: { id: a.event_id, tab: 'photos' } });
  // The album you can still add to gets the big card; everything else sits in the grid
  // (one that already has photos, if several are open)
  const featured = albums.find((a) => a.is_open && a.photo_count > 0) ?? albums.find((a) => a.is_open);
  const rest = albums.filter((a) => a !== featured);
  const cols = isWide ? 4 : 2;
  const rows: AlbumSummary[][] = [];
  for (let i = 0; i < rest.length; i += cols) rows.push(rest.slice(i, i + cols));

  return (
    <TabScreen
      maxWidth={isWide ? MAX_WIDE_CONTENT_WIDTH : undefined}
      contentContainerStyle={[styles.content, isWide && styles.contentWide]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={theme.type.display}>Photos</Text>
        <Text style={theme.type.bodySecondary}>Albums from your events</Text>
      </View>

      {albums.length === 0 ? (
        <EmptyState
          icon="images-outline"
          title="No albums yet"
          body="Once an event starts, everyone going can add photos. Every album you're part of shows up here."
        />
      ) : (
        <>
          {featured && (
            <Card padded={false} onPress={() => open(featured)}>
              <Mosaic album={featured} urls={urls} cells={6} height={isWide ? 260 : 150} />
              <View style={[styles.cardBody, styles.featuredBody]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={theme.type.cardTitle} numberOfLines={1}>{featured.title}</Text>
                  <Text style={theme.type.caption}>{countLabel(featured.photo_count)} · {format(new Date(featured.starts_at), 'EEE d MMM')}</Text>
                </View>
                <Sticker label="Open now" bg={theme.colors.success} fg={theme.colors.onStatus} />
              </View>
            </Card>
          )}
          {rows.map((row, r) => (
            <View key={r} style={styles.gridRow}>
              {row.map((a) => (
                <View key={a.event_id} style={styles.gridItem}>
                  <Card padded={false} onPress={() => open(a)}>
                    <Mosaic album={a} urls={urls} cells={4} height={isWide ? 160 : 110} />
                    <View style={[styles.cardBody, styles.smallBody]}>
                      <Text style={styles.smallTitle} numberOfLines={1}>{a.title}</Text>
                      <Text style={theme.type.caption} numberOfLines={1}>{countLabel(a.photo_count)} · {format(new Date(a.starts_at), 'd MMM')}</Text>
                    </View>
                  </Card>
                </View>
              ))}
              {/* Keep the last row's cards the same width as the rest */}
              {Array.from({ length: cols - row.length }, (_, i) => <View key={`pad${i}`} style={styles.gridItem} />)}
            </View>
          ))}
        </>
      )}
    </TabScreen>
  );
}

const countLabel = (n: number) => (n === 1 ? '1 photo' : `${n} photos`);

/**
 * The newest thumbnails in a grid (3×2 for the big card, 2×2 for the rest).
 * The last tile shows how many more there are; empty tiles take the event's
 * theme colours, and an album with no photos yet shows the event's cover.
 */
function Mosaic({ album, urls, cells, height }: { album: AlbumSummary; urls: SignedUrls; cells: number; height: number }) {
  const styles = useStyles();
  if (album.photo_count === 0) {
    return <EventCover seed={album.event_id} title={album.title} theme={album.theme} imageUrl={album.cover_image} style={{ height }} initialSize={height * 0.6} />;
  }
  const perRow = cells === 6 ? 3 : 2;
  const t = eventTheme(album.theme);
  const extra = album.photo_count - cells;
  const tiles = Array.from({ length: cells }, (_, i) => {
    const path = album.thumb_paths[i];
    const isMore = i === cells - 1 && extra > 0;
    return (
      <View key={i} style={[styles.tile, { backgroundColor: i % 2 ? t.shape : t.base }]}>
        {path && urls[path] && <Image source={{ uri: urls[path] }} style={styles.fill} contentFit="cover" transition={150} />}
        {isMore && (
          <View style={[styles.fill, styles.more]}>
            <Text style={styles.moreText}>+{extra + 1}</Text>
          </View>
        )}
      </View>
    );
  });
  return (
    <View style={[styles.mosaic, { height, gap: perRow === 3 ? 3 : 2 }]}>
      {[0, 1].map((r) => (
        <View key={r} style={[styles.mosaicRow, { gap: perRow === 3 ? 3 : 2 }]}>{tiles.slice(r * perRow, (r + 1) * perRow)}</View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  center: { justifyContent: 'center', alignItems: 'center' },
  // Phones: TabScreen sets the top and bottom padding (safe area, floating bar)
  content: { padding: Space.xl, paddingTop: Space.xxxl, gap: Space.lg },
  contentWide: { paddingHorizontal: Space.xxl, paddingTop: Space.xxl, gap: Space.xl },
  header: { gap: Space.xs, paddingTop: Space.sm, marginBottom: Space.xs },
  cardBody: { borderTopWidth: t.outlineWidth, borderTopColor: t.colors.outline },
  featuredBody: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.lg, paddingTop: 14, paddingBottom: Space.lg },
  smallBody: { paddingHorizontal: Space.md, paddingTop: 10, paddingBottom: Space.md, gap: 2 },
  smallTitle: { ...t.type.cardTitle, fontSize: 15, lineHeight: 19, letterSpacing: -0.3 },
  gridRow: { flexDirection: 'row', gap: Space.lg },
  gridItem: { flex: 1, minWidth: 0 },
  mosaic: { backgroundColor: t.colors.outline },
  mosaicRow: { flex: 1, flexDirection: 'row' },
  tile: { flex: 1, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  more: { backgroundColor: t.colors.overlay, justifyContent: 'center', alignItems: 'center' },
  moreText: { fontFamily: Fonts.display, fontSize: 20, color: t.colors.onScrim },
}));
