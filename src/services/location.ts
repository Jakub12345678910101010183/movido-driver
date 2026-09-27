// Background GPS.
//
// Phone GPS → local queue → driver_report_locations (MOViDO backend) →
// positions, geofence arrivals, office live map. TomTom is not called here.
//
// Updates are distance/time throttled (server-configurable, default 100 m /
// 60 s), batched, and deferred on iOS, so the radio is not woken every second.
// Tracking runs only while the driver has a job in progress.
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import type { GpsPoint } from "../core/types.ts";
import { api } from "../lib/supabase";
import { colors } from "../theme";
import { gpsQueue } from "./sync";

export const LOCATION_TASK = "movido-driver-location";

// Must be defined at module scope so it exists when the OS relaunches the app
// in the background to deliver locations.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const points: GpsPoint[] = data.locations
    .filter((l) => l.coords.accuracy == null || l.coords.accuracy <= 1000)
    .map((l) => ({
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      accuracy_m: l.coords.accuracy ?? null,
      speed_mps: l.coords.speed != null && l.coords.speed >= 0 ? l.coords.speed : null,
      heading: l.coords.heading != null && l.coords.heading >= 0 ? l.coords.heading : null,
      recorded_at: new Date(l.timestamp).toISOString(),
    }));
  if (!points.length) return;
  await gpsQueue.add(points);
  await gpsQueue.flush(api); // queued points stay if there is no signal
});

export type LocationPermission = "granted_always" | "granted_foreground" | "denied" | "undetermined" | "services_off";

export async function permissionState(): Promise<LocationPermission> {
  if (!(await Location.hasServicesEnabledAsync())) return "services_off";
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status === "undetermined") return "undetermined";
  if (fg.status !== "granted") return "denied";
  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.status === "granted" ? "granted_always" : "granted_foreground";
}

/** Ask in the right order: while-in-use first, then "always" (a separate OS prompt). */
export async function requestPermissions(): Promise<LocationPermission> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return "denied";
  const bg = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: "denied" as const }));
  return bg.status === "granted" ? "granted_always" : "granted_foreground";
}

export async function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
}

export async function startTracking(settings: { intervalSeconds: number; distanceMetres: number }): Promise<LocationPermission> {
  const perm = await permissionState();
  if (perm !== "granted_always" && perm !== "granted_foreground") return perm;
  if (await isTracking()) return perm;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: Math.max(15, settings.intervalSeconds) * 1000,
    distanceInterval: Math.max(25, settings.distanceMetres),
    deferredUpdatesInterval: Math.max(15, settings.intervalSeconds) * 1000,
    deferredUpdatesDistance: Math.max(25, settings.distanceMetres),
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "MOViDO Driver",
      notificationBody: "Sharing your location with the office while your job is in progress.",
      notificationColor: colors.primary,
      killServiceOnDestroy: false,
    },
  });
  return perm;
}

export async function stopTracking(): Promise<void> {
  if (await isTracking()) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
}

/** A recent position for stamping POD / incidents / fuel. Never blocks for long. */
export async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 200 });
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Platform.OS === "android" ? Location.Accuracy.High : Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
    return fix ? { lat: fix.coords.latitude, lng: fix.coords.longitude } : null;
  } catch { return null; }
}
