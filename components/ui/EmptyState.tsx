import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * Nothing here yet: a quiet icon (or `art`, such as a sample poster), a title, a line
 * of help and an optional action.
 */
export default function EmptyState({ icon, title, body, action, art }: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  action?: ReactNode;
  art?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: Space.md, paddingVertical: Space.xxl, paddingHorizontal: Space.lg }}>
      {art ?? (icon && (
        <View style={{ width: 56, height: 56, borderRadius: Radius.lg, backgroundColor: theme.colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name={icon} size={26} color={theme.colors.textSecondary} />
        </View>
      ))}
      <Text style={[theme.type.heading, { textAlign: 'center' }]}>{title}</Text>
      {body && <Text style={[theme.type.bodySecondary, { textAlign: 'center', maxWidth: 360 }]}>{body}</Text>}
      {action}
    </View>
  );
}
