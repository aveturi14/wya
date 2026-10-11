import { Avatar } from '@/components/ui/Avatar';
import PressableScale from '@/components/ui/PressableScale';
import { Space } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Photo, SignedUrls } from '@/lib/album';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Full-screen photos: swipe (or arrows on wide screens), with who added it, Save and Delete. */
export default function PhotoViewer({ photos, urls, startIndex, onClose, canDelete, onDelete, onSave }: {
  photos: Photo[];
  urls: SignedUrls;
  startIndex: number | null; // null = closed
  onClose: () => void;
  canDelete: (photo: Photo) => boolean;
  onDelete: (photo: Photo) => Promise<void>;
  onSave: (photo: Photo) => Promise<void>;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const list = useRef<FlatList<Photo>>(null);
  const [index, setIndex] = useState(startIndex ?? 0);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const c = theme.colors;

  useEffect(() => { if (startIndex != null) setIndex(startIndex); }, [startIndex]);
  // New photos arrive at the front while the viewer is open: stay on the photo
  // being looked at instead of letting it shift. If it was deleted, stay at the
  // same position, clamped to the end.
  const shownId = useRef<string | null>(null);
  useEffect(() => {
    const at = shownId.current ? photos.findIndex((p) => p.id === shownId.current) : -1;
    const next = at >= 0 ? at : Math.min(index, photos.length - 1);
    if (next >= 0 && next !== index) {
      setIndex(next);
      list.current?.scrollToIndex({ index: next, animated: false });
    }
  }, [photos]);
  useEffect(() => { shownId.current = photos[index]?.id ?? null; }, [photos, index]);
  useEffect(() => { if (startIndex != null && photos.length === 0) onClose(); }, [photos.length, startIndex, onClose]);

  const photo = photos[Math.min(index, photos.length - 1)];
  const go = (to: number) => {
    const next = Math.max(0, Math.min(photos.length - 1, to));
    list.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };
  const run = async (kind: 'save' | 'delete', fn: () => Promise<void>) => {
    setBusy(kind);
    try { await fn(); } finally { setBusy(null); }
  };

  return (
    <Modal visible={startIndex != null} animationType="fade" onRequestClose={onClose}>
      <View style={styles.page}>
        <FlatList
          ref={list}
          data={photos}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={32}
          renderItem={({ item }) => (
            <View style={{ width, height, justifyContent: 'center' }}>
              <Image
                source={urls[item.path] ? { uri: urls[item.path], cacheKey: item.id } : undefined}
                placeholder={urls[item.thumb_path] ? { uri: urls[item.thumb_path], cacheKey: `${item.id}_thumb` } : undefined}
                style={{ width, height: height - insets.top - insets.bottom - 140 }}
                contentFit="contain"
                placeholderContentFit="contain"
                transition={150}
              />
            </View>
          )}
        />

        {photo && (
          <>
            <View style={[styles.bar, styles.top, { paddingTop: insets.top + Space.md }]}>
              <Avatar name={photo.uploader_name} url={photo.uploader_avatar} seed={photo.user_id} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={[theme.type.value, { color: c.onScrim }]} numberOfLines={1}>{photo.uploader_name ?? 'A guest'}</Text>
                <Text style={[theme.type.caption, { color: c.onScrim, opacity: 0.7 }]}>
                  {format(new Date(photo.created_at), 'EEE d MMM, h:mm a')} · {index + 1} of {photos.length}
                </Text>
              </View>
              <IconButton icon="close" label="Close photo" onPress={onClose} />
            </View>

            <View style={[styles.bar, styles.bottom, { paddingBottom: insets.bottom + Space.md }]}>
              <IconButton icon="download-outline" label="Save photo" busy={busy === 'save'} onPress={() => run('save', () => onSave(photo))} />
              {canDelete(photo) && (
                <IconButton icon="trash-outline" label="Delete photo" busy={busy === 'delete'} onPress={() => run('delete', () => onDelete(photo))} />
              )}
            </View>

            {isWide && index > 0 && (
              <View style={[styles.arrow, { left: Space.lg }]}><IconButton icon="chevron-back" label="Previous photo" onPress={() => go(index - 1)} /></View>
            )}
            {isWide && index < photos.length - 1 && (
              <View style={[styles.arrow, { right: Space.lg }]}><IconButton icon="chevron-forward" label="Next photo" onPress={() => go(index + 1)} /></View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

function IconButton({ icon, label, onPress, busy }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; busy?: boolean }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <PressableScale onPress={onPress} disabled={busy} style={styles.iconBtn} hitSlop={8} accessibilityLabel={label}>
      {busy ? <ActivityIndicator color={theme.colors.onScrim} /> : <Ionicons name={icon} size={22} color={theme.colors.onScrim} />}
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  page: { flex: 1, backgroundColor: t.colors.scrim },
  bar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingHorizontal: Space.lg },
  top: { top: 0 },
  bottom: { bottom: 0, justifyContent: 'center', gap: Space.xl },
  arrow: { position: 'absolute', top: '50%', marginTop: -22 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.colors.scrimButton,
  },
}));
