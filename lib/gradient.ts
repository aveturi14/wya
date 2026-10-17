import { Platform, ViewStyle } from 'react-native';

/**
 * A CSS gradient as a view style. React Native 0.86 draws CSS `linear-gradient` and
 * `radial-gradient` (layered, with `transparent` stops) through
 * `experimental_backgroundImage` on iOS and Android; on the web it's the plain
 * `backgroundImage`, which React Native Web passes through to the page.
 */
export function gradient(css: string): ViewStyle {
  return (Platform.OS === 'web' ? { backgroundImage: css } : { experimental_backgroundImage: css }) as ViewStyle;
}
