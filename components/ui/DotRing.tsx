import { ReactNode, useMemo } from 'react';
import { View } from 'react-native';

type Segment = { share: number; colors: [string, string] };

/**
 * A progress ring made of many small overlapping dots, so it needs no SVG
 * library and looks like a continuous stroke with round ends. Segments fill
 * clockwise from the top, each with its own gradient; the rest is the track.
 */
export default function DotRing({ size, stroke, segments, track, children }: {
  size: number;
  stroke: number;
  segments: Segment[];
  track: string;
  children?: ReactNode;
}) {
  const dots = useMemo(() => {
    const radius = (size - stroke) / 2;
    // Enough dots that neighbours overlap: about one per third of a stroke along the circle
    const count = Math.max(48, Math.round((2 * Math.PI * radius) / (stroke / 3)));
    const out: { x: number; y: number; color: string }[] = [];
    for (let i = 0; i < count; i++) {
      const at = i / count;
      let start = 0;
      let color = track;
      for (const s of segments) {
        if (s.share > 0 && at >= start && at < start + s.share) {
          color = mix(s.colors[0], s.colors[1], (at - start) / s.share);
          break;
        }
        start += s.share;
      }
      const angle = at * 2 * Math.PI - Math.PI / 2;
      out.push({ x: size / 2 + radius * Math.cos(angle) - stroke / 2, y: size / 2 + radius * Math.sin(angle) - stroke / 2, color });
    }
    // Track first, then coloured dots on top, so the arc's ends stay round
    return out.sort((a, b) => Number(a.color !== track) - Number(b.color !== track));
  }, [size, stroke, segments, track]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {dots.map((d, i) => (
        <View key={i} style={{ position: 'absolute', left: d.x, top: d.y, width: stroke, height: stroke, borderRadius: stroke / 2, backgroundColor: d.color }} />
      ))}
      {children}
    </View>
  );
}

// Blends two #RRGGBB colours (t from 0 to 1)
function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
