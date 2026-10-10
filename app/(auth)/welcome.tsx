import Button from '@/components/ui/Button';
import EventCover from '@/components/ui/EventCover';
import Logo from '@/components/ui/Logo';
import Screen from '@/components/ui/Screen';
import Sticker from '@/components/ui/Sticker';
import { Radius, Space } from '@/constants/theme';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

// A loose collage of example event covers, each tilted a little differently
const TILES = [
  { seed: 'rooftop', title: 'Rooftop', theme: 'bubblegum', rotate: '-8deg', top: 0, left: '4%' },
  { seed: 'brunch', title: 'Brunch', theme: 'lime', rotate: '6deg', top: 30, left: '38%' },
  { seed: 'game', title: 'Game night', theme: 'violet', rotate: '-4deg', top: 6, left: '68%' },
] as const;

export default function WelcomeScreen() {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  usePageTitle('Plans that actually happen');

  return (
    <Screen style={styles.container}>
      <Animated.View entering={FadeInDown.springify().damping(14)} style={styles.collage}>
        {TILES.map((tile) => (
          <View key={tile.seed} style={[styles.tile, { top: tile.top, left: tile.left, transform: [{ rotate: tile.rotate }] }]}>
            <EventCover seed={tile.seed} title={tile.title} theme={tile.theme} style={styles.tileCover} initialSize={64} />
          </View>
        ))}
        <Sticker label="8 going" bg={theme.colors.highlight} tilt={10} style={{ position: 'absolute', top: 120, left: '30%' }} />
        <Sticker label="Sat 9 PM" bg={theme.colors.secondary} fg={theme.colors.onSecondary} tilt={-8} style={{ position: 'absolute', top: 150, left: '62%' }} />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(150).springify().damping(16)} style={styles.hero}>
        <Logo size={56} />
        <Text style={theme.type.display}>Plans that{'\n'}actually happen.</Text>
        <Text style={theme.type.bodySecondary}>Invite your people. They RSVP. They show up. No more cooking for 30 and hosting 10.</Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(300).springify().damping(16)} style={styles.actions}>
        <Button title="Get started" size="lg" onPress={() => router.push('/(auth)/register')} />
        <Button title="I already have an account" variant="outline" onPress={() => router.push('/(auth)/login')} />
      </Animated.View>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  container: { padding: Space.xl, paddingTop: Space.xxxl, justifyContent: 'space-between' },
  collage: { height: 210 },
  tile: { position: 'absolute', width: '30%', aspectRatio: 0.85 },
  tileCover: {
    flex: 1, borderRadius: Radius.lg, borderWidth: t.outlineWidth, borderColor: t.colors.outline,
    ...(t.isDark ? {} : { boxShadow: `4px 4px 0px ${t.colors.outline}` }),
  },
  hero: { gap: Space.lg },
  actions: { gap: Space.md },
}));
