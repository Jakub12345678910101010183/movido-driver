// Unit tests for push permission/registration decisions (core/push.ts).
// Offline, no backend:  npm run test:unit
import assert from "node:assert/strict";
import { classifyPermission, registerPush, shouldRecheckOnAppState, turnOnAction, type PermissionInfo, type PushDeps } from "../src/core/push.ts";

const TOKEN = "ExponentPushToken[abc123_-XYZ]";
const UNDETERMINED: PermissionInfo = { status: "undetermined", canAskAgain: true };
const DENIED_CAN_ASK: PermissionInfo = { status: "denied", canAskAgain: true };
const DENIED_FINAL: PermissionInfo = { status: "denied", canAskAgain: false };
const GRANTED: PermissionInfo = { status: "granted", canAskAgain: true };

function deps(o: Partial<PushDeps> & { answer?: PermissionInfo } = {}) {
  const calls = { request: 0, getToken: 0, save: [] as string[] };
  const d: PushDeps = {
    isDevice: true, projectId: "b3f3ce93-5e37-4abf-a2e9-690597a07740",
    prepare: async () => {},
    getPermission: async () => UNDETERMINED,
    requestPermission: async () => { calls.request++; return o.answer ?? GRANTED; },
    getToken: async () => { calls.getToken++; return TOKEN; },
    saveToken: async (t) => { calls.save.push(t); return true; },
    ...o,
  };
  return { d, calls };
}

const cases: [string, () => Promise<void> | void][] = [
  ["Android 13 first run (undetermined) is 'not asked', not denied", () => {
    assert.equal(classifyPermission(UNDETERMINED), "not_asked");
    assert.equal(classifyPermission(DENIED_CAN_ASK), "not_asked");
    assert.equal(classifyPermission(DENIED_FINAL), "denied");
    assert.equal(classifyPermission(GRANTED), "granted");
  }],
  ["never requested: sign-in check does not prompt, reports not_asked", async () => {
    const { d, calls } = deps();
    assert.deepEqual(await registerPush(d, false), { status: "not_asked", token: null });
    assert.equal(calls.request, 0); assert.equal(calls.save.length, 0);
  }],
  ["never requested: 'Turn on notifications' shows the OS prompt, then registers", async () => {
    assert.equal(turnOnAction("not_asked"), "prompt");
    const { d, calls } = deps();
    assert.deepEqual(await registerPush(d, true), { status: "registered", token: TOKEN });
    assert.equal(calls.request, 1); assert.deepEqual(calls.save, [TOKEN]);
  }],
  ["prompt answered 'Don't allow' (can still ask) stays not_asked, nothing saved", async () => {
    const { d, calls } = deps({ answer: DENIED_CAN_ASK });
    assert.deepEqual(await registerPush(d, true), { status: "not_asked", token: null });
    assert.equal(calls.save.length, 0);
  }],
  ["denied for good: Settings path, no prompt attempted", async () => {
    const { d, calls } = deps({ getPermission: async () => DENIED_FINAL });
    assert.deepEqual(await registerPush(d, true), { status: "denied", token: null });
    assert.equal(calls.request, 0);
    assert.equal(turnOnAction("denied"), "settings");
  }],
  ["granted: registers without prompting and saves the token", async () => {
    const { d, calls } = deps({ getPermission: async () => GRANTED });
    assert.deepEqual(await registerPush(d, false), { status: "registered", token: TOKEN });
    assert.equal(calls.request, 0); assert.deepEqual(calls.save, [TOKEN]);
    assert.equal(turnOnAction("registered"), "none");
  }],
  ["granted with the same token already saved: no rewrite", async () => {
    const { d, calls } = deps({ getPermission: async () => GRANTED });
    assert.deepEqual(await registerPush(d, false, TOKEN), { status: "registered", token: TOKEN });
    assert.equal(calls.save.length, 0);
  }],
  ["token fetch failure (e.g. no FCM in the build) → error, nothing saved, button offers retry", async () => {
    const { d, calls } = deps({ getPermission: async () => GRANTED, getToken: async () => { throw new Error("Default FirebaseApp is not initialized"); } });
    assert.deepEqual(await registerPush(d, false), { status: "error", token: null });
    assert.equal(calls.save.length, 0);
    assert.equal(turnOnAction("error"), "prompt");
  }],
  ["token save rejected by the server → error", async () => {
    const { d } = deps({ getPermission: async () => GRANTED, saveToken: async () => false });
    assert.deepEqual(await registerPush(d, false), { status: "error", token: null });
  }],
  ["malformed token is never saved (matches the drivers.push_token rule)", async () => {
    const { d, calls } = deps({ getPermission: async () => GRANTED, getToken: async () => "not-a-token" });
    assert.deepEqual(await registerPush(d, false), { status: "error", token: null });
    assert.equal(calls.save.length, 0);
  }],
  ["no EAS project id → not_configured; emulator → unavailable", async () => {
    assert.equal((await registerPush(deps({ getPermission: async () => GRANTED, projectId: null }).d, false)).status, "not_configured");
    assert.equal((await registerPush(deps({ isDevice: false }).d, true)).status, "unavailable");
    assert.equal(turnOnAction("unavailable"), "none"); assert.equal(turnOnAction("not_configured"), "none");
  }],
  ["permission API failures never throw", async () => {
    assert.equal((await registerPush(deps({ getPermission: async () => { throw new Error("x"); } }).d, true)).status, "error");
    assert.equal((await registerPush(deps({ requestPermission: async () => { throw new Error("x"); } }).d, true)).status, "error");
    assert.equal((await registerPush(deps({ prepare: async () => { throw new Error("channel"); }, getPermission: async () => GRANTED }).d, false)).status, "registered");
  }],
  ["foreground re-check: only when the app becomes active again", () => {
    assert.equal(shouldRecheckOnAppState("background", "active"), true);
    assert.equal(shouldRecheckOnAppState("inactive", "active"), true);
    assert.equal(shouldRecheckOnAppState("active", "active"), false);
    assert.equal(shouldRecheckOnAppState("active", "background"), false);
  }],
  ["returning from Settings after enabling: re-check registers without a prompt", async () => {
    let perm: PermissionInfo = DENIED_FINAL;
    const { d, calls } = deps({ getPermission: async () => perm });
    assert.equal((await registerPush(d, false)).status, "denied");
    perm = GRANTED; // user allowed it in Settings, app comes back to the foreground
    assert.ok(shouldRecheckOnAppState("background", "active"));
    assert.equal((await registerPush(d, false)).status, "registered");
    assert.equal(calls.request, 0);
  }],
];

let failed = 0;
for (const [name, fn] of cases) {
  try { await fn(); console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}: ${(e as Error).message}`); }
}
console.log(`\n${cases.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
