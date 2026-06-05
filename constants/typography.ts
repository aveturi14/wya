/**
 * Global typography system — two fonts, clear roles:
 *
 * Cormorant Garamond  → titles, event names, hero text, pull-quotes
 *                       (large, editorial, never used for numbers or small UI)
 *
 * Raleway             → everything else: body copy, descriptions, buttons,
 *                       labels, numbers, meta, inputs, chat
 *                       (clean, geometric, legible at any size)
 */

import { TextStyle } from 'react-native';
import { Colors } from './colors';
import { Fonts } from './fonts';

export const Type = {

  // ── Cormorant — display only ──────────────────────────────────
  hero: {
    fontFamily: Fonts.displayBold,
    fontSize: 48,
    color: Colors.text,
    letterSpacing: -1,
    lineHeight: 54,
  } as TextStyle,

  screenTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 36,
    color: Colors.text,
    letterSpacing: -0.5,
  } as TextStyle,

  eventTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 30,
    color: Colors.text,
    letterSpacing: -0.5,
    lineHeight: 37,
  } as TextStyle,

  cardTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 21,
    color: Colors.text,
    letterSpacing: -0.2,
    lineHeight: 26,
  } as TextStyle,

  pullQuote: {
    fontFamily: Fonts.displayItalic,
    fontSize: 17,
    color: Colors.text,
    lineHeight: 26,
  } as TextStyle,

  // ── Raleway — all functional text ────────────────────────────
  subtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  } as TextStyle,

  description: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
  } as TextStyle,

  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  } as TextStyle,

  value: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  } as TextStyle,

  buttonPrimary: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: Colors.white,
    letterSpacing: 0.6,
  } as TextStyle,

  buttonSecondary: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.textSecondary,
  } as TextStyle,

  badge: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  } as TextStyle,

  meta: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  } as TextStyle,

  metaSmall: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.textMuted,
  } as TextStyle,

  // Numbers — always Raleway so digits are crisp
  statNumber: {
    fontFamily: Fonts.bodyBold,
    fontSize: 32,
    lineHeight: 38,
  } as TextStyle,

  link: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  } as TextStyle,

  linkAccent: {
    fontFamily: Fonts.bodySemiBold,
    color: Colors.accentMid,
  } as TextStyle,

  chatMessage: {
    fontFamily: Fonts.body,
    fontSize: 15,
    lineHeight: 22,
  } as TextStyle,

  input: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.text,
  } as TextStyle,
};
