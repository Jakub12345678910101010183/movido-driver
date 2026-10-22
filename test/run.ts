// Integration tests: the app's own core modules (api, outbox, gps queue,
// stops, overlay) against the real MOViDO backend, signed in as QA accounts.
//
//   MOVIDO_TEST_DRIVER_EMAIL / MOVIDO_TEST_ADMIN_EMAIL / MOVIDO_TEST_OTHER_ADMIN_EMAIL
//   MOVIDO_TEST_PASSWORD, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
//
// Creates data only in the QA companies. Run: npm test
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createApi, type Api } from "../src/core/api.ts";
import { GpsQueue } from "../src/core/gpsQueue.ts";
import { applyPending } from "../src/core/overlay.ts";
import { driverUploadPath, Outbox, podPhotoPath, type KV } from "../src/core/outbox.ts";
import { legsOf, nextStopIndex, parseStops } from "../src/core/stops.ts";

const env = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`missing ${k}`); return v; };
const URL = env("EXPO_PUBLIC_SUPABASE_URL"), KEY = env("EXPO_PUBLIC_SUPABASE_ANON_KEY"), PW = env("MOVIDO_TEST_PASSWORD");
// 1x1 JPEG
const JPEG = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64")).buffer;

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}
function memKV(): KV { const m = new Map<string, string>(); return { get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); } }; }
async function signIn(email: string): Promise<SupabaseClient> {
  const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return sb;
}
/** An Api whose calls fail like a dead network until `online` is set. */
function flaky(api: Api, state: { online: boolean }): Api {
  return new Proxy(api, { get(t, p) {
    const f = (t as Record<string | symbol, unknown>)[p];
    if (typeof f !== "function") return f;
    return async (...a: unknown[]) => state.online ? (f as (...x: unknown[]) => unknown).apply(t, a)
      : { data: null, error: { message: "TypeError: Network request failed" } };
  } }) as Api;
}

const driverSb = await signIn(env("MOVIDO_TEST_DRIVER_EMAIL"));
const adminSb = await signIn(env("MOVIDO_TEST_ADMIN_EMAIL"));
const otherSb = await signIn(env("MOVIDO_TEST_OTHER_ADMIN_EMAIL"));
const api = createApi(driverSb), adminApi = createApi(adminSb), otherApi = createApi(otherSb);
const driverUser = (await driverSb.auth.getUser()).data.user!;

// ---------------- AUTH / PROFILE ----------------
const prof = await api.profile();
check("driver profile via RPC", !!prof.data?.driver?.id && !!prof.data.organization.id, `${prof.data?.driver.name} @ ${prof.data?.organization.name}, vehicle ${prof.data?.vehicle?.vehicle_id ?? "none"}, gps ${JSON.stringify(prof.data?.settings)}`);
check("driver role is 'driver'", (await api.role(driverUser.id)).data === "driver");
const adminProf = await adminApi.profile();
check("office user cannot call driver RPC", !!adminProf.error && /NOT_A_DRIVER/.test(adminProf.error.message ?? ""));
const anonApi = createApi(createClient(URL, KEY, { auth: { persistSession: false } }));
check("anonymous cannot call driver RPC", !!(await anonApi.profile()).error);
const me = prof.data!;
const org = me.organization.id, driverId = me.driver.id;

// ---------------- JOB SETUP (office creates a 3-stop job) ----------------
const ref = `QA-DRV-${Date.now().toString().slice(-6)}`;
const { data: created, error: cErr } = await adminSb.from("jobs").insert({
  reference: ref, customer: "QA Driver App Test", driver_id: driverId, vehicle_id: me.vehicle?.id ?? null, status: "assigned",
  pickup_address: "Crossley Park, Northampton NN4 7RE", pickup_lat: 52.2118, pickup_lng: -0.8921,
  delivery_address: "Final stop, Milton Keynes", delivery_lat: 52.0406, delivery_lng: -0.7594,
  scheduled_date: new Date().toISOString().slice(0, 10),
  stops: [
    { address: "Stop A, Northampton", lat: 52.2405, lng: -0.9027 },
    { address: "Stop B, Wellingborough", lat: 52.3027, lng: -0.6936 },
    { address: "Stop C, Milton Keynes", lat: 52.0406, lng: -0.7594 },
  ],
}).select("id").single();
check("office creates multi-stop job for the driver", !cErr && !!created, cErr?.message);
const jobId = (created as { id: number }).id;
const jobs = await api.jobs();
check("driver sees the new job (RLS)", !!jobs.data?.some((j) => j.id === jobId));
check("other company cannot see the job", !(await otherApi.jobs()).data?.some((j) => j.id === jobId) && !(await otherApi.job(jobId)).data);

// ---------------- OFFLINE OUTBOX: start + stops ----------------
const net = { online: false };
const kv = memKV();
const box = new Outbox(kv, { api: flaky(api, net), readFile: async () => JPEG, newId: randomUUID });
await box.enqueue({ kind: "start_job", jobId });
await box.enqueue({ kind: "mark_stop", jobId, stopIndex: 0, status: "arrived", at: new Date(Date.now() - 15 * 60_000).toISOString() });
await box.enqueue({ kind: "mark_stop", jobId, stopIndex: 0, status: "completed", at: new Date(Date.now() - 10 * 60_000).toISOString() });
let s = await box.process();
check("offline: actions kept on device, nothing lost", s.sent === 0 && s.offline && box.list().length === 3);
const overlay = applyPending((await api.jobs()).data!, box.list());
const oj = overlay.jobs.find((j) => j.id === jobId)!;
check("offline: UI shows pending start + stop, marked pending", oj.status === "in_progress" && parseStops(oj.stops)[0].status === "completed" && overlay.pending.get(jobId)!.stops.has(0));
check("offline: server unchanged", (await api.job(jobId)).data?.status === "assigned");
const persisted = new Outbox(kv, { api, readFile: async () => JPEG, newId: randomUUID });
check("outbox survives restart (reload from storage)", (await persisted.load()).length === 3);
net.online = true;
for (const it of persisted.list()) await persisted.retry(it.id); // reconnect: retry now
s = await persisted.process();
check("reconnect: queue synced", s.sent === 3 && persisted.list().length === 0, JSON.stringify(s));
let j = (await api.job(jobId)).data!;
const st = parseStops(j.stops);
check("server: job in_progress, stop 1 completed with the offline times", j.status === "in_progress" && st[0].status === "completed" && new Date(st[0].arrived_at!).getTime() < Date.now() - 14 * 60_000);
check("next stop is stop 2", nextStopIndex(j) === 1 && legsOf(j).filter((l) => l.kind === "stop").length === 3);
// replay the same stop completion (lost response): no change
const again = await api.markStop(jobId, 0, "completed", new Date().toISOString());
check("replayed stop completion is idempotent", !again.error && parseStops(again.data)[0].completed_at === st[0].completed_at);
check("invalid stop index rejected", /STOP_NOT_FOUND/.test((await api.markStop(jobId, 9, "arrived", new Date().toISOString())).error?.message ?? ""));

// ---------------- GPS: offline backlog + geofence arrival at stop 2 ----------------
const gq = new GpsQueue(memKV());
const t0 = Date.now();
await gq.add([
  { lat: 52.28, lng: -0.75, accuracy_m: 12, speed_mps: 20, heading: 60, recorded_at: new Date(t0 - 180_000).toISOString() },
  { lat: 52.295, lng: -0.71, accuracy_m: 10, speed_mps: 15, heading: 60, recorded_at: new Date(t0 - 120_000).toISOString() },
  { lat: 52.3027, lng: -0.6936, accuracy_m: 8, speed_mps: 0, heading: 60, recorded_at: new Date(t0 - 60_000).toISOString() },
]);
const f1 = await gq.flush(flaky(api, { online: false }));
check("GPS offline: points stay queued", !f1.ok && f1.remaining === 3);
const f2 = await gq.flush(api);
check("GPS reconnect: backlog uploaded", f2.ok && f2.remaining === 0);
j = (await api.job(jobId)).data!;
check("geofence: server marked stop 2 arrived from GPS", parseStops(j.stops)[1].status === "arrived");
const { data: gev } = await adminSb.from("geofence_events").select("target, event_type").eq("job_id", jobId);
check("geofence: exactly one arrival event for stop 2", (gev ?? []).filter((e) => e.target === "stop:1" && e.event_type === "arrival").length === 1, JSON.stringify(gev));
await gq.add([{ lat: 52.3027, lng: -0.6936, accuracy_m: 8, recorded_at: new Date(t0 - 60_000).toISOString() }]);
await gq.flush(api);
const { data: gev2 } = await adminSb.from("geofence_events").select("id").eq("job_id", jobId);
check("GPS replay does not duplicate events", (gev2 ?? []).length === (gev ?? []).length);
const { data: pos } = await adminSb.from("driver_positions").select("recorded_at").eq("driver_id", driverId).gte("recorded_at", new Date(t0 - 200_000).toISOString());
check("office sees positions with the phone's timestamps", (pos ?? []).length >= 3);

// finish remaining stops
for (const i of [1, 2]) { await api.markStop(jobId, i, "arrived", new Date().toISOString()); await api.markStop(jobId, i, "completed", new Date().toISOString()); }
j = (await api.job(jobId)).data!;
check("all stops completed → ready for POD", nextStopIndex(j) === null && j.status === "in_progress");

// ---------------- POD (photo + signature), offline then sync ----------------
const podBox = new Outbox(memKV(), { api: flaky(api, net), readFile: async () => JPEG, newId: randomUUID });
const podId = randomUUID();
net.online = false;
await podBox.enqueue({ kind: "complete_job", jobId, photo: { uri: "file:///pod.jpg", bucket: "pod-photos", path: podPhotoPath(org, jobId, podId), contentType: "image/jpeg" },
  signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  recipient: "QA Recipient", notes: "Left at goods in", lat: 52.04, lng: -0.76, capturedAt: new Date(Date.now() - 5 * 60_000).toISOString() }, podId);
await podBox.process();
check("POD saved offline", podBox.list().length === 1 && (await api.job(jobId)).data?.status === "in_progress");
net.online = true; podBox.list()[0].nextAttemptAt = 0;
const ps = await podBox.process();
check("POD synced: photo uploaded then job completed", ps.sent === 1);
j = (await api.job(jobId)).data!;
check("server: completed with photo POD + recipient", j.status === "completed" && j.pod_status === "photo" && j.pod_photo_url === podPhotoPath(org, jobId, podId) && /QA Recipient/.test(j.pod_notes ?? ""));
const signed = await adminSb.storage.from("pod-photos").createSignedUrl(j.pod_photo_url!, 60);
check("office can open the POD photo", !!signed.data?.signedUrl);
const otherSigned = await otherSb.storage.from("pod-photos").createSignedUrl(j.pod_photo_url!, 60);
check("other company cannot open the POD photo", !otherSigned.data?.signedUrl);
const replay = await api.completeJob({ jobId, photoPath: j.pod_photo_url, signature: null, recipient: null, notes: null, lat: null, lng: null, capturedAt: new Date().toISOString() });
check("POD replay is harmless", replay.data?.replayed === true);

// ---------------- INCIDENT / FUEL / VEHICLE CHECK (photos, idempotency) ----------------
const box2 = new Outbox(memKV(), { api, readFile: async () => JPEG, newId: randomUUID });
const incId = randomUUID();
await box2.enqueue({ kind: "incident", type: "breakdown", description: "QA: warning light on", jobId, lat: 52.2, lng: -0.9,
  photos: [{ uri: "file:///i.jpg", bucket: "driver-uploads", path: driverUploadPath(org, driverId, "incident", incId, 0), contentType: "image/jpeg" }],
  occurredAt: new Date().toISOString() }, incId);
const fuelId = randomUUID();
await box2.enqueue({ kind: "fuel", fuelType: "diesel", litres: 180.5, pricePerLitre: 1.449, totalCost: null, mileage: 250123, station: "QA Services",
  lat: 52.2, lng: -0.9, receipt: { uri: "file:///r.jpg", bucket: "driver-uploads", path: driverUploadPath(org, driverId, "fuel", fuelId, 0), contentType: "image/jpeg" },
  filledAt: new Date().toISOString() }, fuelId);
const chkId = randomUUID();
await box2.enqueue({ kind: "vehicle_check", vehicleId: null, odometer: 250100, notes: "QA check",
  items: [{ key: "tyres", status: "pass" }, { key: "brakes", status: "fail", note: "QA: soft pedal" }, { key: "trailer", status: "na" }],
  photos: [{ uri: "file:///c.jpg", bucket: "driver-uploads", path: driverUploadPath(org, driverId, "check", chkId, 0), contentType: "image/jpeg" }],
  lat: 52.2, lng: -0.9, checkedAt: new Date().toISOString() }, chkId);
const s2 = await box2.process();
check("incident + fuel + vehicle check synced", s2.sent === 3, JSON.stringify(s2));
// lost-response replay with the same request ids
const re1 = await api.reportIncident({ requestId: incId, type: "breakdown", description: "dup", jobId, lat: null, lng: null, photos: [], occurredAt: new Date().toISOString() });
const re2 = await api.logFuel({ requestId: fuelId, fuelType: "diesel", litres: 1, pricePerLitre: null, totalCost: null, mileage: null, station: null, lat: null, lng: null, receiptPath: null, filledAt: new Date().toISOString() });
const re3 = await api.submitCheck({ requestId: chkId, items: [{ key: "tyres", status: "pass" }], vehicleId: null, odometer: null, notes: null, photos: [], lat: null, lng: null, checkedAt: new Date().toISOString() });
const { count: incN } = await adminSb.from("incidents").select("id", { count: "exact", head: true }).eq("client_request_id", incId);
const { data: fuelRow } = await adminSb.from("fuel_logs").select("fuel_amount, fuel_cost, price_per_litre, receipt_path, vehicle_id").eq("client_request_id", fuelId).maybeSingle();
const { data: chk } = await adminSb.from("vehicle_checks").select("result, critical_defect, defects_count, photos, vehicle_id").eq("client_request_id", chkId).maybeSingle();
check("replays create no duplicates", !re1.error && !re2.error && re3.data?.replayed === true && incN === 1);
check("fuel: server computed cost, stored receipt + vehicle", Number(fuelRow?.fuel_cost) === 261.54 && !!fuelRow?.receipt_path && !!fuelRow?.vehicle_id, JSON.stringify(fuelRow));
check("vehicle check: server result FAIL + critical (brakes)", chk?.result === "fail" && chk.critical_defect === true && chk.defects_count === 1);
const chkPhoto = await adminSb.storage.from("driver-uploads").createSignedUrl((chk as { photos: string[] }).photos[0], 60);
check("office can open vehicle-check photo", !!chkPhoto.data?.signedUrl);
const { data: otherChecks } = await otherSb.from("vehicle_checks").select("id").eq("client_request_id", chkId);
check("other company cannot see the check", (otherChecks ?? []).length === 0);
const otherPhoto = await otherSb.storage.from("driver-uploads").createSignedUrl((chk as { photos: string[] }).photos[0], 60);
check("other company cannot open driver photos", !otherPhoto.data?.signedUrl);

// ---------------- MESSAGES ----------------
const msgId = randomUUID();
await api.sendMessage({ requestId: msgId, senderId: driverUser.id, organizationId: org, content: "QA: running 10 minutes late" });
await api.sendMessage({ requestId: msgId, senderId: driverUser.id, organizationId: org, content: "QA: running 10 minutes late" });
const { count: mN } = await adminSb.from("messages").select("id", { count: "exact", head: true }).eq("client_request_id", msgId);
check("message send is idempotent (1 row after 2 sends)", mN === 1);
const officeUser = (await adminSb.auth.getUser()).data.user!;
await adminSb.from("messages").insert({ sender_id: officeUser.id, recipient_id: driverUser.id, channel: "dispatch", content: "QA: please call", organization_id: org });
const msgs = (await api.messages()).data ?? [];
const unread = msgs.filter((m) => m.recipient_id === driverUser.id && !m.read);
check("driver receives office message (unread)", unread.length >= 1);
const marked = await api.markMessagesRead(unread.map((m) => m.id));
check("mark read", (marked.data ?? 0) >= 1 && !((await api.messages()).data ?? []).some((m) => m.recipient_id === driverUser.id && !m.read));

// ---------------- SECURITY ----------------
const foreignUpload = await api.upload("driver-uploads", `${randomUUID()}/${driverId}/incident/x.jpg`, JPEG, "image/jpeg");
check("driver cannot upload into another company's folder", !!foreignUpload.error);
const foreignPod = await api.upload("pod-photos", `${org}/999999999/x.jpg`, JPEG, "image/jpeg");
check("driver cannot upload POD for a job that is not theirs", !!foreignPod.error);
const { data: otherJobRow } = await otherSb.from("jobs").select("id").limit(1).maybeSingle();
if (otherJobRow) {
  const r = await api.markStop((otherJobRow as { id: number }).id, 0, "arrived", new Date().toISOString());
  check("driver cannot touch another company's job by id", /JOB_NOT_FOUND/.test(r.error?.message ?? ""));
  const r2 = await api.reportIncident({ requestId: randomUUID(), type: "other", description: "x", jobId: (otherJobRow as { id: number }).id, lat: null, lng: null, photos: [], occurredAt: new Date().toISOString() });
  check("incident cannot reference another company's job", /JOB_NOT_FOUND/.test(r2.error?.message ?? ""));
}
const { data: otherVeh } = await otherSb.from("vehicles").select("id").limit(1).maybeSingle();
if (otherVeh) {
  const r = await api.submitCheck({ requestId: randomUUID(), items: [{ key: "tyres", status: "pass" }], vehicleId: (otherVeh as { id: number }).id, odometer: null, notes: null, photos: [], lat: null, lng: null, checkedAt: new Date().toISOString() });
  check("vehicle check cannot target another company's vehicle", /VEHICLE_NOT_FOUND/.test(r.error?.message ?? ""));
}
const { data: vis } = await driverSb.from("vehicles").select("id");
const { data: usersVis } = await driverSb.from("users").select("id");
check("driver sees only own vehicle / own user row", (vis ?? []).length <= 1 && (usersVis ?? []).length === 1, `vehicles ${(vis ?? []).length}, users ${(usersVis ?? []).length}`);
const forged = await driverSb.from("incidents").insert({ driver_id: 1, incident_type: "other", description: "forged", status: "reported" });
check("driver cannot insert incident for another driver id", !!forged.error);
const badFuel = await api.logFuel({ requestId: randomUUID(), fuelType: "diesel", litres: -5, pricePerLitre: null, totalCost: null, mileage: null, station: null, lat: null, lng: null, receiptPath: null, filledAt: new Date().toISOString() });
check("invalid fuel rejected", /INVALID_LITRES/.test(badFuel.error?.message ?? ""));
const tokenOk = await api.setPushToken(driverId, "not-a-token");
check("invalid push token rejected by constraint", !!tokenOk.error);

console.log(`\n${pass} passed, ${fail} failed · QA job ${ref} (#${jobId})`);
process.exit(fail ? 1 : 0);
