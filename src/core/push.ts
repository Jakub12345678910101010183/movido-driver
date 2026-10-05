// Push registration decisions, kept free of Expo/React Native so they can be
// unit-tested offline. The native side (services/notifications.ts) supplies the
// platform calls.
//
// Android 13+ starts every install at "undetermined": that is NOT a denial. The
// prompt can be shown until the user has refused it twice (canAskAgain false);
// only then is Settings the way to turn notifications on.

export type PushStatus =
  | "registered"      // permission granted and token saved on the driver's own row
  | "not_asked"       // permission can still be requested in the app
  | "denied"          // refused and the OS will not ask again: Settings only
  | "unavailable"     // simulator / emulator
  | "not_configured"  // build has no EAS project id
  | "error";          // token could not be obtained or saved (e.g. FCM not set up)

export type PermissionInfo = { status: "granted" | "denied" | "undetermined"; canAskAgain: boolean };

export type PushDeps = {
  isDevice: boolean;
  projectId: string | null;
  prepare(): Promise<void>;                        // e.g. Android notification channel
  getPermission(): Promise<PermissionInfo>;
  requestPermission(): Promise<PermissionInfo>;    // shows the OS prompt
  getToken(projectId: string): Promise<string>;    // Expo push token
  saveToken(token: string): Promise<boolean>;      // true when stored
};

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/; // same rule as the drivers table

/** What a permission answer means for the app. */
export function classifyPermission(p: PermissionInfo): "granted" | "not_asked" | "denied" {
  if (p.status === "granted") return "granted";
  return p.canAskAgain ? "not_asked" : "denied";
}

/** The "Turn on notifications" button: prompt when the OS allows it, otherwise open Settings. */
export function turnOnAction(status: PushStatus | null): "prompt" | "settings" | "none" {
  if (status === "denied") return "settings";
  if (status === "not_asked" || status === "error") return "prompt";
  return "none";
}

/** Re-check push when the app comes back to the foreground (e.g. after visiting Settings). */
export function shouldRecheckOnAppState(prev: string, next: string): boolean {
  return next === "active" && prev !== "active";
}

/**
 * Check (and with ask=true, request) permission, then register the token.
 * `lastSaved` avoids rewriting the same token on every foreground.
 * Never throws.
 */
export async function registerPush(deps: PushDeps, ask: boolean, lastSaved: string | null = null): Promise<{ status: PushStatus; token: string | null }> {
  try {
    if (!deps.isDevice) return { status: "unavailable", token: null };
    await deps.prepare().catch(() => {});
    let perm = classifyPermission(await deps.getPermission());
    if (perm === "not_asked" && ask) perm = classifyPermission(await deps.requestPermission());
    if (perm !== "granted") return { status: perm, token: null };
    if (!deps.projectId) return { status: "not_configured", token: null };
    const token = await deps.getToken(deps.projectId);
    if (!EXPO_TOKEN.test(token)) return { status: "error", token: null };
    if (token !== lastSaved && !(await deps.saveToken(token))) return { status: "error", token: null };
    return { status: "registered", token };
  } catch {
    return { status: "error", token: null };
  }
}

/** Remembers, for this install, that the app has already shown the prompt by itself. */
export type PromptMemory = { get(): Promise<boolean>; set(): Promise<void> };

/** Registration runs at start only for a signed-in driver (the app has no other users). */
export function shouldRegisterOnStart(auth: string, hasDriverProfile: boolean): boolean {
  return auth === "ready" && hasDriverProfile;
}

/**
 * Sign-in / app start (P-3). A fresh install is "undetermined" on Android 13+
 * and iOS; checking only would never register a token, so job and office
 * pushes would silently never arrive. Show the OS prompt by itself once per
 * install (after the Android channel exists, see registerPush), never again:
 * later the driver uses "Turn on notifications" or Settings. The prompt is
 * remembered before it is shown; if that cannot be stored, it is not shown.
 * Never throws.
 */
export async function registerPushOnStart(deps: PushDeps, memory: PromptMemory, lastSaved: string | null = null): Promise<{ status: PushStatus; token: string | null }> {
  let ask = false;
  try { ask = !(await memory.get()); } catch { ask = false; }
  if (!ask) return registerPush(deps, false, lastSaved);
  return registerPush({
    ...deps,
    requestPermission: async () => {
      try { await memory.set(); } catch { return deps.getPermission(); }
      return deps.requestPermission();
    },
  }, true, lastSaved);
}
