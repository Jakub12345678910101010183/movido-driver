// Unit tests for the offline outbox with the server's stop state machine
// (STOP_ORDER, STOP_ALREADY_COMPLETED, STOPS_PENDING). Offline, no backend:
//   npm run test:unit
import assert from "node:assert/strict";
import type { Api } from "../src/core/api.ts";
import { Outbox, type KV, type OutboxAction } from "../src/core/outbox.ts";

type Err = { code?: string; message?: string; status?: number } | null;

function setup(reply: (a: OutboxAction) => Err) {
  const store = new Map<string, string>();
  const kv: KV = { get: async (k) => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); } };
  const sent: string[] = [];
  const fixes: [number | null, number | null, number | null, string][] = [];
  const rec = (a: OutboxAction) => { sent.push(a.kind === "mark_stop" ? `stop${a.stopIndex}:${a.status}` : a.kind); return { data: null, error: reply(a) }; };
  const api = {
    startJob: async (jobId: number) => rec({ kind: "start_job", jobId }),
    markStop: async (jobId: number, stopIndex: number, status: "arrived" | "completed", at: string, lat?: number | null, lng?: number | null, accuracy?: number | null) =>
      { fixes.push([lat ?? null, lng ?? null, accuracy ?? null, at]); return rec({ kind: "mark_stop", jobId, stopIndex, status, at }); },
    completeJob: async (i: { jobId: number }) => rec({ kind: "complete_job", jobId: i.jobId, photo: null, signature: "s", recipient: null, notes: null, lat: null, lng: null, capturedAt: "" }),
    sendMessage: async () => rec({ kind: "message", content: "", senderId: "", organizationId: "" }),
  } as unknown as Api;
  let n = 0; let now = 1_000_000;
  const box = new Outbox(kv, { api, readFile: async () => new ArrayBuffer(0), newId: () => `id${++n}`, now: () => now });
  return { box, sent, fixes, tick: (ms: number) => { now += ms; } };
}
const stop = (jobId: number, stopIndex: number, status: "arrived" | "completed"): OutboxAction =>
  ({ kind: "mark_stop", jobId, stopIndex, status, at: "2026-09-28T10:00:00.000Z" });
const complete = (jobId: number): OutboxAction =>
  ({ kind: "complete_job", jobId, photo: null, signature: "data:image/png;base64,AA==", recipient: null, notes: null, lat: null, lng: null, capturedAt: "2026-09-28T10:05:00.000Z" });

const cases: [string, () => Promise<void>][] = [
  ["offline stops and completion sync in order", async () => {
    const { box, sent } = setup(() => null);
    for (const a of [stop(1, 0, "arrived"), stop(1, 0, "completed"), stop(1, 1, "completed"), complete(1)]) await box.enqueue(a);
    assert.deepEqual(await box.process(), { sent: 4, failed: 0, waiting: 0, offline: false });
    assert.deepEqual(sent, ["stop0:arrived", "stop0:completed", "stop1:completed", "complete_job"]);
  }],
  ["replayed delivery (STOP_ALREADY_COMPLETED) counts as sent, not failed", async () => {
    const { box } = setup((a) => (a.kind === "mark_stop" ? { code: "MV409", message: "STOP_ALREADY_COMPLETED" } : null));
    await box.enqueue(stop(1, 0, "completed")); await box.enqueue(complete(1));
    assert.deepEqual(await box.process(), { sent: 2, failed: 0, waiting: 0, offline: false });
    assert.equal(box.list().length, 0);
  }],
  ["a waiting stop holds back the same job's later actions (no STOP_ORDER)", async () => {
    let online = false;
    const { box, sent, tick } = setup(() => (online ? null : { message: "Network request failed" }));
    for (const a of [stop(1, 0, "completed"), stop(1, 1, "completed"), complete(1)]) await box.enqueue(a);
    const first = await box.process();
    assert.equal(first.offline, true); assert.deepEqual(sent, ["stop0:completed"]);
    online = true; // back online, but stop 0 is still in its back-off window
    const second = await box.process();
    assert.equal(second.sent, 0); assert.equal(second.waiting, 3);
    assert.deepEqual(sent, ["stop0:completed"], "later stops must not jump ahead of stop 0");
    tick(10 * 60_000);
    assert.deepEqual(await box.process(), { sent: 3, failed: 0, waiting: 0, offline: false });
    assert.deepEqual(sent, ["stop0:completed", "stop0:completed", "stop1:completed", "complete_job"]);
  }],
  ["other jobs and non-job actions are not held back", async () => {
    const { box, sent, tick } = setup((a) => (a.kind === "mark_stop" && a.jobId === 1 && sent.length === 1 ? { message: "Network request failed" } : null));
    await box.enqueue(stop(1, 0, "completed"));
    await box.process();
    await box.enqueue(stop(2, 0, "arrived")); await box.enqueue({ kind: "message", content: "hi", senderId: "u", organizationId: "o" });
    tick(1);
    const r = await box.process();
    assert.equal(r.sent, 2); assert.equal(r.waiting, 1);
  }],
  ["the fix taken at the tap is sent with the stop action (older queued items without one still send)", async () => {
    const { box, fixes } = setup(() => null);
    await box.enqueue({ kind: "mark_stop", jobId: 1, stopIndex: 0, status: "arrived", at: "2026-09-28T10:00:00.000Z", lat: 51.5, lng: -0.1, accuracy_m: 12 });
    await box.enqueue(stop(1, 0, "completed"));
    assert.deepEqual((await box.process()).sent, 2);
    assert.deepEqual(fixes, [[51.5, -0.1, 12, "2026-09-28T10:00:00.000Z"], [null, null, null, "2026-09-28T10:00:00.000Z"]]);
  }],
  ["location refusals are final and explained", async () => {
    const { box } = setup(() => ({ code: "MV409", message: "NOT_AT_STOP" }));
    await box.enqueue(stop(1, 0, "arrived"));
    assert.deepEqual(await box.process(), { sent: 0, failed: 1, waiting: 0, offline: false });
    assert.equal(box.list()[0].lastError, "You are not at this stop yet. Try again when you arrive.");
  }],
  ["STOP_ORDER and STOPS_PENDING are final: shown to the driver, not retried", async () => {
    const { box } = setup((a) => (a.kind === "mark_stop" ? { code: "MV409", message: "STOP_ORDER" } : { code: "MV409", message: "STOPS_PENDING" }));
    await box.enqueue(stop(1, 2, "arrived")); await box.enqueue(complete(1));
    assert.deepEqual(await box.process(), { sent: 0, failed: 2, waiting: 0, offline: false });
    assert.deepEqual(box.list().map((i) => i.lastError), ["Complete the previous stop first.", "Deliver every stop before completing the job."]);
  }],
];

let failed = 0;
for (const [name, fn] of cases) {
  try { await fn(); console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}: ${(e as Error).message}`); }
}
console.log(`\n${cases.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
