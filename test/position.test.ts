// Unit tests for the bounded location lookup used by incidents, POD, fuel and
// vehicle checks. Offline, no backend:  npm run test:unit
import assert from "node:assert/strict";
import { acquirePosition, type PositionSource } from "../src/core/position.ts";

const FIX = { lat: 52.24, lng: -0.9 }, CACHED = { lat: 52.2, lng: -0.95 };
const never = <T>() => new Promise<T>(() => {});
const after = <T>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const fast = { readyMs: 60, lastKnownMs: 60, freshMs: 200 };

const src = (o: Partial<PositionSource>): PositionSource => ({
  ready: async () => "ok", lastKnown: async () => null, fresh: async () => FIX, ...o,
});

async function timed(p: Promise<unknown>) { const t = Date.now(); const v = await p; return { v, ms: Date.now() - t }; }

const cases: [string, () => Promise<void>][] = [
  ["normal: cached fix is used without waiting for GPS", async () => {
    const r = await timed(acquirePosition(src({ lastKnown: async () => CACHED, fresh: never }), fast));
    assert.deepEqual(r.v, CACHED); assert.ok(r.ms < 50);
  }],
  ["normal: fresh fix when nothing cached", async () => {
    assert.deepEqual(await acquirePosition(src({}), fast), FIX);
  }],
  ["permission denied returns null at once", async () => {
    const r = await timed(acquirePosition(src({ ready: async () => "no_permission", lastKnown: never, fresh: never }), fast));
    assert.equal(r.v, null); assert.ok(r.ms < 50);
  }],
  ["services off: no fresh-fix wait, null promptly", async () => {
    const r = await timed(acquirePosition(src({ ready: async () => "services_off", fresh: never }), fast));
    assert.equal(r.v, null); assert.ok(r.ms < 50);
  }],
  ["services off: a recent cached fix is still used", async () => {
    assert.deepEqual(await acquirePosition(src({ ready: async () => "services_off", lastKnown: async () => CACHED }), fast), CACHED);
  }],
  ["hanging permission check is cut off (treated as no permission)", async () => {
    const r = await timed(acquirePosition(src({ ready: never, fresh: never }), fast));
    assert.equal(r.v, null); assert.ok(r.ms >= 55 && r.ms < 150, `took ${r.ms} ms`);
  }],
  ["hanging last-known lookup is cut off, then fresh fix is used", async () => {
    const r = await timed(acquirePosition(src({ lastKnown: never }), fast));
    assert.deepEqual(r.v, FIX); assert.ok(r.ms >= 55 && r.ms < 150, `took ${r.ms} ms`);
  }],
  ["GPS timeout: everything hangs → null within the total limit", async () => {
    const r = await timed(acquirePosition(src({ lastKnown: never, fresh: never }), fast));
    assert.equal(r.v, null); assert.ok(r.ms >= 255 && r.ms < 400, `took ${r.ms} ms`);
  }],
  ["slow fresh fix beyond its limit → null", async () => {
    assert.equal(await acquirePosition(src({ fresh: () => after(500, FIX) }), fast), null);
  }],
  ["errors (rejected or thrown) never escape", async () => {
    assert.equal(await acquirePosition(src({ ready: async () => { throw new Error("x"); } }), fast), null);
    assert.equal(await acquirePosition(src({ ready: () => { throw new Error("sync"); } }), fast), null);
    assert.deepEqual(await acquirePosition(src({ lastKnown: async () => { throw new Error("x"); } }), fast), FIX);
    assert.equal(await acquirePosition(src({ fresh: async () => { throw new Error("x"); } }), fast), null);
  }],
  ["default limits keep the existing 8 s fresh-fix cap", async () => {
    const { POSITION_LIMITS } = await import("../src/core/position.ts");
    assert.equal(POSITION_LIMITS.freshMs, 8000);
    assert.ok(POSITION_LIMITS.readyMs + POSITION_LIMITS.lastKnownMs + POSITION_LIMITS.freshMs <= 11000);
  }],
];

let failed = 0;
for (const [name, fn] of cases) {
  try { await fn(); console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}: ${(e as Error).message}`); }
}
console.log(`\n${cases.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
