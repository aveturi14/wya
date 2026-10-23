import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';
import { F } from './tokens';

// The app's own font files (public/fonts, OFL licences alongside). loadFont holds the
// render until each face has loaded, so no frame is drawn in a fallback font.
const faces = [
  { family: F.body, file: 'Geist_400Regular.ttf', weight: '400' },
  { family: F.body, file: 'Geist_500Medium.ttf', weight: '500' },
  { family: F.body, file: 'Geist_600SemiBold.ttf', weight: '600' },
  { family: F.body, file: 'Geist_700Bold.ttf', weight: '700' },
  { family: F.mono, file: 'GeistMono_500Medium.ttf', weight: '500' },
  { family: F.serif, file: 'InstrumentSerif_400Regular_Italic.ttf', weight: '400', style: 'italic' },
  { family: F.poster, file: 'ArchivoExpanded-Black.ttf', weight: '900' },
];

let started = false;
export function loadFonts() {
  if (started) return;
  started = true;
  for (const f of faces) {
    loadFont({ family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight, style: f.style ?? 'normal' });
  }
}
