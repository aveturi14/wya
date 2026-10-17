import Button from '@/components/ui/Button';
import Logo from '@/components/ui/Logo';
import Poster, { PosterGlow } from '@/components/ui/Poster';
import Screen from '@/components/ui/Screen';
import { useTopInset } from '@/components/ui/TabScreen';
import { Fonts, Space } from '@/constants/theme';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

// Three example posters fanned out, so the first screen already shows what an invite looks like
const FAN = [
  { title: 'Rooftop Night', theme: 'sunset', rotate: '-9deg', style: { left: '2%', top: 34 } },
  { title: 'Pub trivia', theme: 'lime', rotate: '8deg', style: { right: '2%', top: 12 } },
] as const;

export default function WelcomeScreen() {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  usePageTitle('Plans that actually happen');
  // Clear the status bar on every phone; browsers (no inset) keep a little air
  const topInset = useTopInset();

  return (
    <Screen style={[styles.container, { paddingTop: topInset + Space.lg }]}>
      <PosterGlow theme="violet" top={0} height={420} />
      <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.fan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {FAN.map((p) => (
          <View key={p.title} style={[styles.small, p.style, { transform: [{ rotate: p.rotate }] }]}>
            <Poster title={p.title} theme={p.theme} height={200} maxTitleSize={30} wobble={false} />
          </View>
        ))}
        <View style={[styles.small, styles.front]}>
          <Poster title="30" theme="violet" line="Jess turns" height={214} maxTitleSize={70} stickers={[{ label: '8 going', tone: 'light' }]} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(150).springify().damping(16)} style={styles.hero}>
        <Logo size={34} />
        <Text style={theme.type.display} accessibilityRole="header">
          Plans that <Text style={styles.serif}>actually</Text> happen.
        </Text>
        <Text style={theme.type.bodySecondary}>Invite your people. They RSVP. They show up.</Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(300).springify().damping(16)} style={styles.actions}>
        <Button title="Get started" size="lg" onPress={() => router.push('/(auth)/register')} />
        <Button title="I already have an account" variant="soft" size="lg" onPress={() => router.push('/(auth)/login')} />
      </Animated.View>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  container: { paddingHorizontal: Space.lg, paddingBottom: Space.xl, justifyContent: 'flex-end', gap: Space.lg },
  fan: { height: 300, maxWidth: 420, width: '100%', alignSelf: 'center' },
  small: { position: 'absolute', width: '52%' },
  front: { left: '22%', top: 66, transform: [{ rotate: '-1deg' }] },
  hero: { gap: Space.md },
  serif: { fontFamily: Fonts.serif, fontSize: 40 },
  actions: { gap: Space.sm },
}));
