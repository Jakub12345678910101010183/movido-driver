// Device storage.
//  * secureStorage: the Supabase session (tokens), in the Keychain / Android
//    Keystore. Values are chunked because SecureStore items are size-limited,
//    and readable after first unlock so the background GPS task can sign its
//    requests while the phone is locked.
//  * kv: non-secret app state (outbox, GPS queue, caches) in AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { KV } from "../core/outbox.ts";

const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
const CHUNK = 1800;
const safe = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safe(key);
    const n = Number(await SecureStore.getItemAsync(`${k}.n`, OPTS));
    if (!n) return null;
    let out = "";
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`, OPTS);
      if (part === null) return null;
      out += part;
    }
    return out;
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safe(key);
    const old = Number(await SecureStore.getItemAsync(`${k}.n`, OPTS)) || 0;
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), OPTS);
    await SecureStore.setItemAsync(`${k}.n`, String(n), OPTS);
    for (let i = n; i < old; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, OPTS);
  },
  async removeItem(key: string): Promise<void> {
    const k = safe(key);
    const n = Number(await SecureStore.getItemAsync(`${k}.n`, OPTS)) || 0;
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, OPTS);
    await SecureStore.deleteItemAsync(`${k}.n`, OPTS);
  },
};

export const kv: KV = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
};

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try { const v = await AsyncStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export async function writeJSON(key: string, value: unknown): Promise<void> {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* cache only */ }
}
/** Remove this driver's cached data on sign-out (a shared phone must not show it to the next driver). */
export async function clearDriverData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith("movido.")));
}
