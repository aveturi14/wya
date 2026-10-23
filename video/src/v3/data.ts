/**
 * Draft 3: the story of the reference film (Desktop/wya-film.mp4), tightened,
 * vertical, dark mode. Maya's 23rd: Maya hosts and pays for dinner; Alex, Jamie
 * and Sam come; Tom and Priya are invited. Every amount below adds up.
 */
export const FPS = 30;
export const BEAT = 14; // 128.57 BPM
export const BAR = BEAT * 4;

// Beats of the story, in order, with their length in bars
const ORDER = [
  ['hook', 4], ['problem', 3], ['home', 2], ['create', 3], ['open', 2], ['link', 3], ['pledge', 3], ['host', 2],
  ['chat', 3], ['album', 2], ['bill', 3], ['snap', 3], ['tick', 3], ['adds', 2], ['pay', 5], ['square', 2], ['close', 3],
] as const;
export type Beat = (typeof ORDER)[number][0];
export const BEATS: Record<Beat, { from: number; len: number }> = (() => {
  let at = 0;
  const out = {} as Record<Beat, { from: number; len: number }>;
  for (const [name, bars] of ORDER) { out[name] = { from: at * BAR, len: bars * BAR }; at += bars; }
  return out;
})();
export const BEAT_ORDER = ORDER.map((o) => o[0]);
export const TOTAL_BARS = ORDER.reduce((s, o) => s + o[1], 0); // 48
export const DURATION = TOTAL_BARS * BAR; // 2688 frames ≈ 89.6 s

export const HOST = 'Maya';
export const EVENT = { title: "Maya's 23rd", line: 'dinner for four', day: 'SAT 14 NOV · 7PM', place: 'Golden Lantern', address: '12 Dixon St, Haymarket', when: 'In 3 days' };

export const money = (c: number) => `$${(c / 100).toFixed(2)}`;

// The bill: Golden Lantern, $177.00 of food, a 10% weekend surcharge, $194.70 in all
export const RECEIPT = [
  { name: 'Pork dumplings (8)', qty: 2, cents: 2600, who: ['Maya', 'Alex'], caption: '$13.00 each' },
  { name: 'Crispy chicken', qty: 1, cents: 2400, who: ['Alex'], caption: 'Alex' },
  { name: 'Mapo tofu', qty: 1, cents: 1900, who: ['Jamie'], caption: 'Jamie' },
  { name: 'Beef noodles', qty: 1, cents: 2200, who: ['Sam'], caption: 'Sam' },
  { name: 'Egg fried rice', qty: 1, cents: 1600, who: ['Maya'], caption: 'Maya' },
  { name: 'House red', qty: 3, cents: 5400, who: ['Maya', 'Sam'], caption: 'Sam ×2 · Maya ×1' },
  { name: 'Lemonade', qty: 1, cents: 800, who: ['Jamie'], caption: 'Jamie' },
  { name: 'Edamame', qty: 1, cents: 800, who: ['Sam'], caption: 'Sam' },
] as const;
export const SUBTOTAL = 17700;
export const SURCHARGE = 1770;
export const TOTAL = 19470;
export const SHARES = { Maya: 5170, Alex: 4070, Jamie: 2970, Sam: 7260 } as const; // food + 10%, sums to 19470
export const EVEN = 4868; // $194.70 ÷ 4, rounded
export const ALEX_FOOD = 3700;
export const ALEX_EXTRA = 370;
export const WALLET_BEFORE = 6300;
export const TOPUP = 5000;
