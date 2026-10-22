// What the driver sees = server state + their own actions still waiting in the
// outbox, each marked as pending so nothing pretends the server has it yet.
import type { OutboxItem } from "./outbox.ts";
import { parseStops } from "./stops.ts";
import type { Job } from "./types.ts";

export interface PendingMarks { job: boolean; stops: Set<number>; completing: boolean }

export function applyPending(jobs: Job[], items: OutboxItem[]): { jobs: Job[]; pending: Map<number, PendingMarks> } {
  const pending = new Map<number, PendingMarks>();
  const mark = (id: number) => {
    let p = pending.get(id);
    if (!p) { p = { job: false, stops: new Set(), completing: false }; pending.set(id, p); }
    return p;
  };
  const byId = new Map(jobs.map((j) => [j.id, { ...j }]));
  for (const it of items) {
    if (it.state !== "pending") continue;
    const a = it.action;
    if (a.kind === "start_job") {
      const j = byId.get(a.jobId);
      if (j && (j.status === "pending" || j.status === "assigned")) { j.status = "in_progress"; mark(j.id).job = true; }
    } else if (a.kind === "mark_stop") {
      const j = byId.get(a.jobId);
      if (!j) continue;
      const stops = parseStops(j.stops);
      const s = stops[a.stopIndex];
      if (!s) continue;
      if (a.status === "arrived" && s.status === "pending") stops[a.stopIndex] = { ...s, status: "arrived", arrived_at: a.at };
      if (a.status === "completed" && s.status !== "completed") stops[a.stopIndex] = { ...s, status: "completed", completed_at: a.at, arrived_at: s.arrived_at ?? a.at };
      j.stops = stops;
      if (j.status === "pending" || j.status === "assigned") j.status = "in_progress";
      mark(j.id).stops.add(a.stopIndex);
    } else if (a.kind === "complete_job") {
      const j = byId.get(a.jobId);
      if (j && j.status !== "completed") { j.status = "completed"; j.completed_at = a.capturedAt; mark(j.id).completing = true; }
    }
  }
  return { jobs: jobs.map((j) => byId.get(j.id)!), pending };
}
