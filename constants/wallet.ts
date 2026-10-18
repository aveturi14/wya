import type { CardBrand } from '@/lib/wallet';

/**
 * Colours for the wallet (9.13): the balance card and each card brand's art.
 * Kept here, not in screens. The balance card is the same "ink" in both themes,
 * like a physical card; the glow uses the wya sticker pink and violet.
 */
export const WALLET_CARD = {
  ink: '#111114',
  onInk: '#FFFFFF',
  onInkSoft: 'rgba(255,255,255,0.68)',
  gradient: 'radial-gradient(90% 120% at 100% 0%, rgba(122,80,255,0.55) 0%, transparent 60%), radial-gradient(80% 100% at 0% 100%, rgba(255,46,122,0.35) 0%, transparent 60%), linear-gradient(135deg, #17171C, #0B0B0D)',
};

export const BRAND_ART: Record<CardBrand | 'apple_pay', { gradient: string; ink: string }> = {
  visa: { gradient: 'linear-gradient(135deg, #1A2B8C, #3B57D9)', ink: '#FFFFFF' },
  mastercard: { gradient: 'linear-gradient(135deg, #1E1E24, #3A2F2A)', ink: '#FFFFFF' },
  amex: { gradient: 'linear-gradient(135deg, #1D6E8C, #3FA3B8)', ink: '#FFFFFF' },
  card: { gradient: 'linear-gradient(135deg, #3A3A44, #5C5C68)', ink: '#FFFFFF' },
  apple_pay: { gradient: 'linear-gradient(135deg, #000000, #222226)', ink: '#FFFFFF' },
};

// Apple's own button is black with white text in both themes
export const APPLE_PAY_BUTTON = { bg: '#000000', fg: '#FFFFFF' };
