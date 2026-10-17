import { shrink } from '@/lib/album';
import { supabase } from '@/lib/supabase';
import { uploadFile } from '@/lib/upload';
import * as Crypto from 'expo-crypto';
import { ImagePickerAsset } from 'expo-image-picker';

/**
 * Itemised receipt splits (Phase 8.18). The database does all the maths and
 * checking (supabase/migrations/…_receipts.sql); this file holds the types for
 * get_receipt, the photo upload and the scan call.
 */

export type ReceiptStatus = 'draft' | 'claiming' | 'locked' | 'cancelled';

export type ReceiptLine = {
  id: string;
  position: number;
  name: string;
  quantity: number;
  amount_cents: number;
  // Surcharges, tips and discounts are 'adjustment': they split by what each person ordered
  kind: 'item' | 'adjustment';
  rate_bp: number | null;
  flagged: boolean;
  claimers: string[];
};

export type ReceiptPerson = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  is_payer: boolean;
  food_cents: number;
  adjust_cents: number;
  share_cents: number;
  claimed: boolean;
  // Only while their share is still the amount they agreed to
  confirmed: boolean;
};

export type SplitRow = {
  user_id: string; name: string | null; share_cents: number; status: string; is_payer: boolean;
  obligation_id: string | null; description: string; total_cents: number; split_status: string;
};

export type Receipt = {
  id: string;
  event_id: string;
  event_title: string;
  payer_id: string;
  payer_name: string | null;
  is_payer: boolean;
  description: string;
  merchant: string | null;
  status: ReceiptStatus;
  scan_source: 'model' | 'demo' | 'manual' | null;
  image_path: string | null;
  total_cents: number;
  printed_subtotal_cents: number | null;
  gst_included_cents: number | null;
  items_cents: number;
  claimed_cents: number;
  split_id: string | null;
  updated_at: string;
  lines: ReceiptLine[];
  people: ReceiptPerson[];
  // Why the payer can't lock yet, in plain words
  blockers: string[];
  // After locking: the 8.3 split rows (each person's debt status)
  split: SplitRow[] | null;
};

/** A line as the draft editor keeps it (no id until saved). */
export type DraftLine = {
  key: string;
  name: string;
  quantity: number;
  amount_cents: number;
  kind: 'item' | 'adjustment';
  rate_bp?: number | null;
  flagged?: boolean;
};

export async function getReceipt(id: string): Promise<Receipt | null> {
  const { data, error } = await supabase.rpc('get_receipt', { p_receipt_id: id });
  if (error) throw error;
  return (data as Receipt | null) ?? null;
}

/** Shrinks the photo to a JPEG (enough to read, small to send) and stores it in the payer's folder. */
export async function uploadReceiptPhoto(eventId: string, userId: string, asset: ImagePickerAsset): Promise<string> {
  const photo = await shrink(asset.uri, 2000, 0.8);
  return uploadFile('receipts', `${eventId}/${userId}/${Crypto.randomUUID()}.jpg`, photo.uri, 'image/jpeg');
}

/** A short-lived link to the receipt photo (the bucket is private). */
export async function receiptPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

export type ScanResult =
  | { ok: true; addsUp: boolean }
  // not_configured: no AI key yet (docs/PHASE8.md §3); the payer types the lines or uses the demo receipt
  | { ok: false; code: 'not_configured' | 'not_a_receipt' | 'no_items' | 'rate_limited' | 'failed'; message: string };

export async function scanReceipt(receiptId: string): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke('scan-receipt', { body: { receipt_id: receiptId } });
  if (!error) return { ok: true, addsUp: !!data?.adds_up };
  // FunctionsHttpError carries the response; anything else (offline, not deployed) is a plain failure
  const response = (error as { context?: Response }).context;
  // Not deployed yet answers 404 with no error code of ours: same as not set up
  if (response?.status === 404) return { ok: false, code: 'not_configured', message: '' };
  const body = await response?.json?.().catch(() => null);
  const code = body?.error;
  if (code === 'not_configured' || code === 'not_a_receipt' || code === 'no_items' || code === 'rate_limited') {
    return { ok: false, code, message: body?.message ?? '' };
  }
  return { ok: false, code: 'failed', message: body?.message ?? "Couldn't read it this time." };
}

/** Saves the draft editor's lines (replacing the ones on the bill). */
export async function saveDraft(receiptId: string, lines: DraftLine[], totalCents: number, printedSubtotalCents: number | null,
  description: string, source: 'model' | 'demo' | 'manual') {
  const { error } = await supabase.rpc('save_receipt_draft', {
    p_receipt_id: receiptId,
    p_items: lines.map(({ name, quantity, amount_cents, kind, rate_bp, flagged }) => ({ name, quantity, amount_cents, kind, rate_bp, flagged })),
    p_total_cents: totalCents,
    p_printed_subtotal_cents: printedSubtotalCents,
    p_source: source,
    p_description: description,
  });
  if (error) throw error;
}

/** "12.5" or "$12.50" → 1250; null if it isn't an amount. Negative allowed (discounts). */
export function parseCents(text: string): number | null {
  const match = text.trim().replace(/[$\s,]/g, '').match(/^(-)?(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const cents = parseInt(match[2], 10) * 100 + parseInt((match[3] ?? '0').padEnd(2, '0'), 10);
  return match[1] ? -cents : cents;
}

/** "$12.50" with the cents always shown, for bills (formatMoney drops ".00"). */
export const billMoney = (cents: number) => `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`;

export const firstName = (name: string | null | undefined, fallback = 'Someone') => name?.split(' ')[0] ?? fallback;
