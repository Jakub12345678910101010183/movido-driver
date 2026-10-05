// Push notifications.
//
// The phone registers an Expo push token on the driver's own record
// (drivers.push_token, RLS: own row only). The backend sends: database
// triggers on jobs/messages call the Expo push service through pg_net
// (push_to_drivers). No secret is stored in the app. Android needs FCM:
// google-services.json at build time (app.config.js) and the FCM V1 key in
// EAS credentials. Decisions live in core/push.ts.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPush, registerPushOnStart, type PromptMemory, type PushStatus } from "../core/push.ts";
import { kv } from "../lib/storage";
import { api } from "../lib/supabase";
import { colors } from "../theme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export type { PushStatus };

export function easProjectId(): string | null {
  const id = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  return id ? id : null;
}

// Token last written for this driver in this app session, so a foreground
// re-check does not rewrite an unchanged token.
let savedToken: { driverId: number; token: string } | null = null;

// Outside the "movido." prefix on purpose: sign-out clears those keys, and the
// app prompts by itself at most once per install, not once per sign-in.
const PROMPTED_KEY = "install.push.prompted.v1";
const promptMemory: PromptMemory = {
  get: async () => (await kv.get(PROMPTED_KEY)) === "1",
  set: () => kv.set(PROMPTED_KEY, "1"),
};

/**
 * ask=false: check only (app back in foreground).
 * ask="once": sign-in / app start; prompts by itself once per install.
 * ask=true: show the Android/iOS prompt if it has not been answered for good.
 */
export async function registerForPush(driverId: number, ask: boolean | "once"): Promise<PushStatus> {
  const deps = {
    isDevice: Device.isDevice,
    projectId: easProjectId(),
    prepare: async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Jobs and messages", importance: Notifications.AndroidImportance.HIGH, lightColor: colors.primary, vibrationPattern: [0, 250, 250, 250],
        });
      }
    },
    getPermission: async () => { const p = await Notifications.getPermissionsAsync(); return { status: p.status, canAskAgain: p.canAskAgain }; },
    requestPermission: async () => { const p = await Notifications.requestPermissionsAsync(); return { status: p.status, canAskAgain: p.canAskAgain }; },
    getToken: async (projectId: string) => (await Notifications.getExpoPushTokenAsync({ projectId })).data,
    saveToken: async (token: string) => !(await api.setPushToken(driverId, token)).error,
  };
  const last = savedToken?.driverId === driverId ? savedToken.token : null;
  const r = ask === "once" ? await registerPushOnStart(deps, promptMemory, last) : await registerPush(deps, ask, last);
  if (r.token) savedToken = { driverId, token: r.token };
  return r.status;
}

/** On sign-out: this phone must stop receiving the previous driver's notifications. */
export async function unregisterPush(driverId: number): Promise<void> {
  savedToken = null;
  await api.setPushToken(driverId, null).catch(() => {});
  await Notifications.setBadgeCountAsync(0).catch(() => {});
}
