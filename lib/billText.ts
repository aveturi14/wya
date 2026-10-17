/**
 * Typing a bill instead of scanning it (Phase 8.18): "/bill pizza 24, 2 beers 26,
 * service 10%" in the chat, or pasted into the bill editor. One line per item,
 * split by commas or new lines. The payer still checks everything before sending.
 *
 *   "Garlic bread 12"  "Garlic bread $12.00"  "2 x Tiger 26"  "Tiger x2 26"  "2 beers 26"
 *   "Sunday surcharge 10%"  "Service 24.15"  "Discount -5"  "Tip 10"
 *
 * Surcharges, service, tips, fees and discounts become adjustments (split by
 * what each person ordered). GST/tax lines are skipped: Australian prices
 * already include it. A percentage is worked out from the items.
 */

export type ParsedBillLine = {
  name: string;
  quantity: number;
  amount_cents: number;
  kind: 'item' | 'adjustment';
  rate_bp?: number | null;
};

export type ParsedBill = {
  description: string | null;
  lines: ParsedBillLine[];
  // Parts we couldn't read (no amount), so the screen can say so
  skipped: string[];
};

const ADJUSTMENT = /\b(surcharge|service|tip|tips|gratuity|fee|fees|discount|voucher|promo|delivery|corkage|cakeage|late night)\b/i;
const DISCOUNT = /\b(discount|voucher|promo)\b/i;
const TAX = /\b(gst|tax)\b/i;
const TOTALS = /^\s*(sub\s*total|subtotal|total|balance|amount due|eftpos|cash|change|card)\b/i;

function cents(text: string): number | null {
  const m = text.replace(/[$,\s]/g, '').match(/^(-)?(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const value = parseInt(m[2], 10) * 100 + parseInt((m[3] ?? '0').padEnd(2, '0'), 10);
  return m[1] ? -value : value;
}

export function parseBillText(text: string): ParsedBill {
  let body = text.trim();
  let description: string | null = null;
  // "Dinner at Ming's: pizza 24, beer 12" names the bill
  const colon = body.indexOf(':');
  if (colon > 0 && colon < 60 && !/\d/.test(body.slice(0, colon))) {
    description = body.slice(0, colon).trim() || null;
    body = body.slice(colon + 1);
  }

  const items: ParsedBillLine[] = [];
  const percents: { name: string; bp: number }[] = [];
  const adjustments: ParsedBillLine[] = [];
  const skipped: string[] = [];

  // Commas separate lines, except thousands separators ("1,250.50")
  for (const raw of body.split(/[\n;]+|,(?!\d{3}(?:\D|$))/)) {
    const part = raw.trim().replace(/\s+/g, ' ');
    if (!part || TOTALS.test(part) || TAX.test(part)) continue;

    // "Sunday surcharge 10%" / "service 10 %"
    const pct = part.match(/^(.*?)\s*(-?\d+(?:\.\d+)?)\s*%\s*$/);
    if (pct && pct[1].trim()) {
      percents.push({ name: part, bp: Math.round(parseFloat(pct[2]) * 100) });
      continue;
    }

    // The amount is the last number: "Tiger x2 26", "2 beers $26.00"
    const amountMatch = part.match(/^(.*?)\s*(-?\$?\s*\d[\d,]*(?:\.\d{1,2})?)\s*$/);
    const amount = amountMatch ? cents(amountMatch[2]) : null;
    let name = amountMatch?.[1]?.trim() ?? '';
    if (amount == null || !name) { skipped.push(part); continue; }

    let quantity = 1;
    const lead = name.match(/^(\d{1,3})\s*(?:x|×)?\s+(.+)$/i);   // "2 x Tiger", "2 beers"
    const trail = name.match(/^(.+?)\s*(?:x|×)\s*(\d{1,3})$/i);   // "Tiger x2"
    if (lead) { quantity = parseInt(lead[1], 10); name = lead[2]; }
    else if (trail) { name = trail[1]; quantity = parseInt(trail[2], 10); }
    name = name.replace(/[-–:]+$/, '').trim().slice(0, 80);
    if (!name || quantity < 1) { skipped.push(part); continue; }

    if (ADJUSTMENT.test(name) || amount < 0) {
      adjustments.push({ name, quantity: 1, amount_cents: DISCOUNT.test(name) ? -Math.abs(amount) : amount, kind: 'adjustment' });
    } else {
      items.push({ name, quantity, amount_cents: amount, kind: 'item' });
    }
  }

  const itemsTotal = items.reduce((t, l) => t + l.amount_cents, 0);
  for (const p of percents) {
    const bp = DISCOUNT.test(p.name) ? -Math.abs(p.bp) : p.bp;
    adjustments.push({ name: p.name.slice(0, 80), quantity: 1, amount_cents: Math.round((itemsTotal * bp) / 10000), kind: 'adjustment', rate_bp: bp });
  }
  return { description, lines: [...items, ...adjustments.filter((a) => a.amount_cents !== 0)], skipped };
}

export const billTotal = (lines: ParsedBillLine[]) => lines.reduce((t, l) => t + l.amount_cents, 0);
