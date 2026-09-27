// Shapes of the MOViDO backend as the driver sees it. Column names and status
// values are the production ones (public.jobs, job_status, pod_status…); the
// driver app does not invent its own status system.

export type JobStatus = "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
export type StopStatus = "pending" | "arrived" | "completed";

export interface Stop {
  address: string;
  lat: number | null;
  lng: number | null;
  status: StopStatus;
  arrived_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  contact?: string | null;
  window?: string | null;
}

export interface Job {
  id: number;
  reference: string;
  customer: string;
  customer_phone: string | null;
  status: JobStatus;
  priority: "low" | "medium" | "high" | "urgent";
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  scheduled_date: string | null;
  eta: string | null;
  completed_at: string | null;
  pod_status: "pending" | "signed" | "photo" | "na" | null;
  pod_photo_url: string | null;
  pod_notes: string | null;
  driver_notes: string | null;
  vehicle_id: number | null;
  organization_id: string;
  stops: unknown;
  updated_at: string;
}

export interface DriverProfile {
  driver: { id: number; name: string; email: string | null; phone: string | null; status: string };
  organization: { id: string; name: string };
  vehicle: {
    id: number; vehicle_id: string; registration: string | null; make: string | null; model: string | null;
    type: string; height: number | null; width: number | null; weight: number | null; length: number | null;
  } | null;
  settings: { gps_interval_seconds: number; gps_distance_metres: number };
}

export interface Message {
  id: number;
  sender_id: string;
  recipient_id: string | null;
  channel: "dispatch" | "driver" | "alert" | "system";
  content: string;
  read: boolean;
  created_at: string;
  organization_id: string;
  client_request_id?: string | null;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  speed_mps?: number | null;
  heading?: number | null;
  recorded_at: string;
}

export type IncidentType =
  | "accident" | "vehicle_damage" | "breakdown" | "traffic_delay" | "customer_issue"
  | "delivery_issue" | "road_closure" | "load_damage" | "near_miss" | "theft" | "other";

export type FuelType = "diesel" | "adblue" | "petrol" | "hvo";

export type CheckKey =
  | "tyres" | "lights" | "brakes" | "mirrors" | "body" | "trailer" | "coupling"
  | "fluids" | "safety_equipment" | "damage" | "other";

export interface CheckItem { key: CheckKey; status: "pass" | "fail" | "na"; note?: string }
