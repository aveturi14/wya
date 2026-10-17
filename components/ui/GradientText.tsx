import { linear } from '@/constants/theme';
import { Platform, StyleProp, Text, TextStyle } from 'react-native';

/**
 * Text filled with a left-to-right gradient. Web clips a CSS gradient to the
 * glyphs; phones have no text masking here, so they use the gradient's first
 * colour (still on-brand, just flat). Extra bottom padding keeps descenders
 * (g, p, y) inside the painted box when lineHeight is tight.
 */
export default function GradientText({ colors, style, children }: {
  colors: [string, string];
  style?: StyleProp<TextStyle>;
  children: string;
}) {
  if (Platform.OS !== 'web') return <Text style={[style, { color: colors[0] }]}>{children}</Text>;
  return (
    <Text
      style={[
        style,
        {
          backgroundImage: linear(colors),
          backgroundClip: 'text',
          color: 'transparent',
          paddingBottom: 8,
          marginBottom: -8,
          alignSelf: 'flex-start',
        } as TextStyle,
      ]}
    >
      {children}
    </Text>
  );
}
