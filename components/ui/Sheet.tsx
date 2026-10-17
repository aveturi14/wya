import { Motion } from '@/constants/motion';
import { Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { ReactNode, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleProp, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_CONTENT_WIDTH } from './Screen';

/**
 * A bottom sheet for side tasks (invite people, the guest list, an excuse, the slash
 * menu), so the page underneath stays put. It slides up over a scrim, has a grab
 * handle, and closes on a swipe down, a tap on the scrim, or the back button.
 * With Reduce Motion on it fades instead of sliding. On wide screens it's a centred
 * column, the same width as the app's pages.
 */
export default function Sheet({ visible, onClose, title, subtitle, children, footer, scroll = true, height, contentStyle }: {
  visible: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode; // pinned under the content (a main button)
  scroll?: boolean;
  height?: number | `${number}%`; // a fixed height; otherwise the sheet fits its content up to 90%
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  // Stay mounted while the closing animation runs
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(screen);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = reduceMotion ? 0 : screen;
      fade.value = 0;
      requestAnimationFrame(() => {
        fade.value = withTiming(1, { duration: Motion.base });
        if (!reduceMotion) y.value = withSpring(0, { damping: 22, stiffness: 220, overshootClamping: true });
      });
    } else if (mounted) {
      const done = () => setMounted(false);
      fade.value = withTiming(0, { duration: Motion.fast }, (fin) => { if (fin) runOnJS(done)(); });
      if (!reduceMotion) y.value = withTiming(screen, { duration: Motion.base, easing: Easing.in(Easing.quad) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onChange((e) => { y.value = Math.max(0, y.value + e.changeY); })
    .onEnd((e) => {
      if (y.value > 120 || e.velocityY > 900) runOnJS(onClose)();
      else y.value = withSpring(0, { damping: 22, stiffness: 260 });
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: reduceMotion ? fade.value : 1 }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!mounted) return null;

  const body = scroll
    ? <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
    : <View style={[styles.content, { flex: height ? 1 : undefined }, contentStyle]}>{children}</View>;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.dock} pointerEvents="box-none">
          <Animated.View
            style={[styles.sheet, { maxHeight: screen * 0.9, paddingBottom: Math.max(insets.bottom, Space.lg) }, height != null && { height }, sheetStyle]}
            accessibilityViewIsModal
          >
            <GestureDetector gesture={pan}>
              <View style={styles.handleArea}>
                <View style={styles.grab} />
                {(title || subtitle) && (
                  <View style={styles.head}>
                    {typeof title === 'string' ? <Text style={theme.type.heading} accessibilityRole="header">{title}</Text> : title}
                    {subtitle && <Text style={theme.type.caption}>{subtitle}</Text>}
                  </View>
                )}
              </View>
            </GestureDetector>
            {body}
            {footer && <View style={styles.footer}>{footer}</View>}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  scrim: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: t.colors.overlay },
  dock: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%', maxWidth: MAX_CONTENT_WIDTH,
    backgroundColor: t.colors.sheet,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    boxShadow: '0px -10px 40px -10px rgba(0, 0, 0, 0.4)',
  },
  handleArea: { paddingTop: 10, paddingHorizontal: Space.lg, gap: Space.md, paddingBottom: Space.sm },
  grab: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: t.colors.chipStrong },
  head: { gap: 2 },
  content: { paddingHorizontal: Space.lg, paddingBottom: Space.md, gap: Space.md },
  footer: { paddingHorizontal: Space.lg, paddingTop: Space.sm, gap: Space.sm },
}));
