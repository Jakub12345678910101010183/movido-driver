// ACTIVE JOB — current stop with NAVIGATE / ARRIVE / COMPLETE STOP, the stop
// list, and proof of delivery once every stop is done. Arrival can also come
// from the server's geofence (the job refreshes live).
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertTriangle, CheckCircle2, Circle, CircleDot, Navigation, PackageCheck, Phone, Play } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { legsOf, nextStopIndex, parseStops, readyForPod, type RouteLeg } from "../../src/core/stops.ts";
import { currentPosition, stopFix } from "../../src/services/location";
import { formatClock, formatDistance, formatMinutes, openNavigation, truckRoute, type RouteSummary } from "../../src/services/navigation";
import { useApp } from "../../src/state/AppContext";
import { Banner, Button, Card, Empty, Pill, Row, Screen, Section } from "../../src/ui";
import { BackBar } from "../../src/ui/BackBar";
import { colors, fonts, space, type } from "../../src/theme";

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { jobs, pending, act, profile, online, refresh, jobsLoading } = useApp();
  const job = jobs.find((j) => String(j.id) === id);
  const [busy, setBusy] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteSummary | null>(null);

  const stops = job ? parseStops(job.stops) : [];
  const next = job ? nextStopIndex(job) : null;
  const current = next !== null ? stops[next] : null;
  const marks = job ? pending.get(job.id) : undefined;
  const target = current ?? (job && !stops.length && job.status !== "completed"
    ? job.status === "in_progress" ? { address: job.delivery_address ?? "", lat: job.delivery_lat, lng: job.delivery_lng }
      : { address: job.pickup_address ?? job.delivery_address ?? "", lat: job.pickup_lat ?? job.delivery_lat, lng: job.pickup_lng ?? job.delivery_lng }
    : null);

  useEffect(() => {
    let alive = true;
    setRoute(null);
    if (!target?.lat || !target.lng || !online) return;
    void currentPosition().then((here) => here && truckRoute(here, { lat: target.lat!, lng: target.lng! }, profile?.vehicle ?? null))
      .then((r) => { if (alive && r) setRoute(r); });
    return () => { alive = false; };
  }, [target?.lat, target?.lng, online, profile?.vehicle]);

  if (!job) {
    return (
      <Screen onRefresh={() => void refresh()} refreshing={jobsLoading}>
        <BackBar onBack={() => router.back()} />
        <Empty title="Job not found" body="It may have been reassigned or removed by the office." action={<Button label="Back to jobs" variant="secondary" onPress={() => router.replace("/(tabs)/jobs")} />} />
      </Screen>
    );
  }

  const closed = job.status === "completed" || job.status === "cancelled";
  const run = async (key: string, f: () => Promise<unknown>) => { setBusy(key); try { await f(); } finally { setBusy(null); } };
  // The server confirms the driver is at the stop: send where they are now.
  const markStop = (i: number, status: "arrived" | "completed") =>
    run(`${status}-${i}`, async () => {
      const fix = await stopFix();
      await act({ kind: "mark_stop", jobId: job.id, stopIndex: i, status, at: fix?.at ?? new Date().toISOString(),
        lat: fix?.lat ?? null, lng: fix?.lng ?? null, accuracy_m: fix?.accuracy ?? null });
    });

  const actions = () => {
    if (closed) return null;
    if (job.status !== "in_progress") {
      return <Button label="Start job" size="xl" busy={busy === "start"} icon={<Play size={22} color={colors.primaryForeground} />}
        accessibilityHint="Marks the job in progress and starts sharing your location"
        onPress={() => run("start", () => act({ kind: "start_job", jobId: job.id }))} />;
    }
    if (current && next !== null) {
      return current.status === "arrived"
        ? <Button label={`Complete stop ${next + 1}`} size="xl" variant="success" busy={busy === `completed-${next}`}
            icon={<CheckCircle2 size={22} color={colors.primaryForeground} />} onPress={() => void markStop(next, "completed")} />
        : <Button label={`Arrive at stop ${next + 1}`} size="xl" busy={busy === `arrived-${next}`}
            icon={<CircleDot size={22} color={colors.primaryForeground} />} onPress={() => void markStop(next, "arrived")} />;
    }
    if (readyForPod(job)) {
      return <Button label="Complete delivery (POD)" size="xl" variant="success" icon={<PackageCheck size={22} color={colors.primaryForeground} />}
        onPress={() => router.push({ pathname: "/pod/[id]", params: { id: String(job.id) } })} />;
    }
    return null;
  };

  return (
    <Screen
      onRefresh={() => void refresh()}
      refreshing={jobsLoading}
      footer={!closed ? (
        <>
          {actions()}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {target ? <Button style={{ flex: 1 }} label="Navigate" variant="secondary" icon={<Navigation size={20} color={colors.foreground} />} onPress={() => void openNavigation(target)} /> : null}
            <Button style={{ flex: 1 }} label="Report issue" variant="secondary" icon={<AlertTriangle size={20} color={colors.warning} />}
              onPress={() => router.push({ pathname: "/incident", params: { jobId: String(job.id) } })} />
          </View>
        </>
      ) : undefined}
    >
      <BackBar onBack={() => router.back()} />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.monoBold, fontSize: 20, color: colors.primary }}>{job.reference}</Text>
          <Pill status={job.status} />
        </View>
        <Text style={type.title}>{job.customer}</Text>
        {marks ? <Text style={[type.small, { color: colors.warning }]}>Some updates are saved on this phone and will sync automatically.</Text> : null}
      </View>

      {job.status === "cancelled" ? <Banner tone="danger" title="This job was cancelled by the office" /> : null}
      {job.status === "completed" ? (
        <Banner tone="success" title={`Delivered ${job.completed_at ? formatClock(job.completed_at) : ""}`}
          body={job.pod_status === "photo" ? "Proof of delivery: photo" : job.pod_status === "signed" ? "Proof of delivery: signature" : undefined} />
      ) : null}

      {current && next !== null && job.status === "in_progress" ? (
        <Card tone="primary" accessibilityLabel={`Current stop ${next + 1}: ${current.address}`}>
          <Text style={type.label}>Current stop · {next + 1} of {stops.length}</Text>
          <Text style={type.title}>{current.address}</Text>
          {current.window ? <Row label="Time window" value={current.window} /> : null}
          {current.contact ? <Row label="Contact" value={current.contact} /> : null}
          {current.notes ? <Text style={type.body}>{current.notes}</Text> : null}
          <Pill status={current.status} label={current.status === "arrived" ? `Arrived ${formatClock(current.arrived_at)}` : "On the way"} />
          {route ? <Row label="Distance · ETA" value={`${formatDistance(route.distanceKm)} · ${formatMinutes(route.minutes)} · ${formatClock(route.arrival)}`} /> : null}
          {route?.trafficDelayMin ? <Text style={[type.small, { color: colors.warning }]}>+{route.trafficDelayMin} min traffic delay</Text> : null}
          {next + 1 < stops.length ? <Text style={type.small}>Then: {stops[next + 1].address}</Text> : <Text style={type.small}>Last stop</Text>}
        </Card>
      ) : null}

      {!stops.length && route && !closed ? (
        <Card><Row label={job.status === "in_progress" ? "To delivery" : "To collection"} value={`${formatDistance(route.distanceKm)} · ETA ${formatClock(route.arrival)}`} /></Card>
      ) : null}

      {readyForPod(job) ? <Banner tone="info" title="All stops done" body="Capture proof of delivery to complete the job." /> : null}

      <Section title="Route">
        <Card>
          {legsOf(job).map((leg, i) => <LegRow key={i} leg={leg} isNext={leg.index !== null && leg.index === next && job.status === "in_progress"} pendingSync={leg.index !== null && !!marks?.stops.has(leg.index)} />)}
        </Card>
      </Section>

      <Section title="Details">
        <Card>
          {job.scheduled_date ? <Row label="Scheduled" value={new Date(job.scheduled_date + "T00:00:00").toLocaleDateString("en-GB")} /> : null}
          {profile?.vehicle ? <Row label="Vehicle" value={`${profile.vehicle.vehicle_id}${profile.vehicle.registration ? ` · ${profile.vehicle.registration}` : ""}`} /> : null}
          <Row label="Priority" value={job.priority} />
          {job.driver_notes ? <View style={{ gap: 4 }}><Text style={type.label}>Special instructions</Text><Text style={type.body}>{job.driver_notes}</Text></View> : null}
          {job.customer_phone ? (
            <Button label={`Call ${job.customer_phone}`} variant="ghost" size="md" icon={<Phone size={18} color={colors.foreground} />}
              onPress={() => void Linking.openURL(`tel:${job.customer_phone}`)} />
          ) : null}
        </Card>
      </Section>
      <Text style={[type.small, { textAlign: "center" }]}>Navigation apps are not HGV-aware: always follow road signs and height, width and weight limits.</Text>
    </Screen>
  );
}

function LegRow({ leg, isNext, pendingSync }: { leg: RouteLeg; isNext: boolean; pendingSync: boolean }) {
  const icon = leg.status === "completed" ? <CheckCircle2 size={22} color={colors.success} />
    : leg.status === "arrived" ? <CircleDot size={22} color={colors.primary} /> : <Circle size={22} color={isNext ? colors.primary : colors.mutedForeground} />;
  const when = leg.status === "completed" ? (leg.completed_at ? `Done ${formatClock(leg.completed_at)}` : "Done") : leg.status === "arrived" ? (leg.arrived_at ? `Arrived ${formatClock(leg.arrived_at)}` : "Arrived") : isNext ? "Next" : "Pending";
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 6 }} accessible accessibilityLabel={`${leg.label}, ${leg.address}, ${when}`}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.label, isNext && { color: colors.primary }]}>{leg.label}{leg.window ? ` · ${leg.window}` : ""}</Text>
        <Text style={[type.body, leg.status === "completed" && { color: colors.mutedForeground }]}>{leg.address}</Text>
        <Text style={[type.small, pendingSync && { color: colors.warning }]}>{when}{pendingSync ? " · waiting to sync" : ""}</Text>
      </View>
    </View>
  );
}
