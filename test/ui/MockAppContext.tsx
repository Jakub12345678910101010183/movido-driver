// UI-test double for src/state/AppContext (web layout tests only; aliased in
// metro.config.js when MOVIDO_UI_TEST=1). Same interface, fixed fixture data
// shaped like production rows. ?mock=offline | empty | login | disabled
import React, { createContext, useContext } from "react";
import type { OutboxItem } from "../../src/core/outbox.ts";
import { applyPending } from "../../src/core/overlay.ts";
import type { DriverProfile, Job, Message } from "../../src/core/types.ts";

const mode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("mock") ?? "" : "";
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const profile: DriverProfile = {
  driver: { id: 8, name: "Sam Whitfield", email: "sam.whitfield@example.co.uk", phone: "07700 900123", status: "on_duty" },
  organization: { id: "org-1", name: "Northampton Haulage Ltd" },
  vehicle: { id: 10, vehicle_id: "HGV-07", registration: "NX71 KTB", make: "DAF", model: "XF 480", type: "hgv", height: 4.0, width: 2.55, weight: 44, length: 16.5 },
  settings: { gps_interval_seconds: 60, gps_distance_metres: 100 },
};

const base = { customer_phone: "01604 555010", eta: null, completed_at: null, pod_status: "pending", pod_photo_url: null, pod_notes: null,
  vehicle_id: 10, organization_id: "org-1", updated_at: ago(3) } as const;

const jobs: Job[] = mode === "empty" ? [] : [
  { ...base, id: 101, reference: "JOB-2026-114", customer: "Tesco Distribution Daventry", status: "in_progress", priority: "high",
    pickup_address: "Brackmills Industrial Estate, Northampton NN4 7PB", pickup_lat: 52.215, pickup_lng: -0.86,
    delivery_address: "DIRFT, Daventry NN6 7GX", delivery_lat: 52.33, delivery_lng: -1.2, scheduled_date: today,
    driver_notes: "Book in at gatehouse, bay 14. Driver must wear hi-vis and safety boots.",
    stops: [
      { address: "Weedon Road, Northampton NN5 5BQ", lat: 52.236, lng: -0.93, status: "completed", arrived_at: ago(95), completed_at: ago(80) },
      { address: "Crick Lodge, Crick NN6 7SH", lat: 52.35, lng: -1.13, status: "arrived", arrived_at: ago(6), window: "10:00–11:00", contact: "Goods-in 01788 555222" },
      { address: "DIRFT, Daventry NN6 7GX", lat: 52.33, lng: -1.2, status: "pending", window: "12:00–13:00" },
    ] },
  { ...base, id: 102, reference: "JOB-2026-115", customer: "Wickes Distribution", status: "assigned", priority: "medium",
    pickup_address: "Moulton Park, Northampton NN3 6RT", pickup_lat: 52.27, pickup_lng: -0.87,
    delivery_address: "Magna Park, Lutterworth LE17 4XN", delivery_lat: 52.44, delivery_lng: -1.2, scheduled_date: today, driver_notes: null, stops: [] },
  { ...base, id: 103, reference: "JOB-2026-120", customer: "Screwfix Trade Counter", status: "assigned", priority: "low",
    pickup_address: "Crossley Park, Northampton NN4 7RE", pickup_lat: 52.21, pickup_lng: -0.89,
    delivery_address: "Wellingborough NN8 4BH", delivery_lat: 52.3, delivery_lng: -0.69, scheduled_date: tomorrow, driver_notes: null, stops: [] },
  { ...base, id: 99, reference: "JOB-2026-109", customer: "B&Q Warehouse", status: "completed", priority: "medium", pod_status: "photo",
    pickup_address: "Swan Valley, Northampton", pickup_lat: 52.2, pickup_lng: -0.95, delivery_address: "Milton Keynes MK1 1BA",
    delivery_lat: 52.04, delivery_lng: -0.76, scheduled_date: today, completed_at: ago(200), driver_notes: null, stops: [] },
];

const messages: Message[] = mode === "empty" ? [] : [
  { id: 1, sender_id: "office", recipient_id: "broadcast", channel: "alert", content: "M1 J15–J16 closed northbound until 14:00. Use A45 / A5.", read: true, created_at: ago(140), organization_id: "org-1" },
  { id: 2, sender_id: "office", recipient_id: "driver-user", channel: "dispatch", content: "Crick want you at bay 3 not bay 14 today.", read: false, created_at: ago(12), organization_id: "org-1" },
  { id: 3, sender_id: "driver-user", recipient_id: "dispatch", channel: "driver", content: "Arrived at Crick, waiting to tip.", read: true, created_at: ago(5), organization_id: "org-1" },
];

const outboxItems: OutboxItem[] = mode === "offline" ? [
  { id: "a1", action: { kind: "mark_stop", jobId: 101, stopIndex: 1, status: "completed", at: ago(1) }, createdAt: ago(1), attempts: 2, nextAttemptAt: Date.now() + 20_000, state: "pending", lastError: "No connection. It will be sent when you are back online.", uploaded: [] },
  { id: "a2", action: { kind: "fuel", fuelType: "diesel", litres: 312.4, pricePerLitre: 1.459, totalCost: null, mileage: 250100, station: "Watford Gap", lat: null, lng: null, receipt: null, filledAt: ago(30) }, createdAt: ago(30), attempts: 1, nextAttemptAt: Date.now() + 60_000, state: "pending", lastError: null, uploaded: [] },
] : [];

const overlay = applyPending(jobs, outboxItems);
const auth = mode === "login" ? "signed_out" : mode === "disabled" ? "disabled" : "ready";
const offline = mode === "offline";
const noop = async () => {};

const value = {
  auth, authMessage: null, session: { user: { id: "driver-user", email: profile.driver.email } },
  profile: auth === "ready" ? profile : null, jobs: overlay.jobs, pending: overlay.pending, jobsLoading: false, jobsError: null, jobsUpdatedAt: ago(4),
  messages, unread: messages.filter((m) => !m.read && m.recipient_id === "driver-user").length, online: !offline,
  sync: offline ? "offline" : "online", outboxItems,
  gps: { lastSentAt: offline ? ago(9) : ago(1), lastFixAt: ago(0), queued: offline ? 7 : 0, lastError: null, tracking: true, permission: "granted_always" },
  push: "registered",
  signIn: async () => null, signOut: noop, refresh: noop, refreshMessages: noop, act: async () => outboxItems[0], syncNow: noop, refreshGps: noop, enablePush: noop,
};

const Ctx = createContext(value);
export const useApp = () => useContext(Ctx) as never as typeof value & Record<string, never>;
export function AppProvider({ children }: { children: React.ReactNode }) { return <Ctx.Provider value={value}>{children}</Ctx.Provider>; }
