// GPS points waiting to reach the backend. The background location task and
// the foreground app both append here and flush in batches; the server skips
// points it already has (by time), so two flushes racing cannot duplicate.
import type { Api } from "./api.ts";
import { isRetryable } from "./errors.ts";
import type { KV } from "./outbox.ts";
import type { GpsPoint } from "./types.ts";

const KEY = "movido.gps.queue.v1";
const STATE = "movido.gps.state.v1";
const MAX_POINTS = 2000; // ~33 h at one point a minute; oldest dropped beyond that
const BATCH = 200;

export interface GpsState { lastSentAt: string | null; lastFixAt: string | null; queued: number; lastError: string | null }

export class GpsQueue {
  private kv: KV;
  constructor(kv: KV) { this.kv = kv; }

  private async read(): Promise<GpsPoint[]> {
    try { return JSON.parse((await this.kv.get(KEY)) ?? "[]"); } catch { return []; }
  }

  async state(): Promise<GpsState> {
    try {
      const s = JSON.parse((await this.kv.get(STATE)) ?? "null");
      return { lastSentAt: null, lastFixAt: null, queued: 0, lastError: null, ...(s ?? {}) };
    } catch { return { lastSentAt: null, lastFixAt: null, queued: 0, lastError: null }; }
  }

  private async patchState(p: Partial<GpsState>) {
    await this.kv.set(STATE, JSON.stringify({ ...(await this.state()), ...p }));
  }

  async add(points: GpsPoint[]): Promise<number> {
    const q = (await this.read()).concat(points).slice(-MAX_POINTS);
    await this.kv.set(KEY, JSON.stringify(q));
    const last = points[points.length - 1];
    await this.patchState({ queued: q.length, ...(last ? { lastFixAt: last.recorded_at } : {}) });
    return q.length;
  }

  /** Send queued points, oldest first. Returns the number still queued. */
  async flush(api: Api): Promise<{ remaining: number; ok: boolean }> {
    let q = await this.read();
    while (q.length) {
      const batch = q.slice(0, BATCH);
      const r = await api.reportLocations(batch);
      if (r.error) {
        if (!isRetryable(r.error)) {
          // Not a driver any more (logged out, disabled): the backlog can never be accepted.
          q = [];
          await this.kv.set(KEY, "[]");
          await this.patchState({ queued: 0, lastError: r.error.message ?? "rejected" });
          return { remaining: 0, ok: false };
        }
        await this.patchState({ queued: q.length, lastError: "offline" });
        return { remaining: q.length, ok: false };
      }
      // Re-read: the background task may have appended while we were sending.
      const current = await this.read();
      const sentUpTo = batch[batch.length - 1].recorded_at;
      q = current.filter((p) => p.recorded_at > sentUpTo);
      await this.kv.set(KEY, JSON.stringify(q));
      await this.patchState({ queued: q.length, lastSentAt: new Date().toISOString(), lastError: null });
    }
    return { remaining: 0, ok: true };
  }

  async clear() {
    await this.kv.set(KEY, "[]");
    await this.kv.set(STATE, JSON.stringify({ lastSentAt: null, lastFixAt: null, queued: 0, lastError: null }));
  }
}
