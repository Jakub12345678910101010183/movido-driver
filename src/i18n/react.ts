// React side of the translations: screens call useT() so they re-render when
// the language changes, and the choice is kept on the phone.
import { useSyncExternalStore } from "react";
import { kv } from "../lib/storage";
import { deviceLang, getLang, setLang, subscribe, t, type Lang } from "./index.ts";

const KEY = "movido.lang";

/** Re-renders the caller when the language changes; returns t. */
export function useT(): typeof t {
  useSyncExternalStore(subscribe, getLang, getLang);
  return t;
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

/** Saved choice first, else the phone's language. */
export async function loadLang(): Promise<void> {
  let saved: string | null = null;
  try { saved = await kv.get(KEY); } catch { /* storage unavailable: use the phone's language */ }
  setLang(saved === "en" || saved === "pl" || saved === "ro" ? saved : deviceLang());
}

export async function chooseLang(lang: Lang): Promise<void> {
  setLang(lang);
  try { await kv.set(KEY, lang); } catch { /* applies for this session even if it cannot be saved */ }
}
