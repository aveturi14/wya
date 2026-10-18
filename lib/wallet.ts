import { freshChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

/**
 * The wya wallet (Phase 9.11, test balance). The database does everything that
 * matters (supabase/migrations/…_wallet.sql): who can pay what, exact amounts,
 * once, never below zero. This file reads the wallet and calls those functions.
 *
 * Cards are a proof of concept: the full number and CVC stay on this device and
 * only the brand, last 4 digits and expiry are saved, to show the card later.
 */

export type WalletMethod = {
  id: string;
  kind: 'card' | 'apple_pay';
  brand: CardBrand | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  label: string;
  is_default: boolean;
};

export type WalletActivity = {
  id: string;
  kind: 'topup' | 'payment' | 'cashout' | 'test_reset';
  direction: 'in' | 'out';
  amount_cents: number; // signed: + into your wallet, − out of it
  title: string; // "Paid Gary", "Jo paid you", "Topped up"
  subtitle: string | null; // "Dinner at Uncle Ming's · Friday dinner", "Visa ••4242"
  other_id: string | null;
  other_name: string | null;
  obligation_id: string | null;
  created_at: string;
};

export type Wallet = {
  balance_cents: number;
  currency: 'AUD';
  test_mode: boolean;
  limits: { max_topup_cents: number; max_balance_cents: number; monthly_topup_cents: number; topped_up_this_month_cents: number };
  methods: WalletMethod[];
  activity: WalletActivity[];
};

/** Your wallet, live: reloads on focus and whenever its balance changes. */
export function useWallet() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(async () => {
    const { data, error: failed } = await supabase.rpc('get_my_wallet');
    if (failed) { setError(failed); return; }
    setError(null);
    setWallet(data as Wallet);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    // Someone paying you moves your balance; RLS only sends your own wallet row
    const channel = freshChannel('wallet')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);
  return { wallet, error, reload: load };
}

export type PayResult = { already_paid: boolean; txn_id: string; paid_to: string | null; paid_to_id: string; amount_cents: number; balance_after: number };

/** Pay one debt. `expectedCents` is the amount the person was shown; the database refuses anything else. */
export async function payFromWallet(obligationId: string, expectedCents: number): Promise<PayResult> {
  const { data, error } = await supabase.rpc('pay_from_wallet', { p_obligation_id: obligationId, p_expected_cents: expectedCents });
  if (error) throw error;
  return data as PayResult;
}

export async function topUp(cents: number, methodId: string): Promise<number> {
  const { data, error } = await supabase.rpc('test_topup', { p_cents: cents, p_method_id: methodId });
  if (error) throw error;
  return (data as { balance_cents: number }).balance_cents;
}

/** Take money back out (test balance): to one of your saved cards or Apple Pay. */
export async function cashOut(cents: number, methodId: string): Promise<number> {
  const { data, error } = await supabase.rpc('test_cashout', { p_cents: cents, p_method_id: methodId });
  if (error) throw error;
  return (data as { balance_cents: number }).balance_cents;
}

export async function addApplePay(): Promise<string> {
  const { data, error } = await supabase.rpc('add_wallet_method', { p_kind: 'apple_pay' });
  if (error) throw error;
  return data as string;
}

/** Saves a card's display details. The number itself is never sent. */
export async function addCard(card: { number: string; expMonth: number; expYear: number; label?: string }): Promise<string> {
  const digits = card.number.replace(/\D/g, '');
  const { data, error } = await supabase.rpc('add_wallet_method', {
    p_kind: 'card', p_brand: cardBrand(digits), p_last4: digits.slice(-4),
    p_exp_month: card.expMonth, p_exp_year: card.expYear, p_label: card.label?.trim() || null,
  });
  if (error) throw error;
  return data as string;
}

export async function removeMethod(id: string) {
  const { error } = await supabase.rpc('remove_wallet_method', { p_method_id: id });
  if (error) throw error;
}

export async function setDefaultMethod(id: string) {
  const { error } = await supabase.rpc('set_default_method', { p_method_id: id });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Cards: checks done on the device, before anything is saved
// ---------------------------------------------------------------------------
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'card';

export function cardBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  return 'card';
}

/** The Luhn check every card number passes. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = parseInt(digits[digits.length - 1 - i], 10);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** "4242424242424242" → "4242 4242 4242 4242" (Amex: 4-6-5). */
export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 19);
  const groups = cardBrand(digits) === 'amex' ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const out: string[] = [];
  let at = 0;
  for (const g of groups) { if (at >= digits.length) break; out.push(digits.slice(at, at + g)); at += g; }
  return out.join(' ');
}

/** "0730" or "07/30" → { month: 7, year: 2030 }, or null. Past dates are null too. */
export function parseExpiry(raw: string): { month: number; year: number } | null {
  const m = raw.replace(/\s/g, '').match(/^(\d{1,2})\/?(\d{2})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const year = 2000 + parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return null;
  return { month, year };
}

export const formatExpiryInput = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export const brandName = (b: CardBrand | null) => ({ visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', card: 'Card' })[b ?? 'card'];
