import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * A link people can open anywhere: the hosted web app when EXPO_PUBLIC_WEB_URL
 * is set (invites are opened in a browser), else the app's own scheme.
 */
export function webUrl(path: string) {
  const clean = path.replace(/^\//, '');
  return process.env.EXPO_PUBLIC_WEB_URL ? `${process.env.EXPO_PUBLIC_WEB_URL}/${clean}` : Linking.createURL(clean);
}

/** WhatsApp with the message filled in; the person picks the chat (wya can't see their groups). */
export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** The phone's messages app with the text filled in; the person picks who and taps send. */
export const smsUrl = (text: string) => `sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(text)}`;
