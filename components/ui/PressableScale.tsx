import { Motion } from '@/constants/motion';
import { useTheme } from '@/hooks/useTheme';
import { haptics } from '@/lib/haptics';
import { createContext, ReactNode, useContext, useState } from 'react';
import { Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// On the web, role "button" renders a real <button>, and a <button> can't hold another
// one (a tappable row with its own Mark button). Pressables inside another one skip the
// default role there; the outer one already announces as a button.
const InsidePressable = createContext(false);

/**
 * The base for anything tappable: springs down slightly while pressed, gives a
 * light haptic tap, and picks up `hoverStyle` on the web. Screen readers hear it
 * as a button (override with `accessibilityRole`), and keyboard focus on the web
 * shows a ring. The spring skips itself when Reduce Motion is on (Reanimated's default).
 */
export default function PressableScale({ children, style, hoverStyle, onPress, disabled, haptic = true, scaleTo = 0.96, ...rest }: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  hoverStyle?: StyleProp<ViewStyle>;
  haptic?: boolean;
  scaleTo?: number;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const nested = useContext(InsidePressable);

  return (
    <AnimatedPressable
      accessibilityRole={Platform.OS === 'web' && nested ? undefined : 'button'}
      {...rest}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      // React Native Web reads the aria-* props, not accessibilityState
      aria-selected={rest.accessibilityState?.selected}
      aria-checked={rest.accessibilityState?.checked}
      aria-expanded={rest.accessibilityState?.expanded}
      disabled={disabled}
      onHoverIn={(e) => { setHovered(true); rest.onHoverIn?.(e); }}
      onHoverOut={(e) => { setHovered(false); rest.onHoverOut?.(e); }}
      // Only keyboard focus gets the ring: a mouse click focuses too, but :focus-visible says which it was
      onFocus={(e) => {
        if (Platform.OS === 'web') setKeyboardFocus(!!(e.target as unknown as HTMLElement)?.matches?.(':focus-visible'));
        rest.onFocus?.(e);
      }}
      onBlur={(e) => { setKeyboardFocus(false); rest.onBlur?.(e); }}
      onPressIn={(e) => { scale.value = withSpring(scaleTo, Motion.press); rest.onPressIn?.(e); }}
      onPressOut={(e) => { scale.value = withSpring(1, Motion.release); rest.onPressOut?.(e); }}
      onPress={(e) => { if (haptic) haptics.tap(); onPress?.(e); }}
      style={[
        style,
        Platform.OS === 'web' && ({ cursor: disabled ? 'default' : 'pointer' } as any),
        hovered && !disabled && hoverStyle,
        keyboardFocus && ({ outlineWidth: 2, outlineStyle: 'solid', outlineColor: theme.colors.primary, outlineOffset: 2 } as any),
        disabled && { opacity: 0.5 },
        animated,
      ]}
    >
      <InsidePressable.Provider value>{children}</InsidePressable.Provider>
    </AnimatedPressable>
  );
}
