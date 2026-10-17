import WidgetCard from '@/components/home/WidgetCard';
import PressableScale from '@/components/ui/PressableScale';
import { eventTheme } from '@/constants/eventThemes';
import { linear, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { AlbumSummary, signPaths } from '@/lib/album';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

/**
 * The newest album with photos (an open one first), as a mosaic: one big tile
 * and four small ones. Empty tiles take the event's theme colours, like the
 * Photos tab. Thumbnails are private, so they're signed like the album does.
 */
export default function AlbumWidget({ onOpen, big }: { onOpen: (eventId: string) => void; big: boolean }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [album, setAlbum] = useState<AlbumSummary | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('get_my_albums');
      const withPhotos = ((data ?? []) as AlbumSummary[]).filter((a) => a.photo_count > 0);
      const pick = withPhotos.find((a) => a.is_open) ?? withPhotos[0] ?? null;
      const signed = pick ? await signPaths(pick.thumb_paths.slice(0, 5)).catch(() => ({})) : {};
      if (cancelled) return;
      setAlbum(pick);
      setUrls(signed);
    })();
    return () => { cancelled = true; };
  }, []));

  if (!album) return null;
  const t = eventTheme(album.theme);
  const paths = album.thumb_paths.slice(0, 5);
  const tile = (i: number, style: object) => {
    const url = paths[i] ? urls[paths[i]] : undefined;
    return (
      <View key={i} style={[styles.tile, style, !url && theme.gradient(linear(i % 2 ? [t.shape, t.base] : [t.base, theme.gradients.accent[1]], 135)), { backgroundColor: i % 2 ? t.shape : t.base }]}>
        {url && <Image source={{ uri: url }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={paths[i]} />}
      </View>
    );
  };

  return (
    <WidgetCard label="Shared album" right={`${album.title} · ${album.photo_count} ${album.photo_count === 1 ? 'photo' : 'photos'}`} style={{ flex: 1.4 }}>
      <PressableScale onPress={() => onOpen(album.event_id)} scaleTo={0.99} style={[styles.mosaic, { height: big ? 300 : 220 }]} accessibilityLabel={`Open the ${album.title} album`}>
        {tile(0, { flex: 1.3 })}
        <View style={styles.side}>
          <View style={styles.sideRow}>{tile(1, { flex: 1 })}{tile(2, { flex: 1 })}</View>
          <View style={styles.sideRow}>{tile(3, { flex: 1 })}{tile(4, { flex: 1 })}</View>
        </View>
      </PressableScale>
    </WidgetCard>
  );
}

const useStyles = makeStyles(() => ({
  mosaic: { flexDirection: 'row', gap: Space.sm },
  side: { flex: 1, gap: Space.sm },
  sideRow: { flex: 1, flexDirection: 'row', gap: Space.sm },
  tile: { borderRadius: Radius.md, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
}));
