// Stops as the backend stores them (jobs.stops jsonb), read defensively: old
// jobs may have no stops, a single delivery address, or partial objects.
import type { Job, Stop, StopStatus } from "./types.ts";

export interface RouteLeg {
  kind: "collection" | "stop" | "delivery";
  index: number | null; // index in jobs.stops, null for pickup/delivery fields
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  status: StopStatus;
  arrived_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  contact?: string | null;
  window?: string | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

export function parseStops(raw: unknown): Stop[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s): Stop => {
    const o = (s ?? {}) as Record<string, unknown>;
    const status = o.status === "arrived" || o.status === "completed" ? o.status : "pending";
    return {
      address: str(o.address) ?? str(o.name) ?? "Stop",
      lat: num(o.lat),
      lng: num(o.lng),
      status,
      arrived_at: str(o.arrived_at),
      completed_at: str(o.completed_at),
      notes: str(o.notes) ?? str(o.instructions),
      contact: str(o.contact) ?? str(o.phone),
      window: str(o.window) ?? str(o.time_window),
    };
  });
}

/**
 * The legs a driver works through, in order. Multi-stop jobs use jobs.stops
 * (these are the ones with arrive/complete state on the server). A job
 * without stops has a collection and a delivery taken from the job itself.
 */
export function legsOf(job: Job): RouteLeg[] {
  const stops = parseStops(job.stops);
  const legs: RouteLeg[] = [];
  if (job.pickup_address) {
    legs.push({ kind: "collection", index: null, label: "Collection", address: job.pickup_address,
      lat: job.pickup_lat, lng: job.pickup_lng, status: stops.length ? "completed" : job.status === "pending" || job.status === "assigned" ? "pending" : "completed" });
  }
  stops.forEach((s, i) => legs.push({ kind: "stop", index: i, label: `Stop ${i + 1}`, ...s }));
  if (!stops.length && job.delivery_address) {
    legs.push({ kind: "delivery", index: null, label: "Delivery", address: job.delivery_address,
      lat: job.delivery_lat, lng: job.delivery_lng, status: job.status === "completed" ? "completed" : "pending" });
  }
  // With stops, the collection leg is informational only; mark it done once
  // the job is under way so "next stop" logic points at the first real stop.
  if (stops.length && legs[0]?.kind === "collection") {
    legs[0].status = job.status === "pending" || job.status === "assigned" ? "pending" : "completed";
  }
  return legs;
}

/** The stop the driver should act on next (first not completed), if any. */
export function nextStopIndex(job: Job): number | null {
  const stops = parseStops(job.stops);
  const i = stops.findIndex((s) => s.status !== "completed");
  return i === -1 ? null : i;
}

export function stopCounts(job: Job): { total: number; done: number } {
  const stops = parseStops(job.stops);
  return { total: stops.length, done: stops.filter((s) => s.status === "completed").length };
}

/** Where to navigate to now: the next stop, else the delivery address. */
export function nextDestination(job: Job): { label: string; address: string; lat: number | null; lng: number | null } | null {
  const i = nextStopIndex(job);
  const stops = parseStops(job.stops);
  if (i !== null) return { label: `Stop ${i + 1}`, address: stops[i].address, lat: stops[i].lat, lng: stops[i].lng };
  if (job.status === "pending" || job.status === "assigned") {
    if (job.pickup_address) return { label: "Collection", address: job.pickup_address, lat: job.pickup_lat, lng: job.pickup_lng };
  }
  if (job.delivery_address) return { label: "Delivery", address: job.delivery_address, lat: job.delivery_lat, lng: job.delivery_lng };
  return null;
}

/** All stops done (or no stops): the job can be closed with proof of delivery. */
export function readyForPod(job: Job): boolean {
  return nextStopIndex(job) === null && job.status === "in_progress";
}
