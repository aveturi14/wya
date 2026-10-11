import PressableScale from '@/components/ui/PressableScale';
import { Radius } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';
import { Photo, SignedUrls } from '@/lib/album';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

const GAP = 4;

/**
 * Square thumbnails, newest first. A wrapping View rather than a FlatList,
 * because it sits inside the event page's scroll view (albums cap at 300).
 */
export default function PhotoGrid({ photos, urls, columns, onOpen }: {
  photos: Photo[];
  urls: SignedUrls;
  columns: number;
  onOpen: (index: number) => void;
}) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const size = width ? Math.floor((width - GAP * (columns - 1)) / columns) : 0;

  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {size > 0 && photos.map((p, i) => (
        <PressableScale
          key={p.id}
          onPress={() => onOpen(i)}
          scaleTo={0.97}
          style={[styles.tile, { width: size, height: size }]}
          accessibilityLabel={`Photo from ${p.uploader_name ?? 'a guest'}`}
        >
          {urls[p.thumb_path] && (
            <Image
              source={{ uri: urls[p.thumb_path], cacheKey: `${p.id}_thumb` }} // links change; the photo doesn't
              style={{ width: size, height: size }}
              contentFit="cover"
              transition={150}
              recyclingKey={p.id}
            />
          )}
        </PressableScale>
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: t.colors.surfaceAlt },
}));
