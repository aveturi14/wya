import Eyebrow from '@/components/ui/Eyebrow';
import PressableScale from '@/components/ui/PressableScale';
import { eventTheme } from '@/constants/eventThemes';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { formatMoney, isPledgeEvent } from '@/lib/pledges';
import { Event } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format } from 'date-fns';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type HeroRole = 'host' | 'yes' | 'maybe' | 'invited' | 'no';

function whenLabel(start: Date, end: Date | null, now: Date) {
  if (now >= start && (!end || now < end)) return 'Happening now';
  const days = differenceInCalendarDays(start, now);
  if (days === 0) return start.getHours() >= 17 ? 'Tonight' : 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return format(start, 'EEEE');
  return `In ${days} days`;
}

const ROLE_LABEL: Record<HeroRole, string> = { host: 'Hosting', yes: 'Going', maybe: 'Maybe', invited: 'Invited', no: "Can't go" };

/**
 * Your next plan, big: the cover photo (or a glow in the event's theme colours),
 * when and where, a live countdown, and Open event. Dark in both themes.
 */
export default function HeroEvent({ event, role, onOpen, big }: { event: Event; role: HeroRole; onOpen: () => void; big: boolean }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const t = eventTheme(event.theme);
  const start = new Date(event.date);
  const end = event.end_date ? new Date(event.end_date) : null;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = Math.max(0, start.getTime() - now.getTime());
  const parts = [
    { value: Math.floor(left / 86_400_000), unit: 'Days' },
    { value: Math.floor(left / 3_600_000) % 24, unit: 'Hrs' },
    { value: Math.floor(left / 60_000) % 60, unit: 'Min' },
    { value: Math.floor(left / 1000) % 60, unit: 'Sec' },
  ];
  // The address is null when the database is hiding it (pledge event, not committed yet)
  const place = event.venue_name || event.address || 'Address hidden';
  const fade = (hex: string) => `${hex}00`;
  // Glows in the event's colours, plus the app accents, on a deep base
  const glow = [
    `radial-gradient(circle at 82% 18%, ${t.base} 0%, ${fade(t.base)} 42%)`,
    `radial-gradient(circle at 96% 78%, ${t.shape} 0%, ${fade(t.shape)} 38%)`,
    `radial-gradient(circle at 48% 108%, ${c.secondary} 0%, ${fade(c.secondary)} 45%)`,
    `radial-gradient(circle at 62% 42%, ${c.primary} 0%, ${fade(c.primary)} 40%)`,
  ].join(', ');

  return (
    <View style={[styles.card, { minHeight: big ? 440 : 360, padding: big ? 36 : Space.xl, backgroundColor: theme.gradients.heroBase }]}>
      {event.cover_image ? (
        <>
          <Image source={{ uri: event.cover_image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          <View style={[StyleSheet.absoluteFill, theme.gradient(`linear-gradient(100deg, ${theme.gradients.heroBase} 10%, ${theme.gradients.heroBase}CC 45%, ${theme.gradients.heroBase}33 100%)`)]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { opacity: theme.isDark ? 0.85 : 0.75 }, theme.gradient(glow)]} />
      )}

      <View style={styles.topRow}>
        <Eyebrow label={`${ROLE_LABEL[role]} · ${whenLabel(start, end, now)}`} onDark />
        {isPledgeEvent(event) && <Eyebrow label={`${formatMoney(event.deposit_cents)} pledge`} onDark />}
      </View>

      <View style={{ flex: 1 }} />

      <Text style={[styles.title, big ? styles.titleBig : styles.titleSmall]} numberOfLines={3}>{event.title}</Text>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={15} color={c.onScrim} />
          <Text style={styles.metaText}>{format(start, 'EEE d MMM · h:mm a')}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={15} color={c.onScrim} />
          <Text style={styles.metaText} numberOfLines={1}>{place}</Text>
        </View>
      </View>

      <View style={[styles.bottomRow, !big && { flexDirection: 'column', alignItems: 'stretch' }]}>
        {left > 0 ? (
          <View style={styles.countdown}>
            {parts.map((p) => (
              <View key={p.unit} style={styles.unit}>
                <Text style={styles.unitValue}>{String(p.value).padStart(2, '0')}</Text>
                <Text style={styles.unitLabel}>{p.unit}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Eyebrow label={end && now >= end ? 'Finished' : 'Happening now'} dot={c.success} onDark />
        )}
        <PressableScale onPress={onOpen} style={[styles.open, !big && { alignSelf: 'flex-start' }]} accessibilityLabel={`Open ${event.title}`}>
          <Text style={styles.openText}>Open event</Text>
          <View style={styles.openArrow}><Ionicons name="arrow-forward" size={16} color={c.onScrim} /></View>
        </PressableScale>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: { borderRadius: Radius.xl, overflow: 'hidden', gap: Space.md, ...t.shadow(5) },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: Space.sm },
  title: { fontFamily: Fonts.display, color: t.colors.onScrim },
  titleBig: { fontSize: 64, lineHeight: 64, letterSpacing: -3, maxWidth: 520 },
  titleSmall: { fontSize: 40, lineHeight: 42, letterSpacing: -1.8 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.lg },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  metaText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: t.colors.onScrim, opacity: 0.9 },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Space.lg, marginTop: Space.sm },
  countdown: { flexDirection: 'row', gap: Space.sm },
  unit: {
    width: 64, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center', gap: 2,
    backgroundColor: t.colors.scrimButton, borderWidth: 1, borderColor: t.colors.scrimButton,
  },
  unitValue: { fontFamily: Fonts.display, fontSize: 26, lineHeight: 28, color: t.colors.onScrim, fontVariant: ['tabular-nums'] },
  unitLabel: { fontFamily: Fonts.bodyBold, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase', color: t.colors.onScrim, opacity: 0.7 },
  // White pill with an ink arrow, the same in both themes (it sits on the dark hero)
  open: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingLeft: 22, paddingRight: 6, paddingVertical: 6,
    borderRadius: Radius.pill, backgroundColor: t.colors.onScrim, ...t.shadow(2),
  },
  openText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: t.colors.scrim },
  openArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.scrim, alignItems: 'center', justifyContent: 'center' },
}));
