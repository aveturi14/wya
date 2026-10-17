import type { DraftLine } from '@/lib/receipts';

/**
 * The saved result for the demo receipt (the brief's Sunday dinner at Nonna's),
 * in case the Wi-Fi or the model fails on stage. Offered only on dev builds and
 * to @wya.test accounts (RCPT-3).
 */
export const DEMO_RECEIPT: { merchant: string; description: string; subtotalCents: number; totalCents: number; lines: Omit<DraftLine, 'key'>[] } = {
  merchant: "Nonna's",
  description: "Dinner at Nonna's",
  subtotalCents: 9600,
  totalCents: 10560,
  lines: [
    { name: 'Margherita', quantity: 1, amount_cents: 2400, kind: 'item' },
    { name: 'Lasagne', quantity: 1, amount_cents: 2800, kind: 'item' },
    { name: 'Garlic bread', quantity: 1, amount_cents: 1200, kind: 'item' },
    { name: 'Spritz', quantity: 2, amount_cents: 3200, kind: 'item' },
    { name: 'Sunday surcharge 10%', quantity: 1, amount_cents: 960, kind: 'adjustment', rate_bp: 1000 },
  ],
};

export const canUseDemoReceipt = (email: string | null | undefined) => __DEV__ || !!email?.endsWith('@wya.test');
