// Offline-first outbox for driver actions.
//
// Every action is saved to device storage before anything is sent, with a
// request id created once. Sending:
//   1. uploads its photos to deterministic paths (a retry after a lost
//      response finds the object already there),
//   2. calls the backend RPC, which is idempotent for the same request id /
//      same stop / same job,
//   3. is removed only after the server confirmed.
// Network and server errors retry with exponential backoff; validation errors
// (the server will never accept it) are kept as "failed" and shown to the
// driver instead of retried forever.
import type { Api } from "./api.ts";
import { describeError, isRetryable, type BackendError } from "./errors.ts";
import type { CheckItem, FuelType, IncidentType } from "./types.ts";

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface LocalFile { uri: string; bucket: "pod-photos" | "driver-uploads"; path: string; contentType: string }

export type OutboxAction =
  | { kind: "start_job"; jobId: number }
  | { kind: "mark_stop"; jobId: number; stopIndex: number; status: "arrived" | "completed"; at: string;
      lat?: number | null; lng?: number | null; accuracy_m?: number | null } // where the driver tapped (fix time = at)
  | { kind: "complete_job"; jobId: number; photo: LocalFile | null; signature: string | null; recipient: string | null;
      notes: string | null; lat: number | null; lng: number | null; capturedAt: string }
  | { kind: "incident"; type: IncidentType; description: string; jobId: number | null; lat: number | null; lng: number | null;
      photos: LocalFile[]; occurredAt: string }
  | { kind: "fuel"; fuelType: FuelType; litres: number; pricePerLitre: number | null; totalCost: number | null;
      mileage: number | null; station: string | null; lat: number | null; lng: number | null; receipt: LocalFile | null; filledAt: string }
  | { kind: "vehicle_check"; items: CheckItem[]; vehicleId: number | null; odometer: number | null; notes: string | null;
      photos: LocalFile[]; lat: number | null; lng: number | null; checkedAt: string }
  | { kind: "message"; content: string; senderId: string; organizationId: string }
  | { kind: "read_messages"; ids: number[] };

export interface OutboxItem {
  id: string; // request id, sent to the server as the idempotency key
  action: OutboxAction;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
  state: "pending" | "failed";
  lastError: string | null;
  uploaded: string[]; // storage paths already confirmed
  result?: unknown;
}

export interface OutboxDeps {
  api: Api;
  readFile(uri: string): Promise<ArrayBuffer>;
  deleteFile?(uri: string): Promise<void>;
  newId(): string;
  now?(): number;
}

export interface ProcessSummary { sent: number; failed: number; waiting: number; offline: boolean }

const KEY = "movido.outbox.v1";
const MAX_BACKOFF_MS = 5 * 60_000;

export function filesOf(a: OutboxAction): LocalFile[] {
  switch (a.kind) {
    case "complete_job": return a.photo ? [a.photo] : [];
    case "incident": case "vehicle_check": return a.photos;
    case "fuel": return a.receipt ? [a.receipt] : [];
    default: return [];
  }
}

/** The job whose stop order an action depends on, or null. */
function jobOf(a: OutboxAction): number | null {
  return a.kind === "start_job" || a.kind === "mark_stop" || a.kind === "complete_job" ? a.jobId : null;
}

export class Outbox {
  private items: OutboxItem[] = [];
  private loaded = false;
  private running: Promise<ProcessSummary> | null = null;
  private listeners = new Set<(items: OutboxItem[]) => void>();

  private kv: KV;
  private deps: OutboxDeps;
  constructor(kv: KV, deps: OutboxDeps) { this.kv = kv; this.deps = deps; }

  private now() { return this.deps.now ? this.deps.now() : Date.now(); }

  async load(): Promise<OutboxItem[]> {
    if (!this.loaded) {
      try { this.items = JSON.parse((await this.kv.get(KEY)) ?? "[]"); } catch { this.items = []; }
      this.loaded = true;
    }
    return this.items;
  }

  list(): OutboxItem[] { return [...this.items]; }

  subscribe(fn: (items: OutboxItem[]) => void): () => void {
    this.listeners.add(fn);
    fn(this.list());
    return () => { this.listeners.delete(fn); };
  }

  private async save() {
    await this.kv.set(KEY, JSON.stringify(this.items));
    const snapshot = this.list();
    this.listeners.forEach((fn) => fn(snapshot));
  }

  /** Persist an action. It is on the device before this resolves. */
  async enqueue(action: OutboxAction, id = this.deps.newId()): Promise<OutboxItem> {
    await this.load();
    const item: OutboxItem = { id, action, createdAt: new Date(this.now()).toISOString(), attempts: 0,
      nextAttemptAt: 0, state: "pending", lastError: null, uploaded: [] };
    this.items.push(item);
    await this.save();
    return item;
  }

  async retry(id: string) {
    await this.load();
    const it = this.items.find((i) => i.id === id);
    if (it) { it.state = "pending"; it.nextAttemptAt = 0; it.lastError = null; await this.save(); }
  }

  async discard(id: string) {
    await this.load();
    const it = this.items.find((i) => i.id === id);
    if (!it) return;
    this.items = this.items.filter((i) => i.id !== id);
    await this.save();
    for (const f of filesOf(it.action)) await this.deps.deleteFile?.(f.uri).catch(() => {});
  }

  /** Earliest time a waiting item may be retried (for scheduling), or null. */
  nextRetryAt(): number | null {
    const waiting = this.items.filter((i) => i.state === "pending").map((i) => i.nextAttemptAt);
    return waiting.length ? Math.min(...waiting) : null;
  }

  process(): Promise<ProcessSummary> {
    if (!this.running) this.running = this.run().finally(() => { this.running = null; });
    return this.running;
  }

  private async run(): Promise<ProcessSummary> {
    await this.load();
    const summary: ProcessSummary = { sent: 0, failed: 0, waiting: 0, offline: false };
    // In order: a stop must reach the server before the next stop and before
    // the job's completion (the server refuses them out of order), so a job
    // action that is waiting holds back that job's later actions.
    const heldJobs = new Set<number>();
    for (const item of [...this.items]) {
      if (item.state !== "pending") continue;
      const job = jobOf(item.action);
      if (item.nextAttemptAt > this.now() || (job !== null && heldJobs.has(job))) {
        if (job !== null) heldJobs.add(job);
        summary.waiting++;
        continue;
      }
      const err = await this.send(item);
      if (!err) {
        this.items = this.items.filter((i) => i.id !== item.id);
        summary.sent++;
        await this.save();
        for (const f of filesOf(item.action)) await this.deps.deleteFile?.(f.uri).catch(() => {});
        continue;
      }
      item.attempts++;
      item.lastError = describeError(err);
      if (isRetryable(err)) {
        item.nextAttemptAt = this.now() + Math.min(MAX_BACKOFF_MS, 5_000 * 2 ** Math.min(item.attempts - 1, 10));
        summary.waiting++;
        summary.offline = true;
        await this.save();
        break; // the connection is the likely cause: do not hammer the rest
      }
      item.state = "failed";
      summary.failed++;
      await this.save();
    }
    return summary;
  }

  private async uploadFiles(item: OutboxItem): Promise<BackendError | null> {
    for (const f of filesOf(item.action)) {
      if (item.uploaded.includes(f.path)) continue;
      let bytes: ArrayBuffer;
      try { bytes = await this.deps.readFile(f.uri); } catch {
        return { code: "MV400", message: "PHOTO_MISSING: the photo is no longer on this phone" };
      }
      // An empty file (failed save, full storage) must never be stored as the
      // photo, least of all as proof of delivery: fail, do not retry, retake.
      if (!bytes || bytes.byteLength === 0) return { code: "MV400", message: "EMPTY_PHOTO" };
      const r = await this.deps.api.upload(f.bucket, f.path, bytes, f.contentType);
      if (r.error) return r.error;
      item.uploaded.push(f.path);
      await this.save();
    }
    return null;
  }

  private async send(item: OutboxItem): Promise<BackendError | null> {
    const upErr = await this.uploadFiles(item);
    if (upErr) return upErr;
    const a = item.action;
    const { api } = this.deps;
    let r: { error: BackendError | null; data?: unknown };
    switch (a.kind) {
      case "start_job": r = await api.startJob(a.jobId); break;
      case "mark_stop": r = await api.markStop(a.jobId, a.stopIndex, a.status, a.at, a.lat ?? null, a.lng ?? null, a.accuracy_m ?? null); break;
      case "complete_job":
        r = await api.completeJob({ jobId: a.jobId, photoPath: a.photo?.path ?? null, signature: a.signature,
          recipient: a.recipient, notes: a.notes, lat: a.lat, lng: a.lng, capturedAt: a.capturedAt });
        break;
      case "incident":
        r = await api.reportIncident({ requestId: item.id, type: a.type, description: a.description, jobId: a.jobId,
          lat: a.lat, lng: a.lng, photos: a.photos.map((p) => p.path), occurredAt: a.occurredAt });
        break;
      case "fuel":
        r = await api.logFuel({ requestId: item.id, fuelType: a.fuelType, litres: a.litres, pricePerLitre: a.pricePerLitre,
          totalCost: a.totalCost, mileage: a.mileage, station: a.station, lat: a.lat, lng: a.lng,
          receiptPath: a.receipt?.path ?? null, filledAt: a.filledAt });
        break;
      case "vehicle_check":
        r = await api.submitCheck({ requestId: item.id, items: a.items, vehicleId: a.vehicleId, odometer: a.odometer,
          notes: a.notes, photos: a.photos.map((p) => p.path), lat: a.lat, lng: a.lng, checkedAt: a.checkedAt });
        break;
      case "message":
        r = await api.sendMessage({ requestId: item.id, senderId: a.senderId, organizationId: a.organizationId, content: a.content });
        break;
      case "read_messages": r = await api.markMessagesRead(a.ids); break;
    }
    item.result = r.data;
    // A replayed "delivered" (response lost after the server saved it) or an
    // arrival for a stop already delivered: the stop is already past this action.
    if (a.kind === "mark_stop" && r.error?.message?.includes("STOP_ALREADY_COMPLETED")) return null;
    return r.error;
  }
}

/** Storage paths for an action's photos, fixed at capture time. */
export function podPhotoPath(orgId: string, jobId: number, requestId: string): string {
  return `${orgId}/${jobId}/${requestId}.jpg`;
}
export function driverUploadPath(orgId: string, driverId: number, kind: "incident" | "fuel" | "check", requestId: string, n: number): string {
  return `${orgId}/${driverId}/${kind}/${requestId}-${n}.jpg`;
}
