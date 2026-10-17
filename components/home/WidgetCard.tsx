import Card from '@/components/ui/Card';
import Eyebrow from '@/components/ui/Eyebrow';
import PressableScale from '@/components/ui/PressableScale';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { ReactNode } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

/** A dashboard card: an eyebrow label, an optional note or action on the right, then the content. */
export default function WidgetCard({ label, dot, right, onRight, children, style }: {
  label: string;
  dot?: string;
  right?: string;
  onRight?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  return (
    <Card style={[{ gap: Space.lg, padding: Space.xl, borderRadius: Radius.xl }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md }}>
        <Eyebrow label={label} dot={dot} />
        {right && (onRight ? (
          <PressableScale onPress={onRight} hitSlop={8} scaleTo={0.96}>
            <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{right}</Text>
          </PressableScale>
        ) : (
          <Text style={[theme.type.caption, { flexShrink: 1, textAlign: 'right' }]} numberOfLines={1}>{right}</Text>
        ))}
      </View>
      {children}
    </Card>
  );
}
