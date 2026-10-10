import { haptics } from '@/lib/haptics';
import { ReactNode, useState } from 'react';
import { Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The base for anything tappable: springs down slightly while pressed, gives a
 * light haptic tap, and picks up `hoverStyle` on the web.
 */
export default function PressableScale({ children, style, hoverStyle, onPress, disabled, haptic = true, scaleTo = 0.96, ...rest }: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  hoverStyle?: StyleProp<ViewStyle>;
  haptic?: boolean;
  scaleTo?: number;
}) {
  const scale = useSharedValue(1);
  const [hovered, setHovered] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onHoverIn={(e) => { setHovered(true); rest.onHoverIn?.(e); }}
      onHoverOut={(e) => { setHovered(false); rest.onHoverOut?.(e); }}
      onPressIn={(e) => { scale.value = withSpring(scaleTo, { damping: 15, stiffness: 400 }); rest.onPressIn?.(e); }}
      onPressOut={(e) => { scale.value = withSpring(1, { damping: 12, stiffness: 300 }); rest.onPressOut?.(e); }}
      onPress={(e) => { if (haptic) haptics.tap(); onPress?.(e); }}
      style={[
        style,
        Platform.OS === 'web' && ({ cursor: disabled ? 'default' : 'pointer' } as any),
        hovered && !disabled && hoverStyle,
        disabled && { opacity: 0.5 },
        animated,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
