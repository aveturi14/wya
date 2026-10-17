import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Children, Fragment, isValidElement, ReactNode } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import Card from './Card';
import PressableScale from './PressableScale';

/**
 * One line in a list: a leading thumbnail, face or icon, a title and subtitle, and
 * something trailing (a button, an amount, a chevron). Tappable if onPress is set.
 */
export default function ListRow({ leading, icon, iconColor, title, subtitle, trailing, chevron, onPress, style, accessibilityLabel, titleLines = 1, subtitleLines = 1 }: {
  leading?: ReactNode;
  icon?: keyof typeof Ionicons.glyphMap; // shorthand for a grey icon square
  iconColor?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  titleLines?: number;
  subtitleLines?: number;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const body = (
    <>
      {leading ?? (icon && <IconSquare icon={icon} color={iconColor} />)}
      <View style={styles.text}>
        {typeof title === 'string' ? <Text style={styles.title} numberOfLines={titleLines}>{title}</Text> : title}
        {subtitle != null && subtitle !== '' && (typeof subtitle === 'string'
          ? <Text style={theme.type.caption} numberOfLines={subtitleLines}>{subtitle}</Text>
          : subtitle)}
      </View>
      {trailing}
      {chevron && <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />}
    </>
  );
  if (!onPress) return <View style={[styles.row, style]}>{body}</View>;
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} style={[styles.row, style]} hoverStyle={styles.hover} accessibilityLabel={accessibilityLabel}>
      {body}
    </PressableScale>
  );
}

/** The grey rounded square that holds a row's icon. */
export function IconSquare({ icon, color, size = 34 }: { icon: keyof typeof Ionicons.glyphMap; color?: string; size?: number }) {
  const { theme } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: Radius.sm, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={color ?? theme.colors.textSecondary} />
    </View>
  );
}

/** A card of rows with hairlines between them. Falsy children are skipped. */
export function ListGroup({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'surface' | 'alt' }) {
  const styles = useStyles();
  const items = Children.toArray(children).filter((c) => isValidElement(c));
  if (items.length === 0) return null;
  return (
    <Card padded={false} style={style} tone={tone}>
      {items.map((child, i) => (
        <Fragment key={(child as { key?: string }).key ?? i}>
          {i > 0 && <View style={styles.divider} />}
          {child}
        </Fragment>
      ))}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md, paddingHorizontal: Space.md + 2, minHeight: 56 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...t.type.value, fontFamily: t.type.sectionHeading.fontFamily },
  hover: { backgroundColor: t.colors.surfaceAlt },
  divider: { height: 1, backgroundColor: t.colors.border, marginLeft: Space.md + 2 },
}));
