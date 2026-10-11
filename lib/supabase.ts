import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// SecureStore has a 2KB limit per key, so large values (Supabase sessions can
// exceed it) are split into chunks: <key>__count plus <key>__chunk_0…n
const CHUNK_SIZE = 1800;

async function clear(key: string) {
  await SecureStore.deleteItemAsync(key);
  const count = parseInt((await SecureStore.getItemAsync(`${key}__count`)) ?? '0', 10);
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}__chunk_${i}`);
  await SecureStore.deleteItemAsync(`${key}__count`);
}

const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (!countStr) return SecureStore.getItemAsync(key); // small values are stored whole
    const chunks: string[] = [];
    for (let i = 0; i < parseInt(countStr, 10); i++) {
      const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
      if (chunk == null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    // Start clean so a shorter session never leaves old chunks behind
    await clear(key);
    if (value.length <= CHUNK_SIZE) { await SecureStore.setItemAsync(key, value); return; }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}__chunk_${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}__count`, String(count)); // written last: a half-written session reads as none
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    await clear(key);
  },
};

// Reads give up after 15s and retry (3 tries in all), so a dropped connection on
// a bad network can't leave a screen loading forever. Writes are never retried:
// retrying a chat message, RSVP or payment could apply it twice.
const READ_TIMEOUT_MS = 15000;
const retryable = (e: any) =>
  e?.name === 'AbortError' || /network connection was lost|network request failed/i.test(String(e?.message));

const fetchWithRetry: typeof fetch = async (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return fetch(input, init);
  let lastError: unknown;
  for (let i = 0; i < 3; i++) {
    // Leave requests the caller can cancel itself alone
    const controller = init?.signal ? null : new AbortController();
    const timer = controller && setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
    try {
      return await fetch(input, controller ? { ...init, signal: controller.signal } : init);
    } catch (e: any) {
      lastError = e;
      if (!retryable(e)) throw e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    } finally {
      if (timer) clearTimeout(timer);
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
