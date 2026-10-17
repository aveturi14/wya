import { Motion } from '@/constants/motion';
import { POSTER_GLYPH_FALLBACK, POSTER_GLYPH_WIDTHS } from '@/constants/posterMetrics';
import { eventTheme, EventTheme, PHOTO_INK, posterGradient, STICKER_TONES } from '@/constants/eventThemes';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { gradient } from '@/lib/gradient';
import { Image as ExpoImage } from 'expo-image';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Sticker from './Sticker';

const GRAIN = require('../../assets/grain.png');

// Poster titles are set this tight (em), as in the mockups
const TRACKING = -0.04;
const LINE_HEIGHT = 0.88;

/** How wide a line of poster title is, in em. */
function lineWidth(text: string) {
  let w = 0;
  for (const ch of text) w += (POSTER_GLYPH_WIDTHS[ch] ?? POSTER_GLYPH_FALLBACK) + TRACKING;
  return w - TRACKING;
}

/**
 * Splits a title into 1–3 lines and finds the biggest size at which every line fits
 * the poster, so a long name shrinks instead of running off the edge. Lines break
 * between words, balanced so no line is much longer than the others.
 */
export function fitTitle(title: string, width: number, height: number, maxSize: number, minSize = 12) {
  const words = title.toUpperCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || width <= 0) return { lines: [title.toUpperCase()], size: minSize };
  let best = { lines: [words.join(' ')], size: 0 };
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    const lines = balance(words, n);
    const widest = Math.max(...lines.map(lineWidth));
    const size = Math.min(maxSize, width / widest, height / (n * LINE_HEIGHT));
    // A second or third line has to earn its place by making the type noticeably bigger
    if (size > best.size * 1.12 || best.size === 0) best = { lines, size };
  }
  return { lines: best.lines, size: Math.max(minSize, Math.floor(best.size)) };
}

// The split of `words` into `n` lines whose longest line is shortest
function balance(words: string[], n: number): string[] {
  if (n === 1) return [words.join(' ')];
  let best: string[] = [];
  let bestW = Infinity;
  const walk = (start: number, left: number, acc: string[]) => {
    if (left === 1) {
      const lines = [...acc, words.slice(start).join(' ')];
      const w = Math.max(...lines.map(lineWidth));
      if (w < bestW) { bestW = w; best = lines; }
      return;
    }
    for (let i = start + 1; i <= words.length - left + 1; i++) walk(i, left - 1, [...acc, words.slice(start, i).join(' ')]);
  };
  walk(0, n, []);
  return best;
}

const DAY = new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
const HOUR = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit' });

/** "SAT 24 OCT · 7PM", or "TIME TBD" for an open event. */
export function posterDate(date: string | null | undefined, open?: boolean) {
  if (open || !date) return 'TIME TBD';
  const d = new Date(date);
  const parts = DAY.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const time = HOUR.format(d).replace(':00', '').replace(/\s/g, '');
  return `${get('weekday')} ${get('day')} ${get('month')} · ${time}`.toUpperCase();
}

export type PosterSticker = { label: string; tone?: keyof typeof STICKER_TONES };

// Where stickers land, in order: top right, then lower left, then mid right
const STICKER_SPOTS: { pos: ViewStyle; tilt: number }[] = [
  { pos: { top: 16, right: 14 }, tilt: 7 },
  { pos: { top: 54, left: 14 }, tilt: -8 },
  { pos: { top: 58, right: 22 }, tilt: -5 },
];

type Props = {
  title: string;
  theme: string | null | undefined;
  imageUrl?: string | null;
  // The serif line over the title ("Jess turns", "you're hosting")
  line?: string | null;
  // Foot of the poster: date on the left, place on the right. Pass a Date string or ready text.
  date?: string | null;
  open?: boolean; // an open event (Find a time): the date reads TIME TBD
  place?: string | null;
  // wya's own stickers come first ("8 going", "you're in"), then the host's (up to two)
  stickers?: PosterSticker[];
  top?: ReactNode; // a pill at the top left (countdown "In 2 days")
  height?: number;
  maxTitleSize?: number;
  lift?: boolean; // the drop shadow of a poster sitting above the page
  radius?: number;
  wobble?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * An event as a gig poster (Phase 9.3): its two colours mixed with grain (or the
 * cover photo under a shade), the title in Archivo Expanded fitted to the width,
 * an optional serif line, the date and place along the foot, and stickers.
 */
export default function Poster({
  title, theme: themeName, imageUrl, line, date, open, place, stickers = [], top, height = 240,
  maxTitleSize = 84, lift = true, radius = Radius.xl, wobble = true, style,
}: Props) {
  const t = eventTheme(themeName);
  const [width, setWidth] = useState(0);
  const pad = height < 160 ? 12 : 16;
  const ink = imageUrl ? PHOTO_INK : t.posterInk;
  const foot = posterDate(date, open);
  const hasFoot = !!(date || open || place);
  const lineSize = Math.round(Math.max(16, Math.min(30, height * 0.095)));
  // Room for the title: the poster minus padding, the foot, the serif line and the top row (pill or sticker)
  const titleBox = height - pad * 2 - (hasFoot ? 22 : 0) - (line ? lineSize + 4 : 0) - (top || stickers.length ? 38 : 0) - 6;
  const fit = useMemo(() => fitTitle(title, width - pad * 2, Math.max(24, titleBox), maxTitleSize), [title, width, pad, titleBox, maxTitleSize]);

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.poster, { height, borderRadius: radius, padding: pad }, lift && styles.lift, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={[line, title, hasFoot ? `${foot}${place ? `, ${place}` : ''}` : null, ...stickers.map((s) => s.label)].filter(Boolean).join('. ')}
    >
      <PosterArt theme={t} imageUrl={imageUrl} radius={radius} />
      <View style={styles.topRow}>{top ?? <View />}</View>
      <View style={styles.bottom}>
        {line ? <Text style={[styles.serif, { color: ink, fontSize: lineSize, lineHeight: lineSize * 1.05 }]} numberOfLines={1}>{line}</Text> : null}
        {width > 0 && fit.lines.map((l, i) => (
          <Text
            key={i}
            numberOfLines={1}
            style={[styles.title, { color: ink, fontSize: fit.size, lineHeight: Math.round(fit.size * LINE_HEIGHT), letterSpacing: fit.size * TRACKING }]}
          >
            {l}
          </Text>
        ))}
        {hasFoot && (
          <View style={styles.foot}>
            <Text style={[styles.footText, { color: ink }]} numberOfLines={1}>{foot}</Text>
            {place && width >= 220 ? <Text style={[styles.footText, styles.place, { color: ink }]} numberOfLines={1}>{place.toUpperCase()}</Text> : null}
          </View>
        )}
      </View>
      {stickers.slice(0, STICKER_SPOTS.length).map((s, i) => {
        const tone = STICKER_TONES[s.tone ?? 'light'];
        return (
          <View key={`${i}-${s.label}`} style={[styles.sticker, STICKER_SPOTS[i].pos]} pointerEvents="none">
            <Sticker label={s.label} bg={tone.bg} fg={tone.fg} tilt={STICKER_SPOTS[i].tilt} wobble={wobble && i === 0} size={height < 160 ? 'sm' : 'md'} />
          </View>
        );
      })}
    </View>
  );
}

/** The poster's background on its own: the gradient and grain, or the photo with a shade. */
export function PosterArt({ theme: t, imageUrl, radius }: { theme: EventTheme; imageUrl?: string | null; radius?: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} pointerEvents="none">
      {imageUrl ? (
        <>
          <ExpoImage source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          <View style={[StyleSheet.absoluteFill, gradient('linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.6) 100%)')]} />
        </>
      ) : (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: t.a }, gradient(posterGradient(t))]} />
          <Image source={GRAIN} resizeMode="repeat" style={[StyleSheet.absoluteFill, styles.grain]} />
        </>
      )}
    </View>
  );
}

/** A small square poster for lists and headers (44pt, or 34pt with `small`). */
export function PosterThumb({ title, theme: themeName, imageUrl, small, size }: {
  title: string;
  theme: string | null | undefined;
  imageUrl?: string | null;
  small?: boolean;
  size?: number;
}) {
  const t = eventTheme(themeName);
  const s = size ?? (small ? 34 : 44);
  const r = Math.round(s * 0.26);
  const word = title.trim().split(/\s+/)[0] ?? '';
  const fit = fitTitle(word, s - 8, s * 0.5, s * 0.24, 6);
  return (
    <View style={{ width: s, height: s, borderRadius: r, overflow: 'hidden', justifyContent: 'flex-end', padding: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <PosterArt theme={t} imageUrl={imageUrl} radius={r} />
      {!imageUrl && (
        <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.title, { color: t.posterInk, fontSize: fit.size, lineHeight: Math.round(fit.size * 0.95), letterSpacing: fit.size * TRACKING }]}>
          {fit.lines.join(' ')}
        </Text>
      )}
    </View>
  );
}

/**
 * The poster's colours glowing behind the top of a page (Spotlight). Sits absolutely
 * at the top of its parent; it breathes slowly unless Reduce Motion is on (and stays
 * still on Android, where a big animated layer costs too much on slower phones).
 * With a photo, the photo itself is blurred into the glow.
 */
export function PosterGlow({ theme: themeName, imageUrl, top = -60, height = 440, strength = 1, style }: {
  theme: string | null | undefined;
  imageUrl?: string | null;
  top?: number;
  height?: number;
  strength?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const t = eventTheme(themeName);
  const reduceMotion = useReducedMotion();
  const breathe = useSharedValue(0);
  const moving = !reduceMotion && Platform.OS !== 'android';

  useEffect(() => {
    if (!moving) return;
    breathe.value = withRepeat(withTiming(1, { duration: Motion.glowBreathe / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [moving, breathe]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * breathe.value }, { translateY: 10 * breathe.value }] }));
  const opacity = theme.glowOpacity * strength;

  // The clip box stays inside the page: a layer hanging past the edges would let the browser
  // scroll the page sideways when a field takes focus
  return (
    <View pointerEvents="none" style={[styles.glowClip, { top, height }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.glow, { opacity }, moving && animated]}>
        {imageUrl ? (
          <ExpoImage source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={60} />
        ) : (
          // Two soft pools of colour; the radial stops fade to nothing, so no blur pass is needed
          <View style={[StyleSheet.absoluteFill, gradient(
            `radial-gradient(55% 60% at 28% 38%, ${t.a} 0%, transparent 72%), radial-gradient(55% 60% at 74% 52%, ${t.b} 0%, transparent 72%)`,
          ), Platform.OS === 'web' && ({ filter: 'blur(40px) saturate(140%)' } as ViewStyle)]} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { overflow: 'hidden', justifyContent: 'space-between' },
  lift: { boxShadow: '0px 22px 44px -18px rgba(0, 0, 0, 0.55)' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bottom: { gap: 2 },
  serif: { fontFamily: Fonts.serif, marginBottom: 2 },
  title: { fontFamily: Fonts.poster, textTransform: 'uppercase', includeFontPadding: false } as any,
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  footText: { fontFamily: Fonts.bodySemiBold, fontSize: 12, letterSpacing: 0.3, flexShrink: 1 },
  place: { textAlign: 'right' },
  sticker: { position: 'absolute', zIndex: 3 },
  grain: { opacity: 0.55, width: '100%', height: '100%' },
  glowClip: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  glow: { position: 'absolute', left: -40, right: -40, top: 0, bottom: 0 },
});
