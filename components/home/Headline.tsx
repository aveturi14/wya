import Eyebrow from '@/components/ui/Eyebrow';
import GradientText from '@/components/ui/GradientText';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { format } from 'date-fns';
import { Text, View } from 'react-native';

function greeting(d: Date) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  if (h >= 17) return 'Evening';
  return 'Hey';
}

/**
 * "Evening, Hannah. / 3 plans are actually / happening." — the count is your
 * upcoming plans that are really on (hosting, or you said I'm in).
 */
export default function Headline({ name, planCount, big }: { name: string; planCount: number; big: boolean }) {
  const { theme } = useTheme();
  const now = new Date();
  const size = big ? 76 : 42;
  const line = { fontFamily: Fonts.display, fontSize: size, lineHeight: size * 1.02, letterSpacing: -size * 0.05 };
  const [second, third] = planCount === 0
    ? ["Nothing's planned", 'yet.']
    : [`${planCount} ${planCount === 1 ? 'plan is' : 'plans are'} actually`, 'happening.'];
  return (
    <View style={{ gap: big ? 18 : 12 }}>
      <Eyebrow label={format(now, 'EEEE · d MMMM')} dot={theme.colors.primary} />
      <View>
        <Text style={[line, { color: theme.colors.text }]}>{greeting(now)}, {name}.</Text>
        <GradientText colors={theme.gradients.headline} style={line}>{second}</GradientText>
        <GradientText colors={theme.gradients.headlineWarm} style={line}>{third}</GradientText>
      </View>
    </View>
  );
}
