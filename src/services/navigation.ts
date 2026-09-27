// Navigation: TomTom truck routing for distance/ETA inside the app (vehicle
// dimensions + live traffic), and hand-off to the phone's navigation app for
// turn-by-turn. Consumer navigation apps are not HGV-aware; the driver is
// reminded to follow road signs and restrictions.
import { Linking, Platform } from "react-native";
import { TOMTOM_KEY } from "../config";
import type { DriverProfile } from "../core/types.ts";

export interface RouteSummary { distanceKm: number; minutes: number; trafficDelayMin: number; arrival: string }

const cache = new Map<string, { at: number; value: RouteSummary }>();

export async function truckRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  vehicle: DriverProfile["vehicle"],
): Promise<RouteSummary | null> {
  if (!TOMTOM_KEY) return null;
  const key = `${from.lat.toFixed(3)},${from.lng.toFixed(3)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3 * 60_000) return hit.value;
  const p = new URLSearchParams({ key: TOMTOM_KEY, travelMode: "truck", traffic: "true", routeType: "fastest", computeTravelTimeFor: "all" });
  if (vehicle?.height) p.set("vehicleHeight", String(vehicle.height));
  if (vehicle?.width) p.set("vehicleWidth", String(vehicle.width));
  if (vehicle?.length) p.set("vehicleLength", String(vehicle.length));
  if (vehicle?.weight) p.set("vehicleWeight", String(Math.round(Number(vehicle.weight) * 1000))); // tonnes → kg
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(`https://api.tomtom.com/routing/1/calculateRoute/${from.lat},${from.lng}:${to.lat},${to.lng}/json?${p}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const s = (await res.json())?.routes?.[0]?.summary;
    if (!s) return null;
    const value: RouteSummary = {
      distanceKm: s.lengthInMeters / 1000,
      minutes: Math.round(s.travelTimeInSeconds / 60),
      trafficDelayMin: Math.round((s.trafficDelayInSeconds ?? 0) / 60),
      arrival: s.arrivalTime,
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch { return null; }
}

/** Open turn-by-turn in the phone's navigation app (Google Maps, else Apple Maps / browser). */
export async function openNavigation(dest: { lat: number | null; lng: number | null; address: string }): Promise<void> {
  const q = dest.lat != null && dest.lng != null ? `${dest.lat},${dest.lng}` : encodeURIComponent(dest.address);
  const candidates = Platform.OS === "android"
    ? [`google.navigation:q=${q}&mode=d`]
    : [`comgooglemaps://?daddr=${q}&directionsmode=driving`, `maps://?daddr=${q}&dirflg=d`];
  for (const url of candidates) {
    if (await Linking.canOpenURL(url).catch(() => false)) { await Linking.openURL(url); return; }
  }
  await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`);
}

export const formatDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${(km * 0.621371).toFixed(km < 16 ? 1 : 0)} mi`);
export const formatMinutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);
export const formatClock = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—");
