import { EventThemes } from '@/constants/eventThemes';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const COLORS = Object.values(EventThemes).map((t) => t.base);
const PIECES = 40;

function Piece({ index, width, height }: { index: number; width: number; height: number }) {
  const p = useMemo(() => ({
    x: Math.random() * width,
    drift: (Math.random() - 0.5) * 160,
    spin: (Math.random() - 0.5) * 720,
    size: 8 + Math.random() * 8,
    round: Math.random() > 0.6,
    color: COLORS[index % COLORS.length],
    delay: Math.random() * 250,
    duration: 1400 + Math.random() * 900,
  }), [index, width]);

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

/** A one-shot confetti burst. Render it with a new `burstKey` to fire again. */
export default function Confetti({ burstKey }: { burstKey: number }) {
  const { width, height } = useWindowDimensions();
  if (!burstKey) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} key={burstKey}>
      {Array.from({ length: PIECES }, (_, i) => <Piece key={i} index={i} width={width} height={height} />)}
    </View>
  );
}
