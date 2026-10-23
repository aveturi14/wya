/**
 * Every fictional name, price, label and timing in the film lives here, so amounts
 * can't drift between scenes. Harbour Sessions is a made-up event; the people are
 * fictional. Amounts exclude any applicable fees (the wallet is a test balance).
 */

export const FPS = 30;
// 128.57 BPM: exactly 14 frames per beat at 30 fps, so cuts land on the beat
export const BEAT = 14;
export const BAR = BEAT * 4;
export const BARS = 43;
export const DURATION = BAR * BARS; // 2408 frames ≈ 80.3 s

export const PEOPLE = ['Alex', 'Maya', 'Jamie', 'Sam'] as const;
export type Person = (typeof PEOPLE)[number];
export const ORGANISER: Person = 'Alex';

export const EVENT = {
  title: 'Harbour Sessions',
  line: 'saturday night', // the poster's serif accent line
  city: 'Sydney',
  day: 'Sat 14 Nov',
  time: '7:00 PM',
  place: 'Harbour stage, Sydney',
  look: 'sunset' as const,
};

export const SHARE_CENTS = 4500;
export const TOTAL_CENTS = SHARE_CENTS * PEOPLE.length; // 18000
export const OWED_CENTS = TOTAL_CENTS - SHARE_CENTS; // what the other three pay the organiser back

export const money = (cents: number, decimals = false) =>
  `$${decimals ? (cents / 100).toFixed(2) : Math.round(cents / 100)}`;

export const CHAT = [
  { who: 'Maya', text: 'Harbour Sessions this weekend?' },
  { who: 'Jamie', text: "I'm in!" },
  { who: 'Sam', text: 'Same.' },
  { who: 'Alex', text: "Who's booking?" },
  { who: 'Maya', text: "Wait, who's paid?" },
  { who: 'Jamie', text: '??' },
] as const;

// The app's own labels (components/event/RsvpBar, components/chat/SplitCard, app/wallet)
export const LABELS = {
  rsvp: ["I'm in", 'Maybe', "Can't go"],
  owes: 'Owes',
  paidTheBill: 'Paid the bill',
  paid: 'Paid',
  testBalance: 'test balance',
};

// Scene boundaries in bars (each scene starts on a downbeat)
export const SCENES = {
  chat: { from: 0, bars: 4 },
  intro: { from: 4, bars: 4 },
  invite: { from: 8, bars: 6 },
  split: { from: 14, bars: 7 },
  payback: { from: 21, bars: 7 },
  concept: { from: 28, bars: 7 },
  checkout: { from: 35, bars: 4 },
  close: { from: 39, bars: 4 },
} as const;
export type SceneName = keyof typeof SCENES;
export const sceneFrom = (s: SceneName) => SCENES[s].from * BAR;
export const sceneLength = (s: SceneName) => SCENES[s].bars * BAR;

/**
 * Narration, one line per clip. `at` is the scene-relative frame the line starts on.
 * Recorded clips go in public/audio/vo/<id>.wav (see VOICEOVER.md); a missing clip is
 * skipped, so the film renders with or without a voice.
 */
export const VO = [
  { id: 's1', scene: 'chat', at: 6, text: "Making plans with friends? Easy. Getting everyone to actually commit, split the cost, and pay you back? That's another story." },
  { id: 's2', scene: 'intro', at: 10, text: 'Meet Where You At. One link turns the group chat into an actual plan.' },
  { id: 's3', scene: 'invite', at: 8, text: "Send the invite once. Everyone taps I'm in, Maybe, or Can't go, so you know who's really coming. Saying yes isn't paying, though. That bit's next." },
  { id: 's4', scene: 'split', at: 6, text: "Alex grabbed the tickets: a hundred and eighty bucks. Split it four ways and everyone sees their share. Forty-five each. Dinner after? Snap the receipt, and everyone ticks what they had." },
  { id: 's5', scene: 'payback', at: 6, text: "Then everyone pays Alex back, right in the app. You can see who's paid and who hasn't, without chasing anyone. Four of four. Sorted." },
  { id: 's6', scene: 'concept', at: 10, text: "And here's where Where You At is heading. Everyone chips in first, the money lands in one place, and it powers a virtual card. So nobody has to front the whole thing." },
  { id: 's7', scene: 'checkout', at: 8, text: 'One group. Every share covered. One simple checkout.' },
  { id: 's8', scene: 'close', at: 14, text: 'Less chasing. More going. Where You At.' },
] as const;

/** Absolute frame for a VO line; rough length at about 185 words a minute (for ducking until real clips exist). */
export const voWindow = (v: (typeof VO)[number]) => {
  const words = v.text.split(/\s+/).length;
  const start = sceneFrom(v.scene as SceneName) + v.at;
  return { start, end: start + Math.round((words / 185) * 60 * FPS) + 10 };
};
