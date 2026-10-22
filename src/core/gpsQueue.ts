// GPS points waiting to reach the backend. The background location task and
// the foreground app both append here and flush in batches; the server skips
// points it already has (by time), so a re-sent point is not duplicated.
//
// One upload at a time (GPS-1): the background task, app resume, network
// reconnect, "Sync now" and the retry timer all call flush(). Overlapping
// driver_report_locations calls for the same driver can deadlock on the
// server, so a flush requested while one is running joins it and causes at
// most one follow-up pass. Queue writes are serialised too (GPS-3), so points
// appended during an upload are never overwritten.
import type { Api } from "./api.ts";
import { isRetryable } from "./errors.ts";
import type { KV } from "./outbox.ts";
import type { GpsPoint } from "./types.ts";

const KEY = "movido.gps.queue.v1";
const STATE = "movido.gps.state.v1";
const MAX_POINTS = 2000; // ~33 h at one point a minute; oldest dropped beyond that
const BATCH = 200;

export interface GpsState { lastSentAt: string | null; lastFixAt: string | null; queued: number; lastError: string | null }

export type FlushResult = { remaining: number; ok: boolean };

const keyOf = (p: GpsPoint) => `${p.recorded_at}|${p.lat}|${p.lng}`;

export class GpsQueue {
  private kv: KV;
  private writes: Promise<unknown> = Promise.resolve();
  private inflight: Promise<FlushResult> | null = null;
  private again = false;
  constructor(kv: KV) { this.kv = kv; }

  /** Run a read-modify-write of the stored queue after any other one finishes. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writes.then(fn, fn);
    this.writes = run.catch(() => undefined);
    return run;
  }

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
    return this.serial(async () => {
      // Oldest first; a stable sort keeps arrival order for equal times.
      const q = (await this.read()).concat(points)
        .map((p, i) => [p, i] as const)
        .sort((x, y) => (x[0].recorded_at < y[0].recorded_at ? -1 : x[0].recorded_at > y[0].recorded_at ? 1 : x[1] - y[1]))
        .map(([p]) => p)
        .slice(-MAX_POINTS);
      await this.kv.set(KEY, JSON.stringify(q));
      const last = points[points.length - 1];
      await this.patchState({ queued: q.length, ...(last ? { lastFixAt: last.recorded_at } : {}) });
      return q.length;
    });
  }

  /**
   * Send queued points, oldest first, one batch at a time. Returns the number
   * still queued. While a flush is running, further calls share its result and
   * at most one follow-up pass runs after it (only if it succeeded).
   */
  flush(api: Api): Promise<FlushResult> {
    if (this.inflight) { this.again = true; return this.inflight; }
    const run = (async () => {
      try {
        let r: FlushResult;
        do { this.again = false; r = await this.flushOnce(api); } while (this.again && r.ok);
        return r;
      } finally {
        this.inflight = null;
      }
    })();
    this.inflight = run;
    return run;
  }

  private async flushOnce(api: Api): Promise<FlushResult> {
    for (;;) {
      const q = await this.read();
      if (!q.length) return { remaining: 0, ok: true };
      const batch = q.slice(0, BATCH);
      const r = await api.reportLocations(batch);
      if (r.error) {
        if (!isRetryable(r.error)) {
          // Not a driver any more (logged out, disabled): the backlog can never be accepted.
          await this.serial(async () => {
            await this.kv.set(KEY, "[]");
            await this.patchState({ queued: 0, lastError: r.error?.message ?? "rejected" });
          });
          return { remaining: 0, ok: false };
        }
        const remaining = (await this.read()).length;
        await this.serial(() => this.patchState({ queued: remaining, lastError: "offline" }));
        return { remaining, ok: false };
      }
      // Remove exactly the points that were accepted; anything appended (or
      // cleared) meanwhile is kept as it is now.
      await this.serial(async () => {
        const sent = new Map<string, number>();
        for (const p of batch) sent.set(keyOf(p), (sent.get(keyOf(p)) ?? 0) + 1);
        const left = (await this.read()).filter((p) => {
          const n = sent.get(keyOf(p)) ?? 0;
          if (n > 0) { sent.set(keyOf(p), n - 1); return false; }
          return true;
        });
        await this.kv.set(KEY, JSON.stringify(left));
        await this.patchState({ queued: left.length, lastSentAt: new Date().toISOString(), lastError: null });
      });
    }
  }

  async clear() {
    await this.serial(async () => {
      await this.kv.set(KEY, "[]");
      await this.kv.set(STATE, JSON.stringify({ lastSentAt: null, lastFixAt: null, queued: 0, lastError: null }));
    });
  }
}
