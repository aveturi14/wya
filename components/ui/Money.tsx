import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/lib/pledges';
import { StyleProp, Text, TextStyle } from 'react-native';

/**
 * An amount in Geist Mono with even-width digits, so columns of money line up.
 * Pass `cents` (formatted the app's usual way) or a ready `value` ("−$39.60").
 */
export default function Money({ cents, value, size = 15, tone = 'text', weight = 'medium', style }: {
  cents?: number;
  value?: string;
  size?: number;
  tone?: 'text' | 'secondary' | 'success' | 'danger' | 'warning';
  weight?: 'regular' | 'medium';
  style?: StyleProp<TextStyle>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const color = { text: c.text, secondary: c.textSecondary, success: c.successText, danger: c.dangerText, warning: c.warningText }[tone];
  return (
    <Text
      style={[{
        fontFamily: weight === 'medium' ? Fonts.mono : Fonts.monoRegular,
        fontSize: size,
        lineHeight: Math.round(size * 1.2),
        letterSpacing: size >= 28 ? -size * 0.03 : 0,
        fontVariant: ['tabular-nums'],
        color,
      }, style]}
      numberOfLines={1}
    >
      {value ?? formatMoney(cents ?? 0)}
    </Text>
  );
}
