/**
 * The voiceover script for draft 3+ (Kokoro af_heart; am_fenrir for a male read). Each line starts `at` frames
 * into its beat. The app is only ever said as "where you at" (never letters or abbreviations), as three
 * quick, lightly stressed words (make_vo3.py sets its phonemes). Lines only say what the picture doesn't.
 * scripts/make_vo3.py reads this file, writes public/audio/vo3/<id>.wav and records each clip's
 * length in voTimings.ts, which the film uses to place the clips and duck the music under them.
 */
import type { Beat } from './data';

export const VO: { id: string; beat: Beat; at: number; text: string }[] = [
  { id: 'h1', beat: 'hook', at: 10, text: 'Every night out, the group chat asks one thing.' },
  { id: 'h2', beat: 'hook', at: 104, text: 'Where you at?' },
  { id: 'h3', beat: 'hook', at: 172, text: 'So we built an app around it.' },
  { id: 'problem', beat: 'problem', at: 8, text: "Small plans fall apart in that chat. Nobody's sure who's actually coming." },
  { id: 'home', beat: 'home', at: 4, text: 'Where you at keeps every plan in one place.' },
  { id: 'create', beat: 'create', at: 10, text: 'Setting one up takes seconds.' },
  { id: 'open', beat: 'open', at: 4, text: "Can't agree on a time? Let everyone vote." },
  { id: 'link', beat: 'link', at: 8, text: 'Then share one link, and friends join in a tap.' },
  { id: 'pledge', beat: 'pledge', at: 4, text: 'Got friends who always bail? Add a five dollar fee for no-shows, just for fun.' },
  { id: 'host', beat: 'host', at: 6, text: "You'll know exactly who's coming." },
  { id: 'chat', beat: 'chat', at: 8, text: 'Everything for the night stays in one chat.' },
  { id: 'album', beat: 'album', at: 4, text: "And afterwards, everyone's photos end up in one album." },
  { id: 'bill', beat: 'bill', at: 4, text: 'Then the bill comes. One person pays, and nobody knows who owes what.' },
  { id: 'snap', beat: 'snap', at: 10, text: 'Just snap the receipt.' },
  { id: 'tick', beat: 'tick', at: 8, text: 'Everyone ticks what they had, and the maths is done for you.' },
  { id: 'pay', beat: 'pay', at: 8, text: 'Pay your share in one tap.' },
  { id: 'wallet', beat: 'pay', at: 124, text: 'Top up with Apple Pay, and cash out whenever you want.' },
  { id: 'square', beat: 'square', at: 4, text: "Everyone's square before the Uber home." },
  { id: 'close', beat: 'close', at: 6, text: 'Where you at. Plans that actually happen. Coming soon.' },
];
