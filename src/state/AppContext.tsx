// App-wide state: session, driver profile, jobs, messages, network, outbox
// and GPS status. Server data is cached per driver so the app opens with the
// last known work when there is no signal; the driver's own unsynced actions
// are layered on top and marked as pending.
import NetInfo from "@react-native-community/netinfo";
import type { Session } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { GPS_DEFAULTS } from "../config";
import { describeError } from "../core/errors.ts";
import type { OutboxAction, OutboxItem } from "../core/outbox.ts";
import { applyPending, type PendingMarks } from "../core/overlay.ts";
import { shouldRecheckOnAppState, shouldRegisterOnStart } from "../core/push.ts";
import type { DriverProfile, Job, Message } from "../core/types.ts";
import { api, supabase } from "../lib/supabase";
import { clearDriverData, readJSON, writeJSON } from "../lib/storage";
import { isTracking, permissionState, requestPermissions, startTracking, stopTracking, type LocationPermission } from "../services/location";
import { registerForPush, unregisterPush, type PushStatus } from "../services/notifications";
import { gpsQueue, newId, outbox, syncNow } from "../services/sync";
import type { GpsState } from "../core/gpsQueue.ts";

export type AuthState = "loading" | "signed_out" | "not_driver" | "disabled" | "ready";
export type SyncState = "online" | "offline" | "syncing" | "error";

interface Ctx {
  auth: AuthState;
  authMessage: string | null;
  session: Session | null;
  profile: DriverProfile | null;
  jobs: Job[];
  pending: Map<number, PendingMarks>;
  jobsLoading: boolean;
  jobsError: string | null;
  jobsUpdatedAt: string | null;
  messages: Message[];
  unread: number;
  online: boolean;
  sync: SyncState;
  outboxItems: OutboxItem[];
  gps: GpsState & { tracking: boolean; permission: LocationPermission | null };
  push: PushStatus | null;
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  refreshMessages(): Promise<void>;
  act(action: OutboxAction, id?: string): Promise<OutboxItem>;
  syncNow(): Promise<void>;
  refreshGps(): Promise<void>;
  enablePush(): Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
};

const cacheKey = (driverId: number, what: string) => `movido.cache.${driverId}.${what}`;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [serverJobs, setServerJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsUpdatedAt, setJobsUpdatedAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [gps, setGps] = useState<Ctx["gps"]>({ lastSentAt: null, lastFixAt: null, queued: 0, lastError: null, tracking: false, permission: null });
  const [push, setPush] = useState<PushStatus | null>(null);
  const profileRef = useRef<DriverProfile | null>(null);
  profileRef.current = profile;

  // ---------- session → driver ----------
  const loadDriver = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) { setProfile(null); setAuth("signed_out"); return; }
    const role = await api.role(s.user.id);
    if (role.error) {
      // No signal at start-up: keep the last known profile so the driver can work offline.
      const cached = await readJSON<DriverProfile | null>("movido.cache.profile", null);
      if (cached) { setProfile(cached); setAuth("ready"); return; }
      setAuthMessage(describeError(role.error)); setAuth("signed_out"); return;
    }
    if (role.data === "disabled") { setAuth("disabled"); return; }
    if (role.data !== "driver") { setAuth("not_driver"); return; }
    const p = await api.profile();
    if (p.error || !p.data) {
      const cached = await readJSON<DriverProfile | null>("movido.cache.profile", null);
      if (cached) { setProfile(cached); setAuth("ready"); return; }
      setAuth("not_driver"); return;
    }
    setProfile(p.data);
    await writeJSON("movido.cache.profile", p.data);
    setAuth("ready");
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => loadDriver(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") { void loadDriver(null); }
      else if (event === "TOKEN_REFRESHED") setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadDriver]);

  // ---------- jobs ----------
  const refresh = useCallback(async () => {
    const p = profileRef.current;
    if (!p) return;
    setJobsLoading(true);
    const r = await api.jobs();
    setJobsLoading(false);
    if (r.error) {
      setJobsError(describeError(r.error));
      return;
    }
    setJobsError(null);
    setServerJobs(r.data);
    const at = new Date().toISOString();
    setJobsUpdatedAt(at);
    await writeJSON(cacheKey(p.driver.id, "jobs"), { at, jobs: r.data });
  }, []);

  const refreshMessages = useCallback(async () => {
    const p = profileRef.current;
    if (!p) return;
    const r = await api.messages();
    if (!r.error) { setMessages(r.data); await writeJSON(cacheKey(p.driver.id, "messages"), r.data); }
  }, []);

  useEffect(() => {
    if (auth !== "ready" || !profile) return;
    let alive = true;
    (async () => {
      const cached = await readJSON<{ at: string; jobs: Job[] } | null>(cacheKey(profile.driver.id, "jobs"), null);
      if (alive && cached) { setServerJobs(cached.jobs); setJobsUpdatedAt(cached.at); }
      const cm = await readJSON<Message[]>(cacheKey(profile.driver.id, "messages"), []);
      if (alive && cm.length) setMessages(cm);
      await Promise.all([refresh(), refreshMessages()]);
    })();
    // Live updates instead of polling: the office assigns/changes a job or sends a message.
    const ch = supabase.channel(`driver-${profile.driver.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `driver_id=eq.${profile.driver.id}` }, () => { void refresh(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `organization_id=eq.${profile.organization.id}` }, () => { void refreshMessages(); })
      .subscribe();
    const appSub = AppState.addEventListener("change", (s) => { if (s === "active") { void refresh(); void refreshMessages(); void syncNow(); } });
    return () => { alive = false; void supabase.removeChannel(ch); appSub.remove(); };
  }, [auth, profile, refresh, refreshMessages]);

  // ---------- network + outbox ----------
  useEffect(() => {
    void outbox.load().then(() => outbox.subscribe(setOutboxItems));
    const unsub = NetInfo.addEventListener((s) => {
      const up = !!s.isConnected && s.isInternetReachable !== false;
      setOnline(up);
      if (up) void doSync();
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try { await syncNow(); } finally { setSyncing(false); }
    await refreshGps();
    // Server state now includes what was just sent.
    if (profileRef.current) { void refresh(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const act = useCallback(async (action: OutboxAction, id?: string) => {
    const item = await outbox.enqueue(action, id ?? newId());
    void doSync();
    return item;
  }, [doSync]);

  // ---------- GPS: track only while a job is in progress ----------
  const refreshGps = useCallback(async () => {
    const [s, tracking, permission] = await Promise.all([gpsQueue.state(), isTracking(), permissionState().catch(() => null)]);
    setGps({ ...s, tracking, permission });
  }, []);

  const { jobs, pending } = useMemo(() => applyPending(serverJobs, outboxItems), [serverJobs, outboxItems]);
  const hasActiveJob = jobs.some((j) => j.status === "in_progress");

  useEffect(() => {
    if (auth !== "ready" || !profile) return;
    const settings = {
      intervalSeconds: profile.settings?.gps_interval_seconds ?? GPS_DEFAULTS.intervalSeconds,
      distanceMetres: profile.settings?.gps_distance_metres ?? GPS_DEFAULTS.distanceMetres,
    };
    const run = async () => {
      if (!hasActiveJob) return stopTracking();
      // Ask when it makes sense to the driver: the moment a job is under way.
      const perm = await permissionState().catch(() => null);
      if (perm === "undetermined") await requestPermissions().catch(() => null);
      return startTracking(settings);
    };
    void run().finally(() => { void refreshGps(); });
    const t = setInterval(() => { void refreshGps(); }, 30_000);
    return () => clearInterval(t);
  }, [auth, profile, hasActiveJob, refreshGps]);

  // ---------- push ----------
  useEffect(() => {
    if (!shouldRegisterOnStart(auth, !!profile) || !profile) return;
    // A fresh install has never been asked: prompt once by itself (P-3).
    void registerForPush(profile.driver.id, "once").then(setPush);
    // Back from Settings (or anywhere): pick up a permission change without a restart.
    let prev = AppState.currentState as string;
    const sub = AppState.addEventListener("change", (next) => {
      if (shouldRecheckOnAppState(prev, next)) void registerForPush(profile.driver.id, false).then(setPush);
      prev = next;
    });
    return () => sub.remove();
  }, [auth, profile]);
  const enablePush = useCallback(async () => {
    if (profileRef.current) setPush(await registerForPush(profileRef.current.driver.id, true));
  }, []);

  // ---------- auth actions ----------
  const signIn = useCallback(async (email: string, password: string) => {
    setAuthMessage(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (/invalid login credentials/i.test(error.message)) return "Email or password is not correct.";
      if (/email not confirmed/i.test(error.message)) return "Activate your account from the invitation email first.";
      if (/network|fetch/i.test(error.message)) return "No connection. Sign in needs internet the first time.";
      return "Could not sign in. Please try again.";
    }
    await loadDriver(data.session);
    return null;
  }, [loadDriver]);

  const signOut = useCallback(async () => {
    const p = profileRef.current;
    await stopTracking();
    if (p) await unregisterPush(p.driver.id);
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    await gpsQueue.clear();
    await clearDriverData();
    setServerJobs([]); setMessages([]); setProfile(null); setJobsUpdatedAt(null);
    setAuth("signed_out");
  }, []);

  const unread = useMemo(() => {
    const uid = session?.user.id;
    return messages.filter((m) => !m.read && m.recipient_id === uid).length;
  }, [messages, session]);

  const pendingCount = outboxItems.filter((i) => i.state === "pending").length;
  const failedCount = outboxItems.filter((i) => i.state === "failed").length;
  const sync: SyncState = failedCount ? "error" : !online ? "offline" : syncing || pendingCount ? "syncing" : "online";

  const value: Ctx = {
    auth, authMessage, session, profile, jobs, pending, jobsLoading, jobsError, jobsUpdatedAt,
    messages, unread, online, sync, outboxItems, gps, push,
    signIn, signOut, refresh, refreshMessages, act, syncNow: doSync, refreshGps, enablePush,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
