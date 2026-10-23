/**
 * Draft 2: everything the film says and shows, in one place. One night out
 * (Harbour Sessions), four friends, Alex pays for dinner, everyone settles up.
 * Amounts are worked out the way the app does (receipt_shares): items as claimed,
 * the 10% surcharge split by what each person ordered.
 */
export const FPS = 30;
export const BEAT = 14; // 128.57 BPM
export const BAR = BEAT * 4;

export const SCENES = {
  hook: { from: 0, bars: 3 },
  promise: { from: 3, bars: 2 },
  plan: { from: 5, bars: 6 },
  split: { from: 11, bars: 7 },
  settle: { from: 18, bars: 5 },
  next: { from: 23, bars: 5 },
  close: { from: 28, bars: 3 },
} as const;
export type SceneName = keyof typeof SCENES;
export const BARS = 31;
export const DURATION = BAR * BARS; // 1736 frames ≈ 57.9 s
export const from = (s: SceneName) => SCENES[s].from * BAR;
export const len = (s: SceneName) => SCENES[s].bars * BAR;

export const PEOPLE = ['Alex', 'Maya', 'Jamie', 'Sam'] as const;
export type Person = (typeof PEOPLE)[number];
export const PAYER: Person = 'Alex';
export const ME: Person = 'Maya'; // whose phone we see in the split

export const EVENT = { title: 'Harbour Sessions', line: "you're hosting", day: 'SAT 14 NOV', time: '7PM', place: 'The Harbour Stage', when: 'In 2 days' };

// The dinner bill (lib/demoReceipt.ts lines)
export const BILL = { merchant: "Nonna's", description: 'Dinner at Nonna\'s', surchargeName: 'Sunday surcharge 10%', surchargeCents: 960, itemsCents: 9600, totalCents: 10560 };
export const LINES: { name: string; qty: number; cents: number; who: Person[]; caption: string }[] = [
  { name: 'Margherita', qty: 1, cents: 2400, who: ['Maya'], caption: 'Maya' },
  { name: 'Lasagne', qty: 1, cents: 2800, who: ['Jamie'], caption: 'Jamie' },
  { name: 'Garlic bread', qty: 1, cents: 1200, who: ['Alex', 'Maya', 'Jamie', 'Sam'], caption: '$3.00 each' },
  { name: 'Spritz', qty: 2, cents: 3200, who: ['Maya', 'Sam'], caption: 'Maya ×1 · Sam ×1' },
];
// Each person's share: food + their part of the surcharge
export const SHARES: Record<Person, { food: number; extra: number; total: number }> = {
  Alex: { food: 300, extra: 30, total: 330 },
  Maya: { food: 4300, extra: 430, total: 4730 },
  Jamie: { food: 3100, extra: 310, total: 3410 },
  Sam: { food: 1900, extra: 190, total: 2090 },
};
export const OWED_TO_PAYER = SHARES.Maya.total + SHARES.Jamie.total + SHARES.Sam.total; // 10230
export const WALLET_START = 10000;

// The next plan: tickets, chipped in before anyone pays
export const TICKET_CENTS = 4500;
export const TICKETS_TOTAL = TICKET_CENTS * 4;

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const dollars = (cents: number) => `$${Math.round(cents / 100)}`;

export const CHAT = [
  { who: 'Maya', text: 'Harbour Sessions this weekend?' },
  { who: 'Jamie', text: "I'm in!!" },
  { who: 'Sam', text: 'same' },
  { who: 'Alex', text: "I'll grab dinner" },
  { who: 'Maya', text: 'wait who owes who' },
] as const;

/** Narration (optional, read by VOICEOVER.md / make_vo.py). `at` is scene-relative. */
export const VO = [
  { id: 'v1', scene: 'hook', at: 4, text: "Everyone's in. Then someone's chasing everyone for money." },
  { id: 'v2', scene: 'promise', at: 2, text: 'Where You At. Plan it, split it, settle up.' },
  { id: 'v3', scene: 'plan', at: 8, text: 'Make the plan, send one link, and watch everyone say I\'m in.' },
  { id: 'v4', scene: 'split', at: 8, text: 'Alex pays for dinner and snaps the receipt. Everyone ticks what they had, and the app does the maths.' },
  { id: 'v5', scene: 'settle', at: 6, text: 'Tap to pay Alex back. Everyone sees who\'s paid. Nobody chases anyone.' },
  { id: 'v6', scene: 'next', at: 6, text: 'Next time, everyone chips in first, and the group pays as one.' },
  { id: 'v7', scene: 'close', at: 10, text: 'Less chasing. More going. Where You At.' },
] as const;
