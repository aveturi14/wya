import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import IconButton from './IconButton';
import { PosterThumb } from './Poster';

/**
 * The slim header for an event's chat, bills and photos: back, a 34pt poster
 * thumbnail, the title and a line under it, and an optional action on the right,
 * all on one line.
 */
export default function EventHeader({ title, theme: themeName, imageUrl, subtitle, onBack, right }: {
  title: string;
  theme: string | null | undefined;
  imageUrl?: string | null;
  subtitle?: string | null;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm + 2 }}>
      {onBack && <IconButton icon="chevron-back" label="Back" onPress={onBack} size={36} />}
      <PosterThumb title={title} theme={themeName} imageUrl={imageUrl} small />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[theme.type.value, { fontFamily: theme.type.sectionHeading.fontFamily }]} numberOfLines={1} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={theme.type.micro} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
