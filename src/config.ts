// Public, client-safe configuration only. Everything here ends up in the app
// bundle: never add service-role keys or server secrets.

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
/** Native TomTom key ("API key Movido"), separate from the domain-locked web key. */
export const TOMTOM_KEY = process.env.EXPO_PUBLIC_TOMTOM_API_KEY ?? "";

export const WEB_URL = "https://www.movidologistics.uk";
export const SUPPORT_EMAIL = "movidologistics@gmail.com";

/**
 * GPS defaults. The live values come from the server per company
 * (driver_profile().settings ← app_settings driver_gps_interval_seconds /
 * driver_gps_distance_metres); these are used until the profile is loaded.
 */
export const GPS_DEFAULTS = { intervalSeconds: 60, distanceMetres: 100 } as const;

export const configProblems = (): string[] =>
  [!SUPABASE_URL && "EXPO_PUBLIC_SUPABASE_URL", !SUPABASE_ANON_KEY && "EXPO_PUBLIC_SUPABASE_ANON_KEY"].filter(Boolean) as string[];
