// HOME — useful in 2–3 seconds: who/when, is the office seeing me, today's
// numbers, and the one job to work on now with one big button.
import { useRouter } from "expo-router";
import { AlertTriangle, ClipboardCheck, Fuel, Navigation, Play, Truck } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { nextDestination, stopCounts } from "../../src/core/stops.ts";
import type { Job } from "../../src/core/types.ts";
import { api } from "../../src/lib/supabase";
import { formatClock, formatDistance, formatMinutes, openNavigation, truckRoute, type RouteSummary } from "../../src/services/navigation";
import { currentPosition } from "../../src/services/location";
import { useApp } from "../../src/state/AppContext";
import { Banner, Button, Card, Empty, Logo, Pill, Row, Screen, Section, SyncBar } from "../../src/ui";
import { JobCard, scheduleLabel } from "../../src/ui/JobCard";
import { StatusStrip } from "../../src/ui/StatusStrip";
import { colors, fonts, space, type } from "../../src/theme";
import { dateLocale } from "../../src/i18n/index.ts";
import { useT } from "../../src/i18n/react";

const isToday = (j: Job) => {
  const day = new Date().toISOString().slice(0, 10);
  return j.scheduled_date === day || (j.completed_at ?? "").slice(0, 10) === day || (!j.scheduled_date && j.status !== "completed");
};

export default function Home() {
  const t = useT();
  const router = useRouter();
  const { profile, jobs, pending, jobsLoading, jobsError, refresh, sync, outboxItems, online, act, jobsUpdatedAt, gps } = useApp();
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [lastCheck, setLastCheck] = useState<{ checked_at: string; result: string; critical_defect: boolean } | null | undefined>(undefined);

  const active = jobs.find((j) => j.status === "in_progress")
    ?? jobs.filter((j) => j.status === "assigned" || j.status === "pending").sort((a, b) => (a.scheduled_date ?? "9") < (b.scheduled_date ?? "9") ? -1 : 1)[0];
  const today = jobs.filter(isToday);
  const doneToday = today.filter((j) => j.status === "completed").length;
  const dest = active ? nextDestination(active) : null;
  const pendingCount = outboxItems.filter((i) => i.state === "pending").length;

  useEffect(() => {
    let alive = true;
    setRoute(null);
    if (!dest?.lat || !dest.lng || !online) return;
    void currentPosition().then((here) => here && truckRoute(here, { lat: dest.lat!, lng: dest.lng! }, profile?.vehicle ?? null))
      .then((r) => { if (alive && r) setRoute(r); });
    return () => { alive = false; };
  }, [dest?.lat, dest?.lng, online, profile?.vehicle]);

  useEffect(() => { void api.lastCheck().then((r) => setLastCheck(r.error ? null : r.data)); }, [outboxItems.length]);

  const firstName = profile?.driver.name.split(" ")[0] ?? t("common.driver");
  const checkedToday = lastCheck && new Date(lastCheck.checked_at).toDateString() === new Date().toDateString();

  return (
    <Screen refreshing={jobsLoading} onRefresh={() => void refresh()}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Logo subtitle={t("common.driver")} />
          <Text style={type.small}>{new Date().toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" })}</Text>
        </View>
        <Text style={[type.title, { marginTop: space.md }]}>{t("home.hi", { name: firstName })}</Text>
        <StatusStrip />
      </View>

      <SyncBar sync={sync} pending={pendingCount} onPress={() => router.push("/sync")} />
      {jobsError && !online ? null : jobsError ? <Banner tone="warning" title={t("home.refreshFailed")} body={jobsError} /> : null}
      {!online && jobsUpdatedAt ? <Text style={type.small}>{t("home.showingSavedAt", { time: formatClock(jobsUpdatedAt) })}</Text> : null}
      {gps.permission === "denied" || gps.permission === "services_off" ? (
        <Banner tone="danger" title={t("home.locRequiredTitle")} body={t("home.locRequiredBody")}
          action={<Button label={t("home.fixLocation")} size="md" variant="secondary" onPress={() => router.push("/sync")} />} />
      ) : null}

      <Card>
        <Text style={type.label}>{t("home.todaysJobs")}</Text>
        <View style={{ flexDirection: "row", gap: space.md }}>
          {([["assigned", today.length], ["completed", doneToday], ["remaining", today.length - doneToday]] as const).map(([id, v]) => { const k = t(`home.${id}`); return (
            <View key={id} style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${k}: ${v}`}>
              <Text style={{ fontFamily: fonts.monoBold, fontSize: 30, color: id === "remaining" && Number(v) > 0 ? colors.primary : colors.foreground }}>{v}</Text>
              <Text style={type.small}>{k}</Text>
            </View>
          ); })}
        </View>
      </Card>

      <Section title={active?.status === "in_progress" ? t("home.currentJob") : t("home.nextJob")}>
        {active ? (
          <Card tone="primary">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.monoBold, fontSize: 18, color: colors.primary }}>{active.reference}</Text>
              <Pill status={active.status} />
            </View>
            <Text style={type.title} numberOfLines={2}>{active.customer}</Text>
            {active.pickup_address ? <Row label={t("stop.collection")} value={active.pickup_address} /> : null}
            {active.delivery_address ? <Row label={t("stop.delivery")} value={active.delivery_address} /> : null}
            {stopCounts(active).total ? <Row label={t("home.stops")} value={t("home.stopsDone", { done: stopCounts(active).done, total: stopCounts(active).total })} /> : null}
            <Row label={t("common.scheduled")} value={scheduleLabel(active.scheduled_date)} />
            {profile?.vehicle ? <Row label={t("common.vehicle")} value={`${profile.vehicle.vehicle_id}${profile.vehicle.registration ? ` · ${profile.vehicle.registration}` : ""}`} /> : null}
            {dest ? <Row label={t("home.nextLabel", { label: dest.label })} value={dest.address} /> : null}
            {route ? <Row label={t("common.distanceEta")} value={`${formatDistance(route.distanceKm)} · ${formatClock(route.arrival)}${route.trafficDelayMin ? ` (${t("common.trafficMin", { n: route.trafficDelayMin })})` : ""}`} /> : null}
            {pending.get(active.id) ? <Text style={[type.small, { color: colors.warning }]}>{t("home.savedWaiting")}</Text> : null}
            {active.status === "in_progress" ? (
              <View style={{ gap: space.sm }}>
                <Button label={t("home.continueJob")} size="xl" icon={<Play size={22} color={colors.primaryForeground} />}
                  onPress={() => router.push({ pathname: "/job/[id]", params: { id: String(active.id) } })} />
                {dest ? <Button label={t("common.navigate")} variant="secondary" icon={<Navigation size={20} color={colors.foreground} />} onPress={() => void openNavigation(dest)} /> : null}
              </View>
            ) : (
              <Button label={t("common.startJob")} size="xl" icon={<Play size={22} color={colors.primaryForeground} />}
                accessibilityHint={t("common.startJobHint")}
                onPress={async () => { await act({ kind: "start_job", jobId: active.id }); router.push({ pathname: "/job/[id]", params: { id: String(active.id) } }); }} />
            )}
          </Card>
        ) : (
          <Card><Empty icon={<Truck size={40} color={colors.mutedForeground} />} title={t("home.noActiveTitle")} body={t("home.noActiveBody")} /></Card>
        )}
      </Section>

      {!checkedToday && lastCheck !== undefined ? (
        <Banner tone="warning" title={t("home.checkMissingTitle")} body={t("home.checkMissingBody")}
          action={<Button label={t("home.startCheck")} size="md" onPress={() => router.push("/check")} />} />
      ) : lastCheck?.critical_defect && checkedToday ? (
        <Banner tone="danger" title={t("home.criticalTitle")} body={t("home.criticalBody")} />
      ) : null}

      <Section title={t("home.quickActions")}>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button style={{ flex: 1 }} label={t("home.qCheck")} variant="secondary" size="md" icon={<ClipboardCheck size={20} color={colors.foreground} />} onPress={() => router.push("/check")} />
          <Button style={{ flex: 1 }} label={t("home.qIssue")} variant="secondary" size="md" icon={<AlertTriangle size={20} color={colors.warning} />} onPress={() => router.push({ pathname: "/incident", params: active ? { jobId: String(active.id) } : {} })} />
          <Button style={{ flex: 1 }} label={t("home.qFuel")} variant="secondary" size="md" icon={<Fuel size={20} color={colors.foreground} />} onPress={() => router.push("/fuel")} />
        </View>
      </Section>

      {today.filter((j) => j.id !== active?.id && j.status !== "completed").length ? (
        <Section title={t("home.alsoToday")}>
          {today.filter((j) => j.id !== active?.id && j.status !== "completed").slice(0, 3).map((j) => (
            <JobCard key={j.id} job={j} pending={!!pending.get(j.id)} onPress={() => router.push({ pathname: "/job/[id]", params: { id: String(j.id) } })} />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
