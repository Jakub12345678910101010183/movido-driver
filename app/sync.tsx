// SYNC & LOCATION — what is waiting on this phone, what failed and why,
// and location permission with the steps to fix it.
import { useRouter } from "expo-router";
import { MapPin, RefreshCw, Trash2 } from "lucide-react-native";
import React from "react";
import { Alert, Linking, Text, View } from "react-native";
import type { OutboxItem } from "../src/core/outbox.ts";
import { requestPermissions } from "../src/services/location";
import { formatClock } from "../src/services/navigation";
import { outbox } from "../src/services/sync";
import { useApp } from "../src/state/AppContext";
import { Banner, Button, Card, Empty, Pill, Row, Screen, Section } from "../src/ui";
import { BackBar } from "../src/ui/BackBar";
import { colors, space, type } from "../src/theme";

const describe = (i: OutboxItem): string => {
  const a = i.action;
  switch (a.kind) {
    case "start_job": return "Start job";
    case "mark_stop": return `Stop ${a.stopIndex + 1} ${a.status === "arrived" ? "arrival" : "completed"}`;
    case "complete_job": return `Proof of delivery${a.photo ? " (photo)" : ""}${a.signature ? " (signature)" : ""}`;
    case "incident": return `Issue report (${a.type.replace("_", " ")})`;
    case "fuel": return `Fuel ${a.litres} L`;
    case "vehicle_check": return "Vehicle check";
    case "message": return "Message to office";
    case "read_messages": return "Messages read";
  }
};

export default function Sync() {
  const router = useRouter();
  const { outboxItems, online, syncNow, gps, refreshGps, sync } = useApp();

  const fixLocation = async () => {
    const r = await requestPermissions();
    if (r !== "granted_always") {
      Alert.alert("Allow location all the time", "Open Settings → Location and choose \"Always\" (iPhone) or \"Allow all the time\" (Android), so arrivals are recorded while the phone is locked or navigating.",
        [{ text: "Later", style: "cancel" }, { text: "Open Settings", onPress: () => void Linking.openSettings() }]);
    }
    await refreshGps();
  };

  return (
    <Screen>
      <BackBar onBack={() => router.back()} title="Sync & location" />
      <Card>
        <Row label="Connection" value={<Pill label={online ? "Online" : "Offline"} tone={online ? "success" : "warning"} />} />
        <Row label="Sync" value={<Pill label={{ online: "Up to date", offline: "Waiting for signal", syncing: "Syncing", error: "Needs attention" }[sync]} tone={sync === "error" ? "danger" : sync === "online" ? "success" : "warning"} />} />
        <Button label="Sync now" variant="secondary" size="md" disabled={!online} icon={<RefreshCw size={18} color={colors.foreground} />} onPress={() => void syncNow()} />
      </Card>

      <Section title="Location">
        <Card>
          <Row label="Sharing" value={gps.tracking ? "Active (job in progress)" : "Paused"} />
          <Row label="Permission" value={gps.permission === "granted_always" ? "Always" : gps.permission === "granted_foreground" ? "While using the app" : gps.permission ?? "—"} />
          <Row label="Last position sent" value={formatClock(gps.lastSentAt)} mono />
          <Row label="Waiting to send" value={String(gps.queued)} mono />
          {gps.permission !== "granted_always" ? (
            <Button label={gps.permission === "granted_foreground" ? "Allow location all the time" : "Allow location"} icon={<MapPin size={20} color={colors.primaryForeground} />} onPress={() => void fixLocation()} />
          ) : null}
          <Text style={type.small}>Location is only shared while you have a job in progress. It goes to your company, not to navigation providers.</Text>
        </Card>
      </Section>

      <Section title={`On this phone (${outboxItems.length})`}>
        {outboxItems.length ? outboxItems.map((i) => (
          <Card key={i.id} tone={i.state === "failed" ? "danger" : undefined}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Text style={[type.bodyStrong, { flex: 1 }]}>{describe(i)}</Text>
              <Pill label={i.state === "failed" ? "Failed" : "Waiting"} tone={i.state === "failed" ? "danger" : "warning"} />
            </View>
            <Text style={type.small}>Saved {formatClock(i.createdAt)}{i.attempts ? ` · ${i.attempts} attempt${i.attempts === 1 ? "" : "s"}` : ""}</Text>
            {i.lastError ? <Text style={[type.small, { color: i.state === "failed" ? colors.destructive : colors.warning }]}>{i.lastError}</Text> : null}
            {i.state === "failed" ? (
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Button style={{ flex: 1 }} label="Try again" size="md" variant="secondary" onPress={() => void outbox.retry(i.id).then(syncNow)} />
                <Button style={{ flex: 1 }} label="Delete" size="md" variant="ghost" icon={<Trash2 size={16} color={colors.destructive} />}
                  onPress={() => Alert.alert("Delete this update?", "It will not reach the office.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void outbox.discard(i.id) }])} />
              </View>
            ) : null}
          </Card>
        )) : <Empty title="Everything is synced" body="Nothing is waiting on this phone." />}
      </Section>
      {outboxItems.some((i) => i.state === "failed") ? (
        <Banner tone="danger" title="Some updates were rejected" body="Read the reason on each one. If it is still wrong after trying again, tell the office." />
      ) : null}
    </Screen>
  );
}
