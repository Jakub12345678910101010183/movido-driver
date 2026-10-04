// Unit tests: an empty (0-byte) or unreadable photo never reaches upload or the
// RPC that uses it (W-2, client part). Offline, no backend, mocked API:
//   npm run test:unit
// MOVIDO_OUTBOX_MODULE can point at another build of outbox.ts (used to show
// the pre-fix behaviour).
import assert from "node:assert/strict";
import type { Api } from "../src/core/api.ts";
import { describeError, isRetryable } from "../src/core/errors.ts";
import type { KV, LocalFile, OutboxAction } from "../src/core/outbox.ts";

const mod = process.env.MOVIDO_OUTBOX_MODULE ?? "../src/core/outbox.ts";
const { Outbox } = (await import(mod)) as typeof import("../src/core/outbox.ts");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer;
type FileState = "ok" | "empty" | "missing";

function setup(files: Record<string, FileState>, offlineFor: (a: string) => boolean = () => false) {
  const store = new Map<string, string>();
  const kv: KV = { get: async (k) => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); } };
  const calls: string[] = [];
  const res = (name: string) => { calls.push(name); return offlineFor(name) ? { data: null, error: { message: "TypeError: Network request failed" } } : { data: { ok: true }, error: null }; };
  const api = {
    upload: async (_b: string, path: string) => res(`upload:${path}`),
    startJob: async (jobId: number) => res(`start:${jobId}`),
    markStop: async (jobId: number, i: number, status: string) => res(`stop:${jobId}:${i}:${status}`),
    completeJob: async (i: { jobId: number }) => res(`complete:${i.jobId}`),
    reportIncident: async () => res("incident"),
    logFuel: async () => res("fuel"),
    submitCheck: async () => res("check"),
  } as unknown as Api;
  const readFile = async (uri: string) => {
    const s = files[uri] ?? "missing";
    if (s === "missing") throw new Error("ENOENT");
    return s === "empty" ? new ArrayBuffer(0) : JPEG;
  };
  let n = 0;
  const box = new Outbox(kv, { api, readFile, newId: () => `id${++n}`, now: () => 1_000_000 });
  return { box, calls };
}
const file = (uri: string, path = `p/${uri}`): LocalFile => ({ uri, bucket: "pod-photos", path, contentType: "image/jpeg" });
const pod = (jobId: number, photo: LocalFile | null): OutboxAction =>
  ({ kind: "complete_job", jobId, photo, signature: null, recipient: null, notes: null, lat: null, lng: null, capturedAt: "2026-10-04T10:00:00.000Z" });
const stop = (jobId: number, i: number): OutboxAction => ({ kind: "mark_stop", jobId, stopIndex: i, status: "completed", at: "2026-10-04T09:00:00.000Z" });
const driverFile = (uri: string): LocalFile => ({ uri, bucket: "driver-uploads", path: `d/${uri}`, contentType: "image/jpeg" });

const cases: [string, () => Promise<void>][] = [
  ["0-byte POD photo: no upload, no completeJob, failed with a clear non-retryable error", async () => {
    const { box, calls } = setup({ "pod.jpg": "empty" });
    await box.enqueue(pod(1, file("pod.jpg")));
    assert.deepEqual(await box.process(), { sent: 0, failed: 1, waiting: 0, offline: false });
    assert.deepEqual(calls, []);
    const [it] = box.list();
    assert.equal(it.state, "failed");
    assert.equal(it.lastError, "Photo is empty — please retake it.");
    assert.equal(isRetryable({ code: "MV400", message: "EMPTY_PHOTO" }), false);
    assert.equal(await box.process().then((s) => s.sent + s.failed), 0, "a failed item is not retried automatically");
    assert.deepEqual(calls, []);
  }],
  ["unreadable / missing POD photo: same behaviour", async () => {
    const { box, calls } = setup({});
    await box.enqueue(pod(1, file("gone.jpg")));
    assert.deepEqual(await box.process(), { sent: 0, failed: 1, waiting: 0, offline: false });
    assert.deepEqual(calls, []);
    assert.equal(box.list()[0].lastError, "Photo is no longer on this phone — please retake it.");
  }],
  ["valid POD photo: uploaded, then the job is completed (unchanged)", async () => {
    const { box, calls } = setup({ "pod.jpg": "ok" });
    await box.enqueue(pod(1, file("pod.jpg")));
    assert.deepEqual(await box.process(), { sent: 1, failed: 0, waiting: 0, offline: false });
    assert.deepEqual(calls, ["upload:p/pod.jpg", "complete:1"]);
  }],
  ["signature-only POD (no photo) is unaffected", async () => {
    const { box, calls } = setup({});
    await box.enqueue(pod(1, null));
    assert.equal((await box.process()).sent, 1);
    assert.deepEqual(calls, ["complete:1"]);
  }],
  ["incident with a 0-byte photo: rejected before any upload or report", async () => {
    const { box, calls } = setup({ "a.jpg": "ok", "b.jpg": "empty" });
    await box.enqueue({ kind: "incident", type: "breakdown", description: "x", jobId: null, lat: null, lng: null,
      photos: [driverFile("b.jpg"), driverFile("a.jpg")], occurredAt: "2026-10-04T10:00:00.000Z" });
    assert.equal((await box.process()).failed, 1);
    assert.deepEqual(calls, []);
  }],
  ["fuel with a 0-byte receipt: rejected", async () => {
    const { box, calls } = setup({ "r.jpg": "empty" });
    await box.enqueue({ kind: "fuel", fuelType: "diesel", litres: 100, pricePerLitre: null, totalCost: null, mileage: null, station: null,
      lat: null, lng: null, receipt: driverFile("r.jpg"), filledAt: "2026-10-04T10:00:00.000Z" });
    assert.equal((await box.process()).failed, 1);
    assert.deepEqual(calls, []);
  }],
  ["vehicle check with a 0-byte photo: rejected (later photo of the same check not uploaded either)", async () => {
    const { box, calls } = setup({ "c1.jpg": "ok", "c2.jpg": "empty" });
    await box.enqueue({ kind: "vehicle_check", items: [{ key: "tyres", status: "fail" }], vehicleId: null, odometer: null, notes: null,
      photos: [driverFile("c1.jpg"), driverFile("c2.jpg")], lat: null, lng: null, checkedAt: "2026-10-04T10:00:00.000Z" });
    assert.equal((await box.process()).failed, 1);
    assert.deepEqual(calls, ["upload:d/c1.jpg"], "the check itself is never submitted");
  }],
  ["per-job hold-back unchanged: an empty POD stays behind the job's waiting stop and is never sent", async () => {
    const { box, calls } = setup({ "pod.jpg": "empty" }, (c) => c.startsWith("stop:"));
    await box.enqueue(stop(1, 0)); await box.enqueue(pod(1, file("pod.jpg")));
    const s = await box.process();
    assert.equal(s.offline, true);
    assert.deepEqual(calls, ["stop:1:0:completed"]);
    assert.deepEqual(box.list().map((i) => i.state), ["pending", "pending"]);
  }],
  ["another job is not blocked by a failed empty POD; the retaken POD for the same job goes through", async () => {
    const { box, calls } = setup({ "empty.jpg": "empty", "retake.jpg": "ok", "other.jpg": "ok" });
    await box.enqueue(pod(1, file("empty.jpg")));
    await box.enqueue(pod(2, file("other.jpg")));
    await box.enqueue(pod(1, file("retake.jpg", "p/retake.jpg")));
    const s = await box.process();
    assert.deepEqual(s, { sent: 2, failed: 1, waiting: 0, offline: false });
    assert.deepEqual(calls, ["upload:p/other.jpg", "complete:2", "upload:p/retake.jpg", "complete:1"]);
    assert.equal(box.list().length, 1); assert.equal(box.list()[0].state, "failed");
  }],
  ["driver-facing messages", async () => {
    assert.equal(describeError({ code: "MV400", message: "EMPTY_PHOTO" }), "Photo is empty — please retake it.");
    assert.equal(describeError({ code: "MV400", message: "PHOTO_MISSING: the photo is no longer on this phone" }), "Photo is no longer on this phone — please retake it.");
  }],
];

let failed = 0;
for (const [name, fn] of cases) {
  try { await fn(); console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}: ${(e as Error).message.split("\n")[0]}`); }
}
console.log(`\n${cases.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
