// The app-wide outbox and GPS queue, bound to device storage and the backend.
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import * as FS from "expo-file-system/legacy";
import { GpsQueue } from "../core/gpsQueue.ts";
import { Outbox } from "../core/outbox.ts";
import { api } from "../lib/supabase";
import { kv } from "../lib/storage";

export const newId = () => Crypto.randomUUID();

export const outbox = new Outbox(kv, {
  api,
  newId,
  readFile: (uri) => new File(uri).arrayBuffer(),
  deleteFile: (uri) => FS.deleteAsync(uri, { idempotent: true }),
});

export const gpsQueue = new GpsQueue(kv);

let timer: ReturnType<typeof setTimeout> | null = null;

/** Send what can be sent now; schedule the next retry by the queue's backoff. */
export async function syncNow(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  try {
    await outbox.process();
    await gpsQueue.flush(api);
  } finally {
    const next = outbox.nextRetryAt();
    if (next !== null) timer = setTimeout(() => { void syncNow(); }, Math.max(1_000, next - Date.now()));
  }
}
