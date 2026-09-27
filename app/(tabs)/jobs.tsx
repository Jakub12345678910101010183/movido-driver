// JOBS — Today / Upcoming / Completed, same statuses as the backend.
import { useRouter } from "expo-router";
import { ListChecks } from "lucide-react-native";
import React, { useState } from "react";
import { Text } from "react-native";
import type { Job } from "../../src/core/types.ts";
import { useApp } from "../../src/state/AppContext";
import { Empty, Screen, Segmented, SyncBar } from "../../src/ui";
import { JobCard } from "../../src/ui/JobCard";
import { colors, type } from "../../src/theme";

type Tab = "today" | "upcoming" | "completed";

export default function Jobs() {
  const router = useRouter();
  const { jobs, pending, jobsLoading, refresh, sync, outboxItems } = useApp();
  const [tab, setTab] = useState<Tab>("today");
  const today = new Date().toISOString().slice(0, 10);

  const lists: Record<Tab, Job[]> = {
    today: jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled" && (!j.scheduled_date || j.scheduled_date <= today)),
    upcoming: jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled" && !!j.scheduled_date && j.scheduled_date > today),
    completed: jobs.filter((j) => j.status === "completed").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
  };
  // In progress first.
  lists.today.sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress"));
  const list = lists[tab];

  return (
    <Screen refreshing={jobsLoading} onRefresh={() => void refresh()}>
      <Text style={type.title}>My jobs</Text>
      <SyncBar sync={sync} pending={outboxItems.filter((i) => i.state === "pending").length} onPress={() => router.push("/sync")} />
      <Segmented label="Show" value={tab} onChange={setTab} options={[
        { value: "today", label: `Today ${lists.today.length}` },
        { value: "upcoming", label: `Upcoming ${lists.upcoming.length}` },
        { value: "completed", label: `Done ${lists.completed.length}` },
      ]} />
      {list.length ? list.map((j) => (
        <JobCard key={j.id} job={j} pending={!!pending.get(j.id)} onPress={() => router.push({ pathname: "/job/[id]", params: { id: String(j.id) } })} />
      )) : (
        <Empty icon={<ListChecks size={40} color={colors.mutedForeground} />}
          title={tab === "completed" ? "Nothing completed in the last 7 days" : tab === "upcoming" ? "No upcoming jobs" : "No jobs for today"}
          body={tab === "today" ? "Pull down to refresh. New jobs from the office also arrive automatically." : undefined} />
      )}
    </Screen>
  );
}
