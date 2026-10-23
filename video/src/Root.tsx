import { Composition, Still } from 'remotion';
import Cover from './Cover';
import { DURATION, FPS } from './data/demo';
import MainFilm from './MainFilm';
import FilmV2 from './v2/Film';
import { DURATION as DURATION_V2 } from './v2/data';
import FilmV3 from './v3/Film';
import { DURATION as DURATION_V3 } from './v3/data';
import { loadFonts } from './styles/fonts';

loadFonts();

export const RemotionRoot = () => (
  <>
    {/* WHERE_YOU_AT_LAUNCH_REEL.mp4: 1080×1920, 30 fps, ~80 s */}
    <Composition id="LaunchReel" component={MainFilm} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
    {/* Draft 2: the app's real screens up front, faster, ~58 s */}
    <Composition id="LaunchReelV2" component={FilmV2} durationInFrames={DURATION_V2} fps={FPS} width={1080} height={1920} />
    {/* Draft 3: the reference film's story, dark mode, ~86 s */}
    <Composition id="LaunchReelV3" component={FilmV3} durationInFrames={DURATION_V3} fps={FPS} width={1080} height={1920} defaultProps={{ voice: 'vo3' as const }} />
    {/* The same film with the male voiceover */}
    <Composition id="LaunchReelV3Male" component={FilmV3} durationInFrames={DURATION_V3} fps={FPS} width={1080} height={1920} defaultProps={{ voice: 'vo3m' as const }} />
    {/* REEL_POSTER.png */}
    <Still id="Poster" component={Cover} width={1080} height={1920} />
  </>
);
