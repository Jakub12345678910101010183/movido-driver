// Unit tests for the GPS queue's single-flight upload (GPS-1) and serialised
// queue writes (GPS-3). Offline, no backend, mocked API:
//   npm run test:unit
// MOVIDO_GPSQUEUE_MODULE can point at another build of gpsQueue.ts (used to
// show the pre-fix behaviour).
import assert from "node:assert/strict";
import type { Api } from "../src/core/api.ts";
import type { KV } from "../src/core/outbox.ts";
import type { GpsPoint } from "../src/core/types.ts";

const mod = process.env.MOVIDO_GPSQUEUE_MODULE ?? "../src/core/gpsQueue.ts";
const { GpsQueue } = (await import(mod)) as typeof import("../src/core/gpsQueue.ts");

type Err = { code?: string; message?: string; status?: number } | null;
const KEY = "movido.gps.queue.v1";
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A deferred API call: each reportLocations waits until the test releases it. */
function setup() {
  const store = new Map<string, string>();
  const kv: KV = { get: async (k) => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); } };
  const calls: { points: GpsPoint[]; release: (e?: Err) => void }[] = [];
  let inFlight = 0, maxInFlight = 0;
  const api = {
    reportLocations: (points: GpsPoint[]) => new Promise((resolve) => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      calls.push({ points, release: (e = null) => { inFlight--; resolve({ data: e ? null : { stored: points.length, latest_at: null }, error: e }); } });
    }),
  } as unknown as Api;
  const q = new GpsQueue(kv);
  const queued = (): GpsPoint[] => JSON.parse(store.get(KEY) ?? "[]");
  return { q, api, calls, queued, maxInFlight: () => maxInFlight };
}
const pt = (sec: number): GpsPoint => ({ lat: 52 + sec / 1e4, lng: -0.9, accuracy_m: 10, recorded_at: new Date(Date.UTC(2026, 9, 4, 10, 0, sec)).toISOString() });
const offline: Err = { message: "TypeError: Network request failed" };

const cases: [string, () => Promise<void>][] = [
  ["two concurrent flush triggers -> only one upload in flight", async () => {
    const { q, api, calls, maxInFlight } = setup();
    await q.add([pt(1), pt(2)]);
    const a = q.flush(api), b = q.flush(api); // e.g. background task + app resume
    await tick(); await tick();
    assert.equal(calls.length, 1, "second trigger must not start its own upload");
    calls[0].release(); await tick(); await tick();
    assert.deepEqual(await a, { remaining: 0, ok: true });
    assert.deepEqual(await b, { remaining: 0, ok: true });
    assert.equal(maxInFlight(), 1);
  }],
  ["trigger during an active flush -> exactly one follow-up pass, sending new points", async () => {
    const { q, api, calls, queued, maxInFlight } = setup();
    await q.add([pt(1)]);
    const a = q.flush(api); await tick();
    await q.add([pt(2)]);                          // background fix arrives mid-upload
    const b = q.flush(api), c = q.flush(api);      // two more triggers coalesce
    calls[0].release(); await tick(); await tick(); await tick();
    assert.equal(calls.length, 2, "the new point is sent once, after the first batch");
    assert.deepEqual(calls[1].points.map((p) => p.recorded_at), [pt(2).recorded_at]);
    calls[1].release();
    await Promise.all([a, b, c]);
    assert.equal(calls.length, 2); assert.equal(queued().length, 0); assert.equal(maxInFlight(), 1);
  }],
  ["background + foreground at the same time: points from both sent in time order, one upload at a time", async () => {
    const { q, api, calls, maxInFlight } = setup();
    await Promise.all([q.add([pt(3), pt(4)]), q.add([pt(1), pt(2)])]);
    const f = Promise.all([q.flush(api), q.flush(api)]);
    await tick(); await tick();
    calls[0].release(); await f;
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].points.map((p) => p.recorded_at), [1, 2, 3, 4].map((s) => pt(s).recorded_at));
    assert.equal(maxInFlight(), 1);
  }],
  ["failure keeps every point queued, in order; retry sends them in the same order", async () => {
    const { q, api, calls, queued } = setup();
    await q.add([pt(2), pt(1), pt(3)]);
    const a = q.flush(api); await tick(); calls[0].release(offline);
    assert.deepEqual(await a, { remaining: 3, ok: false });
    assert.deepEqual(queued().map((p) => p.recorded_at), [1, 2, 3].map((s) => pt(s).recorded_at));
    const b = q.flush(api); await tick(); calls[1].release();
    assert.deepEqual(await b, { remaining: 0, ok: true });
    assert.deepEqual(calls[1].points, calls[0].points, "the retry re-sends the same points in the same order");
  }],
  ["a failed flush does not trigger a follow-up pass (no hammering while offline)", async () => {
    const { q, api, calls } = setup();
    await q.add([pt(1)]);
    const a = q.flush(api), b = q.flush(api); await tick();
    calls[0].release(offline);
    await Promise.all([a, b]); await tick();
    assert.equal(calls.length, 1);
  }],
  ["a successful batch is removed exactly once; points appended during the upload are kept (GPS-3)", async () => {
    const { q, api, calls, queued } = setup();
    await q.add([pt(1), pt(2)]);
    const a = q.flush(api); await tick();
    await q.add([pt(3)]);           // before the fix this point could be overwritten
    await q.add([pt(0)]);           // an older point (e.g. deferred iOS delivery) must not be dropped
    calls[0].release(); await tick(); await tick();
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].points.map((p) => p.recorded_at), [pt(0).recorded_at, pt(3).recorded_at]);
    calls[1].release(); await a;
    assert.equal(queued().length, 0);
    const sent = calls.flatMap((c) => c.points.map((p) => p.recorded_at));
    assert.equal(new Set(sent).size, sent.length, "no point submitted twice");
  }],
  ["repeated failures never create concurrent uploads", async () => {
    const { q, api, calls, maxInFlight } = setup();
    await q.add([pt(1)]);
    for (let i = 0; i < 5; i++) {
      const fs = [q.flush(api), q.flush(api), q.flush(api)]; await tick();
      calls[calls.length - 1].release(offline); await Promise.all(fs);
    }
    assert.equal(calls.length, 5); assert.equal(maxInFlight(), 1);
  }],
  ["batches of 200 are sent sequentially, oldest first", async () => {
    const { q, api, calls, maxInFlight } = setup();
    await q.add(Array.from({ length: 450 }, (_, i) => pt(i)));
    const a = q.flush(api);
    for (let i = 0; i < 3; i++) { await tick(); await tick(); calls[i].release(); }
    assert.deepEqual(await a, { remaining: 0, ok: true });
    assert.deepEqual(calls.map((c) => c.points.length), [200, 200, 50]);
    assert.ok(calls[0].points[199].recorded_at < calls[1].points[0].recorded_at);
    assert.equal(maxInFlight(), 1);
  }],
  ["queue cap (2000, oldest dropped) is unchanged", async () => {
    const { q, queued } = setup();
    await q.add(Array.from({ length: 2100 }, (_, i) => pt(i)));
    assert.equal(queued().length, 2000);
    assert.equal(queued()[0].recorded_at, pt(100).recorded_at);
  }],
  ["a non-retryable rejection still clears the backlog (existing behaviour)", async () => {
    const { q, api, calls, queued } = setup();
    await q.add([pt(1), pt(2)]);
    const a = q.flush(api); await tick(); calls[0].release({ code: "MV403", message: "NOT_A_DRIVER" });
    assert.deepEqual(await a, { remaining: 0, ok: false });
    assert.equal(queued().length, 0);
  }],
  ["clear() during an upload is not undone by the upload finishing", async () => {
    const { q, api, calls, queued } = setup();
    await q.add([pt(1), pt(2)]);
    const a = q.flush(api); await tick();
    await q.clear();                // sign-out
    calls[0].release(); await a;
    assert.equal(queued().length, 0); assert.equal(calls.length, 1);
  }],
];

let failed = 0;
for (const [name, fn] of cases) {
  try { await fn(); console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}: ${(e as Error).message}`); }
}
console.log(`\n${cases.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
