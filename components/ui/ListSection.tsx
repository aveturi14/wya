import { Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { Modal, ScrollView, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from './Card';
import PressableScale from './PressableScale';
import Screen from './Screen';
import ScrollBox from './ScrollBox';

/**
 * A titled list for things that can get long (guests, attendance, pledges):
 * collapsible, scrolls inside its card once open, and has a full screen
 * button that shows the whole list on its own page.
 */
export default function ListSection({ title, count, accent, subtitle, defaultOpen = false, footer, contentStyle, children }: {
  title: string;
  count?: number;
  accent?: string; // a status dot before the title
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  footer?: ReactNode; // e.g. a Done button; shown under the list, in the card and full screen
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(defaultOpen);
  const [fullScreen, setFullScreen] = useState(false);
  // Reduce Motion: full screen fades in instead of sliding up
  const reduceMotion = useReducedMotion();
  const c = theme.colors;

  const heading = (
    <View style={styles.titleRow}>
      {accent && <View style={[styles.dot, { backgroundColor: accent }]} />}
      <Text style={theme.type.heading}>{title}</Text>
      {count != null && <Text style={[theme.type.heading, { color: c.textMuted }]}>{count}</Text>}
    </View>
  );

  return (
    <Card style={{ gap: Space.md }}>
      <View style={styles.header}>
        <PressableScale
          onPress={() => setOpen((o) => !o)}
          scaleTo={0.99}
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${title}`}
        >
          {heading}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.textSecondary} />
        </PressableScale>
        {open && (
          <PressableScale onPress={() => setFullScreen(true)} style={styles.iconBtn} hoverStyle={styles.iconHover} hitSlop={8} accessibilityLabel={`Show ${title} full screen`}>
            <Ionicons name="expand-outline" size={18} color={c.text} />
          </PressableScale>
        )}
      </View>
      {subtitle != null && <Text style={theme.type.caption}>{subtitle}</Text>}
      {open && <ScrollBox contentStyle={contentStyle}>{children}</ScrollBox>}
      {open && footer}

      <Modal visible={fullScreen} animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={() => setFullScreen(false)}>
        <View style={[styles.fullPage, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <Screen style={styles.fullColumn}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>{heading}</View>
              <PressableScale onPress={() => setFullScreen(false)} style={styles.iconBtn} hoverStyle={styles.iconHover} hitSlop={8} accessibilityLabel="Close full screen">
                <Ionicons name="close" size={20} color={c.text} />
              </PressableScale>
            </View>
            {subtitle != null && <Text style={theme.type.caption}>{subtitle}</Text>}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={[{ paddingBottom: Space.lg }, contentStyle]}>
              {children}
            </ScrollView>
            {footer}
          </Screen>
        </View>
      </Modal>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.colors.surfaceAlt,
  },
  iconHover: { opacity: 0.8 },
  fullPage: { flex: 1, backgroundColor: t.colors.background },
  fullColumn: { padding: Space.lg, gap: Space.md },
}));
