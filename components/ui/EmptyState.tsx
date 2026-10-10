import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';

export default function EmptyState({ icon, title, body, action }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: Space.md, paddingVertical: Space.xxxl, paddingHorizontal: Space.xl }}>
      <View style={{
        width: 72, height: 72, borderRadius: Radius.lg, backgroundColor: theme.colors.highlight,
        justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '-8deg' }],
        borderWidth: theme.isDark ? 0 : theme.outlineWidth, borderColor: theme.colors.outline,
      }}>
        <Ionicons name={icon} size={32} color={theme.colors.onHighlight} />
      </View>
      <Text style={[theme.type.heading, { textAlign: 'center' }]}>{title}</Text>
      {body && <Text style={[theme.type.bodySecondary, { textAlign: 'center' }]}>{body}</Text>}
      {action}
    </View>
  );
}
