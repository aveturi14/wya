import Button from '@/components/ui/Button';
import ListRow, { IconSquare, ListGroup } from '@/components/ui/ListRow';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

export type NeedsYouItem = {
  key: string;
  // owe: you owe a host · bill: tick what you had (8.18) · excuse: a guest's excuse to decide on · attendance: mark Who came? · invite: unanswered invite
  kind: 'owe' | 'bill' | 'excuse' | 'attendance' | 'invite';
  title: string;
  subtitle: string;
  action: string;
  onPress: () => void;
  // What the item is about, for grouping ("Sunday gig and 1 more")
  about?: string;
};

// The most urgent first, and never a wall of cards
export const NEEDS_YOU_ORDER: NeedsYouItem['kind'][] = ['owe', 'bill', 'excuse', 'attendance', 'invite'];
export const NEEDS_YOU_MAX = 3;

const ICONS: Record<NeedsYouItem['kind'], keyof typeof Ionicons.glyphMap> = {
  owe: 'card-outline',
  bill: 'receipt-outline',
  excuse: 'chatbox-ellipses-outline',
  attendance: 'flag-outline',
  invite: 'mail-outline',
};

// A kind that turns up more than once becomes one row: "Mark who came · 2", "Sunday gig and 1 more"
const GROUP_TITLES: Partial<Record<NeedsYouItem['kind'], string>> = {
  attendance: 'Mark who came',
  invite: 'Are you coming?',
  excuse: 'Excuses to review',
  bill: 'What did you have?',
};

function group(items: NeedsYouItem[]): NeedsYouItem[] {
  const out: NeedsYouItem[] = [];
  for (const kind of NEEDS_YOU_ORDER) {
    const same = items.filter((i) => i.kind === kind);
    if (same.length === 0) continue;
    // Debts stay one per row: each is a different person and amount
    if (same.length === 1 || kind === 'owe' || !GROUP_TITLES[kind]) { out.push(...same); continue; }
    const first = same[0];
    out.push({
      ...first,
      key: `group:${kind}`,
      title: `${GROUP_TITLES[kind]} · ${same.length}`,
      subtitle: `${first.about ?? first.subtitle} and ${same.length - 1} more`,
    });
  }
  return out;
}

/** Things waiting on you, at the top of Events. Renders nothing when there's nothing to do. */
export default function NeedsYou({ items, heading = false }: { items: NeedsYouItem[]; heading?: boolean }) {
  const { theme } = useTheme();
  if (items.length === 0) return null;
  const shown = group(items).slice(0, NEEDS_YOU_MAX);
  return (
    <View style={{ gap: Space.sm }}>
      {heading && <Text style={theme.type.label}>Needs you</Text>}
      <ListGroup>
        {shown.map((item) => (
          <ListRow
            key={item.key}
            leading={<IconSquare icon={ICONS[item.kind]} color={theme.colors.secondary} />}
            title={item.title}
            subtitle={item.subtitle}
            onPress={item.onPress}
            trailing={<Button title={item.action} size="sm" variant={item.kind === 'owe' ? 'primary' : 'soft'} onPress={item.onPress} accessibilityLabel={`${item.action}: ${item.title}`} />}
          />
        ))}
      </ListGroup>
    </View>
  );
}
