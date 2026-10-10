import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// SecureStore has a 2KB limit per key, so we chunk large values (Supabase sessions can exceed this)
const CHUNK_SIZE = 1800;

const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (!countStr) return SecureStore.getItemAsync(key); // fallback for small values
    const count = parseInt(countStr, 10);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
      if (chunk == null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(`${key}__count`);
      return;
    }
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(`${key}__chunk_${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}__count`, String(chunks));
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    await SecureStore.deleteItemAsync(key);
    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (countStr) {
      const count = parseInt(countStr, 10);
      for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}__chunk_${i}`);
      await SecureStore.deleteItemAsync(`${key}__count`);
    }
  },
};

// Only retry reads: retrying a write (chat message, RSVP, payment) could apply it twice
const fetchWithRetry: typeof fetch = async (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return fetch(input, init);
  let lastError: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await fetch(input, init);
    } catch (e: any) {
      lastError = e;
      if (e?.message?.includes('Network connection was lost') || e?.message?.includes('network connection was lost')) {
        await new Promise((r) => setTimeout(r, 300 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchWithRetry },
});

// Refresh tokens only while the app is in the foreground
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
