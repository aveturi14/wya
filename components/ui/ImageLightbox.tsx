import PressableScale from '@/components/ui/PressableScale';
import { Space } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Full-screen, swipeable images (venue photos, chat images), with arrows on
 * wide screens like the album's. The album has its own PhotoViewer because it
 * also needs signed links, Save and Delete.
 */
export default function ImageLightbox({ images, startIndex, onClose }: {
  images: string[];
  startIndex: number | null; // null = closed
  onClose: () => void;
}) {
  const styles = useStyles();
  const { isWide } = useLayout();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(startIndex ?? 0);

  useEffect(() => { if (startIndex != null) setIndex(startIndex); }, [startIndex]);

  const go = (to: number) => {
    const next = Math.max(0, Math.min(images.length - 1, to));
    list.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  return (
    <Modal visible={startIndex != null} animationType="fade" onRequestClose={onClose}>
      <View style={styles.page}>
        <FlatList
          ref={list}
          data={images}
          keyExtractor={(uri) => uri}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={32}
          renderItem={({ item: uri }) => (
            <View style={{ width, height, justifyContent: 'center' }}>
              <Image source={{ uri }} style={{ width, height: height - insets.top - insets.bottom - 80 }} contentFit="contain" transition={150} recyclingKey={uri} />
            </View>
          )}
        />
        <View style={[styles.close, { top: insets.top + Space.md }]}>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
        {isWide && index > 0 && (
          <View style={[styles.arrow, { left: Space.lg }]}><IconButton icon="chevron-back" label="Previous image" onPress={() => go(index - 1)} /></View>
        )}
        {isWide && index < images.length - 1 && (
          <View style={[styles.arrow, { right: Space.lg }]}><IconButton icon="chevron-forward" label="Next image" onPress={() => go(index + 1)} /></View>
        )}
      </View>
    </Modal>
  );
}

function IconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <PressableScale onPress={onPress} style={styles.iconBtn} hitSlop={8} accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={theme.colors.onScrim} />
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  page: { flex: 1, backgroundColor: t.colors.scrim },
  close: { position: 'absolute', right: Space.lg },
  arrow: { position: 'absolute', top: '50%', marginTop: -22 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.scrimButton },
}));
