// Push notifications.
//
// The phone registers an Expo push token on the driver's own record
// (drivers.push_token, RLS: own row only). The backend sends: database
// triggers on jobs/messages call the Expo push service through pg_net
// (push_to_drivers). No secret is stored in the app.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "../lib/supabase";
import { colors } from "../theme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export type PushStatus = "registered" | "denied" | "unavailable" | "not_configured" | "error";

export function easProjectId(): string | null {
  const id = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  return id ? id : null;
}

export async function registerForPush(driverId: number, ask: boolean): Promise<PushStatus> {
  if (!Device.isDevice) return "unavailable";
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Jobs and messages", importance: Notifications.AndroidImportance.HIGH, lightColor: colors.primary, vibrationPattern: [0, 250, 250, 250],
    });
  }
  let perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted" && ask) perm = await Notifications.requestPermissionsAsync();
  if (perm.status !== "granted") return "denied";
  const projectId = easProjectId();
  if (!projectId) return "not_configured";
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const r = await api.setPushToken(driverId, token);
    return r.error ? "error" : "registered";
  } catch { return "error"; }
}

/** On sign-out: this phone must stop receiving the previous driver's notifications. */
export async function unregisterPush(driverId: number): Promise<void> {
  await api.setPushToken(driverId, null).catch(() => {});
  await Notifications.setBadgeCountAsync(0).catch(() => {});
}
