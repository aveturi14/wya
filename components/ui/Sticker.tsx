import { Motion } from '@/constants/motion';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useEffect } from 'react';
import { StyleProp, Text, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/**
 * A pill label slapped on a poster ("8 going", "you're in", "bring a plus one"),
 * tilted, with a soft drop shadow. `wobble` rocks it gently now and then; it stays
 * still with Reduce Motion on.
 */
export default function Sticker({ label, bg, fg, tilt = 0, wobble, size = 'md', style }: {
  label: string;
  bg?: string;
  fg?: string;
  tilt?: number;
  wobble?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const moving = wobble && !reduceMotion;

  useEffect(() => {
    if (!moving) return;
    t.value = withRepeat(withTiming(1, { duration: Motion.stickerWobble / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [moving, t]);

  const animated = useAnimatedStyle(() => ({
    transform: [
      // From the tilt to a little past level and back, like the mockups' "wig"
      { rotate: `${tilt + (tilt * -1.4) * t.value}deg` },
      { scale: 1 + 0.04 * t.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: bg ?? theme.colors.highlight,
          borderRadius: Radius.pill,
          paddingHorizontal: size === 'sm' ? 8 : 11,
          paddingVertical: size === 'sm' ? 3 : 5,
          boxShadow: '0px 4px 12px -4px rgba(0, 0, 0, 0.35)',
        },
        moving ? animated : tilt ? { transform: [{ rotate: `${tilt}deg` }] } : null,
        style,
      ]}
    >
      <Text style={{ fontFamily: Fonts.bodyBold, fontSize: size === 'sm' ? 12 : 13, color: fg ?? theme.colors.onHighlight }} numberOfLines={1}>{label}</Text>
    </Animated.View>
  );
}
