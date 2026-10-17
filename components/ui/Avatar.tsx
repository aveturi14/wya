import { Fonts, inkOn, PERSON_FILLS } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

// Same person, same colour, everywhere
function fillFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PERSON_FILLS[Math.abs(h) % PERSON_FILLS.length];
}

/** A face: the photo, or the initial on the person's colour. `ring` adds an edge in the page colour (for stacks). */
export function Avatar({ name, url, seed, size = 36, ring }: { name: string | null; url?: string | null; seed: string; size?: number; ring?: boolean }) {
  const { theme } = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };
  const edge = ring ? { borderWidth: Math.max(1.5, size * 0.07), borderColor: theme.colors.background } : null;
  if (url) return <Image source={{ uri: url }} style={[shape, edge]} contentFit="cover" accessibilityIgnoresInvertColors />;
  const fill = fillFor(seed);
  return (
    <View style={[shape, { backgroundColor: fill, justifyContent: 'center', alignItems: 'center' }, edge]}>
      <Text style={{ fontFamily: Fonts.bodyBold, fontSize: Math.round(size * 0.4), color: inkOn(fill) }}>{(name ?? '?')[0]?.toUpperCase()}</Text>
    </View>
  );
}

/** Overlapping faces plus "Gary, Jo + 6". `label={false}` shows the faces alone. */
export function AvatarStack({ people, max = 4, size = 24, label = true }: {
  people: { id: string; name: string | null; avatarUrl?: string | null }[];
  max?: number;
  size?: number;
  label?: boolean;
}) {
  const { theme } = useTheme();
  if (people.length === 0) return null;
  // The first few faces and names, then a count: "Ava, Ben, Chloe, Dan + 26 others"
  const shown = people.slice(0, max);
  const names = shown.map((p) => (p.name ?? 'Someone').split(' ')[0]);
  const rest = people.length - shown.length;
  const text = rest > 0
    ? `${names.join(', ')} + ${rest} ${rest === 1 ? 'other' : 'others'}`
    : names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessible={!label} accessibilityLabel={label ? undefined : text}>
      <View style={{ flexDirection: 'row' }}>
        {shown.map((p, i) => (
          <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -size * 0.32 }}>
            <Avatar name={p.name} url={p.avatarUrl} seed={p.id} size={size} ring />
          </View>
        ))}
      </View>
      {label && <Text style={[theme.type.caption, { flexShrink: 1 }]}>{text}</Text>}
    </View>
  );
}
