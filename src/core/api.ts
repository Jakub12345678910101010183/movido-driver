// Every backend call the driver app makes. Reads go through RLS (the backend
// only returns this driver's rows); writes go through the driver_* RPCs, which
// take driver, company and vehicle from the session, never from the client.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BackendError } from "./errors.ts";
import type { CheckItem, DriverProfile, FuelType, GpsPoint, IncidentType, Job, Message } from "./types.ts";

export type Result<T> = { data: T; error: null } | { data: null; error: BackendError };

function wrap<T>(data: T | null, error: { code?: string; message?: string; status?: number } | null): Result<T> {
  if (error) return { data: null, error: { code: error.code, message: error.message, status: (error as { status?: number }).status } };
  return { data: data as T, error: null };
}

export const JOB_COLUMNS =
  "id, reference, customer, customer_phone, status, priority, pickup_address, pickup_lat, pickup_lng, " +
  "delivery_address, delivery_lat, delivery_lng, scheduled_date, eta, completed_at, pod_status, pod_photo_url, " +
  "pod_notes, driver_notes, vehicle_id, organization_id, stops, updated_at";

export function createApi(sb: SupabaseClient) {
  return {
    async profile(): Promise<Result<DriverProfile>> {
      const { data, error } = await sb.rpc("driver_profile");
      return wrap(data as DriverProfile, error);
    },

    /** The signed-in user's role: 'driver', 'disabled', 'pending', or an office role. */
    async role(userId: string): Promise<Result<string | null>> {
      const { data, error } = await sb.from("users").select("role").eq("id", userId).maybeSingle();
      return wrap((data as { role?: string } | null)?.role ?? null, error);
    },

    /** Open jobs plus everything completed in the last 7 days. */
    async jobs(): Promise<Result<Job[]>> {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data, error } = await sb.from("jobs").select(JOB_COLUMNS)
        .or(`status.in.(pending,assigned,in_progress),completed_at.gte.${since}`)
        .order("scheduled_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(200);
      return wrap((data ?? []) as unknown as Job[], error);
    },

    async job(id: number): Promise<Result<Job | null>> {
      const { data, error } = await sb.from("jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle();
      return wrap((data ?? null) as unknown as Job | null, error);
    },

    async startJob(jobId: number): Promise<Result<string>> {
      const { data, error } = await sb.rpc("driver_start_job", { p_job_id: jobId });
      return wrap(data as string, error);
    },

    async markStop(jobId: number, stopIndex: number, status: "arrived" | "completed", at: string,
      lat: number | null = null, lng: number | null = null, accuracy: number | null = null): Promise<Result<unknown>> {
      const { data, error } = await sb.rpc("driver_mark_stop", { p_job_id: jobId, p_stop_index: stopIndex, p_status: status, p_at: at,
        p_lat: lat, p_lng: lng, p_accuracy_m: accuracy });
      return wrap(data, error);
    },

    async completeJob(input: {
      jobId: number; photoPath: string | null; signature: string | null; recipient: string | null;
      notes: string | null; lat: number | null; lng: number | null; capturedAt: string;
    }): Promise<Result<{ status: string; replayed: boolean }>> {
      const { data, error } = await sb.rpc("driver_complete_job", {
        p_job_id: input.jobId, p_photo_path: input.photoPath, p_signature: input.signature,
        p_recipient: input.recipient, p_notes: input.notes, p_lat: input.lat, p_lng: input.lng,
        p_captured_at: input.capturedAt,
      });
      return wrap(data as { status: string; replayed: boolean }, error);
    },

    async reportLocations(points: GpsPoint[]): Promise<Result<{ stored: number; latest_at: string | null }>> {
      const { data, error } = await sb.rpc("driver_report_locations", { p_points: points });
      return wrap(data as { stored: number; latest_at: string | null }, error);
    },

    async reportIncident(input: {
      requestId: string; type: IncidentType; description: string; jobId: number | null;
      lat: number | null; lng: number | null; photos: string[]; occurredAt: string;
    }): Promise<Result<number>> {
      const { data, error } = await sb.rpc("driver_report_incident", {
        p_request_id: input.requestId, p_type: input.type, p_description: input.description,
        p_job_id: input.jobId, p_lat: input.lat, p_lng: input.lng, p_photos: input.photos,
        p_occurred_at: input.occurredAt,
      });
      return wrap(data as number, error);
    },

    async logFuel(input: {
      requestId: string; fuelType: FuelType; litres: number; pricePerLitre: number | null; totalCost: number | null;
      mileage: number | null; station: string | null; lat: number | null; lng: number | null;
      receiptPath: string | null; filledAt: string;
    }): Promise<Result<number>> {
      const { data, error } = await sb.rpc("driver_log_fuel", {
        p_request_id: input.requestId, p_fuel_type: input.fuelType, p_litres: input.litres,
        p_price_per_litre: input.pricePerLitre, p_total_cost: input.totalCost, p_mileage: input.mileage,
        p_station: input.station, p_lat: input.lat, p_lng: input.lng, p_receipt_path: input.receiptPath,
        p_filled_at: input.filledAt,
      });
      return wrap(data as number, error);
    },

    async submitCheck(input: {
      requestId: string; items: CheckItem[]; vehicleId: number | null; odometer: number | null;
      notes: string | null; photos: string[]; lat: number | null; lng: number | null; checkedAt: string;
    }): Promise<Result<{ id: string; result: "pass" | "fail"; critical_defect: boolean; replayed: boolean }>> {
      const { data, error } = await sb.rpc("driver_submit_vehicle_check", {
        p_request_id: input.requestId, p_items: input.items, p_vehicle_id: input.vehicleId,
        p_odometer: input.odometer, p_notes: input.notes, p_photos: input.photos,
        p_lat: input.lat, p_lng: input.lng, p_checked_at: input.checkedAt,
      });
      return wrap(data as { id: string; result: "pass" | "fail"; critical_defect: boolean; replayed: boolean }, error);
    },

    async lastCheck(): Promise<Result<{ checked_at: string; result: string; critical_defect: boolean } | null>> {
      const { data, error } = await sb.from("vehicle_checks").select("checked_at, result, critical_defect")
        .order("checked_at", { ascending: false }).limit(1).maybeSingle();
      return wrap(data as { checked_at: string; result: string; critical_defect: boolean } | null, error);
    },

    /** The driver's conversation with the office, including broadcasts (RLS-scoped). */
    async messages(): Promise<Result<Message[]>> {
      const { data, error } = await sb.from("messages")
        .select("id, sender_id, recipient_id, channel, content, read, created_at, organization_id, client_request_id")
        .order("created_at", { ascending: false }).limit(100);
      return wrap(((data ?? []) as Message[]).reverse(), error);
    },

    /** Idempotent send: a replay with the same request id is ignored by the database. */
    async sendMessage(input: { requestId: string; senderId: string; organizationId: string; content: string }): Promise<Result<null>> {
      const { error } = await sb.from("messages").upsert({
        client_request_id: input.requestId, sender_id: input.senderId, recipient_id: "dispatch",
        channel: "driver", content: input.content, organization_id: input.organizationId,
      }, { onConflict: "client_request_id", ignoreDuplicates: true });
      return wrap(null, error);
    },

    async markMessagesRead(ids: number[]): Promise<Result<number>> {
      const { data, error } = await sb.rpc("driver_mark_messages_read", { p_ids: ids });
      return wrap(data as number, error);
    },

    async setPushToken(driverId: number, token: string | null): Promise<Result<null>> {
      const { error } = await sb.from("drivers").update({ push_token: token }).eq("id", driverId);
      return wrap(null, error);
    },

    /** Upload bytes to a private bucket. An object already stored (a retry) counts as success. */
    async upload(bucket: "pod-photos" | "driver-uploads", path: string, bytes: ArrayBuffer, contentType: string): Promise<Result<null>> {
      const { error } = await sb.storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
      if (error && /already exists|duplicate|resource already/i.test(error.message)) return { data: null, error: null };
      return wrap(null, error ? { message: error.message, status: (error as { statusCode?: string }).statusCode ? Number((error as { statusCode?: string }).statusCode) : undefined } : null);
    },
  };
}

export type Api = ReturnType<typeof createApi>;
