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
  const ring = { borderWidth: 2, borderColor: theme.isDark ? theme.colors.background : theme.colors.outline };
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
  const shown = people.slice(0, max);
  const names = people.slice(0, 2).map((p) => (p.name ?? 'Someone').split(' ')[0]);
  const rest = people.length - names.length;
  const label = rest > 0 ? `${names.join(', ')} + ${rest}` : names.join(' and ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flexDirection: 'row' }}>
        {shown.map((p, i) => (
          <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -size * 0.35 }}>
            <Avatar name={p.name} url={p.avatarUrl} seed={p.id} size={size} />
          </View>
        ))}
      </View>
      <Text style={theme.type.caption}>{label}</Text>
    </View>
  );
}
