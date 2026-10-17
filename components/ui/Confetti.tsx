import { EventThemes } from '@/constants/eventThemes';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

// Every look's colours, unless the event's own are passed in
const COLORS = Object.values(EventThemes).flatMap((t) => [t.a, t.b]);
// A few white pieces make any two colours read as confetti
const SPARKLE = '#FFFFFF';
const PIECES = 40;

function Piece({ index, width, height, colors }: { index: number; width: number; height: number; colors: string[] }) {
  const p = useMemo(() => ({
    x: Math.random() * width,
    drift: (Math.random() - 0.5) * 160,
    spin: (Math.random() - 0.5) * 720,
    size: 8 + Math.random() * 8,
    round: Math.random() > 0.6,
    color: index % 5 === 4 ? SPARKLE : colors[index % colors.length],
    delay: Math.random() * 250,
    duration: 1400 + Math.random() * 900,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [index, width, colors.join()]);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(p.delay, withTiming(1, { duration: p.duration, easing: Easing.out(Easing.quad) }));
  }, [p, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.85 ? 1 : (1 - progress.value) / 0.15,
    transform: [
      { translateX: p.x + p.drift * progress.value },
      { translateY: -40 + (height + 80) * progress.value },
      { rotate: `${p.spin * progress.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 0, top: 0, width: p.size, height: p.round ? p.size : p.size * 0.5, borderRadius: p.round ? p.size : 2, backgroundColor: p.color },
        style,
      ]}
    />
  );
}

/** A one-shot confetti burst, in the event's colours if given. Render it with a new `burstKey` to fire again. */
export default function Confetti({ burstKey, colors = COLORS }: { burstKey: number; colors?: string[] }) {
  const { width, height } = useWindowDimensions();
  // Reduce Motion: no burst at all (the RSVP still says you're in)
  const reduceMotion = useReducedMotion();
  if (!burstKey || reduceMotion) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} key={burstKey}>
      {Array.from({ length: PIECES }, (_, i) => <Piece key={i} index={i} width={width} height={height} colors={colors} />)}
    </View>
  );
}
