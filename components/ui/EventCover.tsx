import { eventTheme } from '@/constants/eventThemes';
import { Fonts } from '@/constants/theme';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

// Small deterministic hash so each event always gets the same shapes
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * An event's cover: the uploaded photo, or generated art in the event's theme
 * (bold shapes plus a big initial) so no event ever looks empty.
 */
export default function EventCover({ seed, title, theme, imageUrl, style, initialSize = 120 }: {
  seed: string;
  title: string;
  theme: string | null | undefined;
  imageUrl?: string | null;
  style?: StyleProp<ViewStyle>;
  initialSize?: number;
}) {
  const t = eventTheme(theme);

  if (imageUrl) {
    return (
      <View style={[styles.wrap, { backgroundColor: t.base }, style]}>
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>
    );
  }

  const h = hash(seed);
  const rotate = `${(h % 30) - 15}deg`;
  const variant = h % 3;
  const initial = (title.trim()[0] ?? 'w').toUpperCase();

  return (
    <View style={[styles.wrap, { backgroundColor: t.base }, style]}>
      {variant === 0 && (
        <>
          <View style={[styles.circle, { backgroundColor: t.shape, width: '70%', aspectRatio: 1, top: '-25%', right: '-15%' }]} />
          <View style={[styles.circle, { backgroundColor: t.shape, width: '30%', aspectRatio: 1, bottom: '-8%', left: '8%' }]} />
        </>
      )}
      {variant === 1 && (
        <>
          <View style={[styles.bar, { backgroundColor: t.shape, transform: [{ rotate }], top: '20%' }]} />
          <View style={[styles.bar, { backgroundColor: t.shape, transform: [{ rotate }], top: '55%' }]} />
        </>
      )}
      {variant === 2 && (
        <View style={[styles.blob, { backgroundColor: t.shape, transform: [{ rotate }] }]} />
      )}
      <Text
        style={[styles.initial, { color: t.ink, fontSize: initialSize, lineHeight: initialSize * 1.05, transform: [{ rotate }] }]}
        numberOfLines={1}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  circle: { position: 'absolute', borderRadius: 9999 },
  bar: { position: 'absolute', left: '-20%', width: '140%', height: '16%', borderRadius: 9999 },
  blob: { position: 'absolute', width: '65%', aspectRatio: 1.3, borderRadius: 60, top: '10%', left: '30%' },
  initial: { fontFamily: Fonts.display, letterSpacing: -4 },
});
