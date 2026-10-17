import { EventThemes } from '@/constants/eventThemes';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Image, Text, View } from 'react-native';

const FILLS = Object.values(EventThemes);

// Same person, same color, everywhere
function fillFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return FILLS[Math.abs(h) % FILLS.length];
}

export function Avatar({ name, url, seed, size = 36 }: { name: string | null; url?: string | null; seed: string; size?: number }) {
  const { theme } = useTheme();
  // A ring in the page colour (white in light) separates overlapping faces
  const ring = { borderWidth: 2, borderColor: theme.isDark ? theme.colors.background : theme.colors.surface };
  if (url) return <Image source={{ uri: url }} style={[{ width: size, height: size, borderRadius: size / 2 }, ring]} />;
  const fill = fillFor(seed);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: fill.base, justifyContent: 'center', alignItems: 'center' }, ring]}>
      <Text style={{ fontFamily: Fonts.display, fontSize: size * 0.42, color: fill.ink }}>{(name ?? '?')[0]?.toUpperCase()}</Text>
    </View>
  );
}

/** Overlapping avatars plus "Gary, Jo + 6". */
export function AvatarStack({ people, max = 4, size = 28 }: {
  people: { id: string; name: string | null; avatarUrl?: string | null }[];
  max?: number;
  size?: number;
}) {
  const { theme } = useTheme();
  if (people.length === 0) return null;
  // The first few faces and names, then a count: "Ava, Ben, Chloe, Dan + 26 others"
  const shown = people.slice(0, max);
  const names = shown.map((p) => (p.name ?? 'Someone').split(' ')[0]);
  const rest = people.length - shown.length;
  const label = rest > 0
    ? `${names.join(', ')} + ${rest} ${rest === 1 ? 'other' : 'others'}`
    : names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flexDirection: 'row' }}>
        {shown.map((p, i) => (
          <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -size * 0.35 }}>
            <Avatar name={p.name} url={p.avatarUrl} seed={p.id} size={size} />
          </View>
        ))}
      </View>
      <Text style={[theme.type.caption, { flexShrink: 1 }]}>{label}</Text>
    </View>
  );
}
