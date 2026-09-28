// Location for stamping incidents / POD / fuel / checks. Every step has its own
// time limit, so the whole lookup is bounded and a submit can never hang on GPS.
// A missing position is not an error: the caller saves the record without one.

export type LatLng = { lat: number; lng: number };

export type PositionSource = {
  /** Foreground permission and whether location services are switched on. */
  ready(): Promise<"ok" | "services_off" | "no_permission">;
  /** Recent cached fix, or null. */
  lastKnown(): Promise<LatLng | null>;
  /** A fresh fix from the GPS. */
  fresh(): Promise<LatLng | null>;
};

export type PositionLimits = { readyMs: number; lastKnownMs: number; freshMs: number };

export const POSITION_LIMITS: Readonly<PositionLimits> = {
  readyMs: 1500, // permission + services check; normally instant
  lastKnownMs: 1500, // cached fix; normally instant
  freshMs: 8000, // unchanged: fresh GPS fix
};

/** Resolves to the promise's value, or `fallback` if it rejects or takes longer than `ms`. */
export function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, () => { clearTimeout(timer); resolve(fallback); });
  });
}

/**
 * No permission → null at once. Services off → a recent cached fix if there is
 * one, but no wait for a fresh fix. Worst case readyMs + lastKnownMs + freshMs
 * (11 s). Never rejects.
 */
export async function acquirePosition(src: PositionSource, limits: Readonly<PositionLimits> = POSITION_LIMITS): Promise<LatLng | null> {
  const guard = <T>(f: () => Promise<T>) => { try { return f(); } catch (e) { return Promise.reject(e); } };
  const state = await within<"ok" | "services_off" | "no_permission">(guard(() => src.ready()), limits.readyMs, "no_permission");
  if (state === "no_permission") return null;
  const last = await within(guard(() => src.lastKnown()), limits.lastKnownMs, null);
  if (last || state === "services_off") return last;
  return within(guard(() => src.fresh()), limits.freshMs, null);
}
