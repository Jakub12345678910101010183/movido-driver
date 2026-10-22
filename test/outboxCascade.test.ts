// Unit tests: a rejected job action holds back that job's later actions
// instead of letting them fail one after another (W-1). Offline, mocked API:
//   npm run test:unit
// MOVIDO_OUTBOX_MODULE can point at another build of outbox.ts (used to show
// the pre-fix behaviour).
import assert from "node:assert/strict";
import type { Api } from "../src/core/api.ts";
import type { KV, OutboxAction } from "../src/core/outbox.ts";

const mod = process.env.MOVIDO_OUTBOX_MODULE ?? "../src/core/outbox.ts";
const { Outbox } = (await import(mod)) as typeof import("../src/core/outbox.ts");

type Err = { code?: string; message?: string } | null;
const NOT_AT_STOP: Err = { code: "MV409", message: "NOT_AT_STOP" };
const HELD = "Waiting for an earlier step of this job";

/** reply(callName, attemptOfThatCall) → error or null. */
function setup(reply: (call: string, n: number) => Err) {
  const store = new Map<string, string>();
  const kv: KV = { get: async (k) => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); } };
  const calls: string[] = []; const count = new Map<string, number>(); const deleted: string[] = [];
  const res = (c: string) => { calls.push(c); const n = (count.get(c) ?? 0) + 1; count.set(c, n); const e = reply(c, n); return { data: e ? null : {}, error: e }; };
  const api = {
    startJob: async (j: number) => res(`start:${j}`),
    markStop: async (j: number, i: number, st: string) => res(`stop:${j}:${i}:${st}`),
    completeJob: async (x: { jobId: number }) => res(`complete:${x.jobId}`),
    upload: async (_b: string, p: string) => res(`upload:${p}`),
    sendMessage: async () => res("message"),
    logFuel: async () => res("fuel"),
    reportIncident: async () => res("incident"),
    submitCheck: async () => res("check"),
  } as unknown as Api;
  const files: Record<string, number> = {};
  let n = 0;
  const box = new Outbox(kv, {
    api, newId: () => `id${++n}`, now: () => 1_000_000,
    readFile: async (uri) => new ArrayBuffer(files[uri] ?? 4),
    deleteFile: async (uri) => { deleted.push(uri); },
  });
  return { box, calls, files, deleted };
}
const stop = (j: number, i: number, status: "arrived" | "completed" = "arrived"): OutboxAction => ({ kind: "mark_stop", jobId: j, stopIndex: i, status, at: "2026-10-05T09:00:00.000Z" });
const pod = (j: number, uri: string | null = null): OutboxAction => ({ kind: "complete_job", jobId: j,
  photo: uri ? { uri, bucket: "pod-photos", path: `p/${uri}`, contentType: "image/jpeg" } : null,
  signature: uri ? null : "data:image/png;base64,AA==", recipient: null, notes: null, lat: null, lng: null, capturedAt: "2026-10-05T10:00:00.000Z" });

const cases: [string, () => Promise<void>][] = [
  ["stop 1 rejected: stop 2 and the POD are held (no calls) and shown as waiting, not failed", async () => {
    const { box, calls } = setup((c) => (c === "stop:1:0:arrived" ? NOT_AT_STOP : null));
    await box.enqueue(stop(1, 0)); await box.enqueue(stop(1, 1)); await box.enqueue(pod(1));
    assert.deepEqual(await box.process(), { sent: 0, failed: 1, waiting: 2, offline: false });
    assert.deepEqual(calls, ["stop:1:0:arrived"], "no cascade of STOP_ORDER / STOPS_PENDING");
    assert.deepEqual(box.list().map((i) => i.state), ["failed", "pending", "pending"]);
    assert.deepEqual(box.list().slice(1).map((i) => i.lastError), [HELD, HELD]);
    await box.process();
    assert.deepEqual(calls, ["stop:1:0:arrived"], "still held on later syncs; the rejected one is not retried by itself");
  }],
  ["held actions do not keep the retry timer busy (they wait for the driver)", async () => {
    const { box } = setup((c) => (c === "stop:1:0:arrived" ? NOT_AT_STOP : null));
    await box.enqueue(stop(1, 0)); await box.enqueue(stop(1, 1));
    await box.process();
    assert.equal(box.nextRetryAt(), null);
  }],
  ["'Try again' on stop 1 succeeds: stop 2 then the POD are sent, in order", async () => {
    const { box, calls } = setup((c, n) => (c === "stop:1:0:arrived" && n === 1 ? NOT_AT_STOP : null));
    await box.enqueue(stop(1, 0)); await box.enqueue(stop(1, 1)); await box.enqueue(pod(1));
    await box.process();
    await box.retry(box.list()[0].id);
    assert.deepEqual(await box.process(), { sent: 3, failed: 0, waiting: 0, offline: false });
    assert.deepEqual(calls, ["stop:1:0:arrived", "stop:1:0:arrived", "stop:1:1:arrived", "complete:1"]);
    assert.equal(box.list().length, 0);
  }],
  ["'Try again' fails again: the job stays held, nothing cascades", async () => {
    const { box, calls } = setup((c) => (c === "stop:1:0:arrived" ? NOT_AT_STOP : null));
    await box.enqueue(stop(1, 0)); await box.enqueue(pod(1));
    await box.process(); await box.retry(box.list()[0].id); await box.process();
    assert.deepEqual(calls, ["stop:1:0:arrived", "stop:1:0:arrived"]);
    assert.deepEqual(box.list().map((i) => i.state), ["failed", "pending"]);
  }],
  ["delete the rejected stop: the held actions go to the server, which decides (one more refusal at most per step, no cascade)", async () => {
    const { box, calls } = setup((c) => (c === "stop:1:0:arrived" ? NOT_AT_STOP : c === "stop:1:1:arrived" ? { code: "MV409", message: "STOP_ORDER" } : null));
    await box.enqueue(stop(1, 0)); await box.enqueue(stop(1, 1)); await box.enqueue(pod(1));
    await box.process();
    await box.discard(box.list()[0].id);
    assert.deepEqual(await box.process(), { sent: 0, failed: 1, waiting: 1, offline: false });
    assert.deepEqual(calls, ["stop:1:0:arrived", "stop:1:1:arrived"], "the POD is now held behind stop 2's refusal");
  }],
  ["the driver taps the rejected stop again (new action, new fix): the redo is not held; on success it replaces the rejected one and releases the job", async () => {
    const { box, calls } = setup((c, n) => (c === "stop:1:0:arrived" && n === 1 ? NOT_AT_STOP : null));
    await box.enqueue(stop(1, 0)); await box.enqueue(pod(1));
    await box.process();
    await box.enqueue(stop(1, 0));                      // tapped again at the stop
    assert.equal((await box.process()).sent, 1);
    assert.deepEqual(calls, ["stop:1:0:arrived", "stop:1:0:arrived"]);
    assert.deepEqual(box.list().map((i) => i.action.kind), ["complete_job"], "rejected attempt removed, POD still queued");
    assert.equal((await box.process()).sent, 1);
    assert.deepEqual(calls.at(-1), "complete:1");
  }],
  ["another job is not blocked; messages, fuel, incident and check are not blocked", async () => {
    const { box, calls } = setup((c) => (c === "stop:1:0:arrived" ? NOT_AT_STOP : null));
    await box.enqueue(stop(1, 0)); await box.enqueue(stop(1, 1));
    await box.enqueue(stop(2, 0)); await box.enqueue(pod(2));
    await box.enqueue({ kind: "message", content: "late", senderId: "u", organizationId: "o" });
    await box.enqueue({ kind: "fuel", fuelType: "diesel", litres: 50, pricePerLitre: null, totalCost: null, mileage: null, station: null, lat: null, lng: null, receipt: null, filledAt: "2026-10-05T10:00:00.000Z" });
    await box.enqueue({ kind: "incident", type: "other", description: "x", jobId: 1, lat: null, lng: null, photos: [], occurredAt: "2026-10-05T10:00:00.000Z" });
    await box.enqueue({ kind: "vehicle_check", items: [{ key: "tyres", status: "pass" }], vehicleId: null, odometer: null, notes: null, photos: [], lat: null, lng: null, checkedAt: "2026-10-05T10:00:00.000Z" });
    assert.deepEqual(await box.process(), { sent: 6, failed: 1, waiting: 1, offline: false });
    assert.deepEqual(calls, ["stop:1:0:arrived", "stop:2:0:arrived", "complete:2", "message", "fuel", "incident", "check"]);
  }],
  ["W-2 regression: the retaken POD after an empty-photo rejection goes through and replaces the rejected one", async () => {
    const { box, calls, files, deleted } = setup(() => null);
    files["empty.jpg"] = 0;
    await box.enqueue(pod(1, "empty.jpg"));
    assert.equal((await box.process()).failed, 1);
    await box.enqueue(pod(1, "retake.jpg"));
    assert.deepEqual(await box.process(), { sent: 1, failed: 0, waiting: 0, offline: false });
    assert.deepEqual(calls, ["upload:p/retake.jpg", "complete:1"]);
    assert.equal(box.list().length, 0);
    assert.deepEqual(deleted.sort(), ["empty.jpg", "retake.jpg"]);
  }],
  ["a waiting (offline) action still holds its job as before", async () => {
    const { box, calls } = setup((c) => (c.startsWith("stop:") ? { message: "TypeError: Network request failed" } : null));
    await box.enqueue(stop(1, 0)); await box.enqueue(pod(1));
    const s = await box.process();
    assert.equal(s.offline, true); assert.deepEqual(calls, ["stop:1:0:arrived"]);
    assert.deepEqual(box.list().map((i) => i.state), ["pending", "pending"]);
  }],
];

let failed = 0;
for (const [name, fn] of cases) {
  try { await fn(); console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}: ${(e as Error).message.split("\n")[0]}`); }
}
console.log(`\n${cases.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
