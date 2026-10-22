// Translations without a library: English is the source, Polish and Romanian
// must define every key (TypeScript checks it; test/i18n.test.ts checks the
// {placeholders} too). Plain TypeScript, so core modules and the Node unit
// tests can use t() as well as the React screens (see ./react.ts).
import { en, type Key } from "./en.ts";
import { pl } from "./pl.ts";
import { ro } from "./ro.ts";

export type { Key };
export type Lang = "en" | "pl" | "ro";

export const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "pl", label: "Polski" },
  { value: "ro", label: "Română" },
];

export const DICTS: Record<Lang, Record<Key, string>> = { en, pl, ro };
const DATE_LOCALE: Record<Lang, string> = { en: "en-GB", pl: "pl-PL", ro: "ro-RO" };

let current: Lang = "en";
const listeners = new Set<() => void>();

/** "pl-PL", "ro", "en_GB" → a supported language; anything else → English. */
export function langFromLocale(locale: string | null | undefined): Lang {
  const base = (locale ?? "").toLowerCase().split(/[-_]/)[0];
  return base === "pl" || base === "ro" ? base : "en";
}

/** The phone's language, as far as the JS engine reports it. */
export function deviceLang(): Lang {
  try { return langFromLocale(Intl.DateTimeFormat().resolvedOptions().locale); } catch { return "en"; }
}

export const getLang = (): Lang => current;
export const dateLocale = (): string => DATE_LOCALE[current];

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  listeners.forEach((f) => f());
}

export function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** Translated text; {name} placeholders are filled from vars. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  const s = DICTS[current][key] ?? en[key];
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}
