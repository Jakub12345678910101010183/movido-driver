// One Supabase client for the whole app, including the background location
// task. Only the public anon key is used: every read is limited by RLS and
// every write goes through the driver_* RPCs.
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import { createApi } from "../core/api.ts";
import { secureStorage } from "./storage";

export const supabase = createClient(SUPABASE_URL || "https://invalid.local", SUPABASE_ANON_KEY || "missing", {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { headers: { "x-client-info": `movido-driver/${Platform.OS}` } },
});

export const api = createApi(supabase);

// Refresh tokens only while the app is in front; the background task
// refreshes on demand when it sends.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
