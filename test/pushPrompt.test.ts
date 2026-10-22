// Unit tests: a fresh install asks for notification permission once by itself
// (P-3). Offline, no backend, mocked platform calls:  npm run test:unit
import assert from "node:assert/strict";
import {
  registerPush, registerPushOnStart, shouldRegisterOnStart, turnOnAction,
  type PermissionInfo, type PromptMemory, type PushDeps,
} from "../src/core/push.ts";

const TOKEN = "ExponentPushToken[p3_test_TOKEN]";
const UNDETERMINED: PermissionInfo = { status: "undetermined", canAskAgain: true };
const DENIED_CAN_ASK: PermissionInfo = { status: "denied", canAskAgain: true };
const DENIED_FINAL: PermissionInfo = { status: "denied", canAskAgain: false };
const GRANTED: PermissionInfo = { status: "granted", canAskAgain: true };

/** A phone: OS permission state, a per-install store, and a log of platform calls. */
function phone(initial: PermissionInfo, answer: PermissionInfo = GRANTED) {
  let perm = initial;
  const store = new Map<string, string>();
  const log: string[] = [];
  const deps: PushDeps = {
    isDevice: true, projectId: "b3f3ce93-5e37-4abf-a2e9-690597a07740",
    prepare: async () => { log.push("channel"); },
    getPermission: async () => perm,
    requestPermission: async () => { log.push("prompt"); perm = answer; return perm; },
    getToken: async () => { log.push("token"); return TOKEN; },
    saveToken: async () => { log.push("save"); return true; },
  };
  const memory: PromptMemory = {
    get: async () => store.get("prompted") === "1",
    set: async () => { store.set("prompted", "1"); },
  };
  return { deps, memory, log, store };
}

const cases: [string, () => Promise<void> | void][] = [
  ["before the fix: the start-up check alone never prompts, so a fresh install never registers", async () => {
    const { deps, log } = phone(UNDETERMINED);
    assert.deepEqual(await registerPush(deps, false), { status: "not_asked", token: null }); // what app start used to call
    assert.deepEqual(log, ["channel"]);
  }],
  ["fresh install (undetermined): channel first, then one prompt, then the token is registered", async () => {
    const { deps, memory, log } = phone(UNDETERMINED, GRANTED);
    assert.deepEqual(await registerPushOnStart(deps, memory), { status: "registered", token: TOKEN });
    assert.deepEqual(log, ["channel", "prompt", "token", "save"]);
  }],
  ["already granted: no prompt, token registered", async () => {
    const { deps, memory, log } = phone(GRANTED);
    assert.equal((await registerPushOnStart(deps, memory)).status, "registered");
    assert.deepEqual(log, ["channel", "token", "save"]);
  }],
  ["denied for good (can't ask again): no prompt, no registration, Settings offered", async () => {
    const { deps, memory, log } = phone(DENIED_FINAL);
    const r = await registerPushOnStart(deps, memory);
    assert.deepEqual(r, { status: "denied", token: null });
    assert.deepEqual(log, ["channel"]);
    assert.equal(turnOnAction(r.status), "settings");
  }],
  ["refused at the automatic prompt: no registration, not asked again by itself; the button still offers the prompt", async () => {
    const { deps, memory, log } = phone(UNDETERMINED, DENIED_CAN_ASK);
    assert.equal((await registerPushOnStart(deps, memory)).status, "not_asked");
    assert.equal((await registerPushOnStart(deps, memory)).status, "not_asked");
    assert.equal(log.filter((l) => l === "prompt").length, 1);
    assert.ok(!log.includes("save"));
    assert.equal(turnOnAction("not_asked"), "prompt");
  }],
  ["repeated app starts (and sign-out / sign-in on the same install): at most one automatic prompt", async () => {
    const { deps, memory, log } = phone(UNDETERMINED, DENIED_CAN_ASK);
    for (let i = 0; i < 5; i++) await registerPushOnStart(deps, memory);
    assert.equal(log.filter((l) => l === "prompt").length, 1);
  }],
  ["the prompt is remembered before it is shown (an app killed during the prompt does not ask again)", async () => {
    const { deps, memory, store } = phone(UNDETERMINED);
    const d: PushDeps = { ...deps, requestPermission: async () => { assert.equal(store.get("prompted"), "1"); throw new Error("app killed"); } };
    assert.equal((await registerPushOnStart(d, memory)).status, "error");
    assert.equal(await memory.get(), true);
  }],
  ["if the per-install memory cannot be read or written, the app does not prompt by itself", async () => {
    const { deps, log } = phone(UNDETERMINED);
    const broken: PromptMemory = { get: async () => { throw new Error("storage"); }, set: async () => { throw new Error("storage"); } };
    assert.equal((await registerPushOnStart(deps, broken)).status, "not_asked");
    const writeOnlyBroken: PromptMemory = { get: async () => false, set: async () => { throw new Error("storage"); } };
    assert.equal((await registerPushOnStart(deps, writeOnlyBroken)).status, "not_asked");
    assert.ok(!log.includes("prompt"));
  }],
  ["'Turn on notifications' after an automatic refusal still shows the OS prompt (existing behaviour)", async () => {
    const { deps, memory, log } = phone(UNDETERMINED, DENIED_CAN_ASK);
    await registerPushOnStart(deps, memory);
    const again = phone(DENIED_CAN_ASK, GRANTED);
    assert.equal((await registerPush(again.deps, true)).status, "registered");
    assert.deepEqual(again.log, ["channel", "prompt", "token", "save"]);
    assert.equal(log.filter((l) => l === "prompt").length, 1);
  }],
  ["only a signed-in driver triggers start-up registration (signed out, office account, disabled: nothing)", () => {
    assert.equal(shouldRegisterOnStart("ready", true), true);
    assert.equal(shouldRegisterOnStart("ready", false), false);
    assert.equal(shouldRegisterOnStart("signed_out", false), false);
    assert.equal(shouldRegisterOnStart("not_driver", false), false);
    assert.equal(shouldRegisterOnStart("disabled", false), false);
    assert.equal(shouldRegisterOnStart("loading", true), false);
  }],
];

let failed = 0;
for (const [name, fn] of cases) {
  try { await fn(); console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}: ${(e as Error).message.split("\n")[0]}`); }
}
console.log(`\n${cases.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
