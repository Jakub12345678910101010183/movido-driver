// REPORT ISSUE — type, description, photos, location and time. Serious types
// are highlighted; the app does not contact emergency services itself.
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { driverUploadPath } from "../src/core/outbox.ts";
import type { IncidentType } from "../src/core/types.ts";
import { currentPosition } from "../src/services/location";
import { newId } from "../src/services/sync";
import { useApp } from "../src/state/AppContext";
import { Banner, Button, Card, Field, Screen } from "../src/ui";
import { BackBar } from "../src/ui/BackBar";
import { PhotoField } from "../src/ui/PhotoField";
import { colors, fonts, radius, space, TOUCH, type } from "../src/theme";

const TYPES: { value: IncidentType; label: string; serious?: boolean }[] = [
  { value: "accident", label: "Accident", serious: true },
  { value: "vehicle_damage", label: "Vehicle damage" },
  { value: "breakdown", label: "Breakdown", serious: true },
  { value: "traffic_delay", label: "Traffic delay" },
  { value: "customer_issue", label: "Customer issue" },
  { value: "delivery_issue", label: "Delivery issue" },
  { value: "road_closure", label: "Road closure" },
  { value: "load_damage", label: "Load damage" },
  { value: "theft", label: "Theft", serious: true },
  { value: "other", label: "Other" },
];

export default function Incident() {
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const router = useRouter();
  const { profile, act, online, jobs } = useApp();
  const job = jobs.find((j) => String(j.id) === jobId);
  const [kind, setKind] = useState<IncidentType | null>(null);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const serious = TYPES.find((t) => t.value === kind)?.serious;

  if (done) {
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: space.lg, paddingTop: space.xxl * 2 }}>
          <CheckCircle2 size={72} color={colors.success} />
          <Text style={[type.display, { textAlign: "center" }]}>Issue reported</Text>
          <Text style={[type.body, { textAlign: "center", color: colors.mutedForeground }]}>{online ? "The office has been sent your report." : "Saved offline — it will sync automatically."}</Text>
        </View>
        <Button label="Done" size="xl" onPress={() => router.back()} />
      </Screen>
    );
  }

  const submit = async () => {
    if (!kind) { Alert.alert("Choose the type", "What kind of issue is it?"); return; }
    if (!text.trim()) { Alert.alert("Describe what happened", "A short description helps the office act quickly."); return; }
    if (!profile) return;
    setBusy(true);
    const requestId = newId();
    const pos = await currentPosition();
    await act({
      kind: "incident", type: kind, description: text.trim(), jobId: job?.id ?? null, lat: pos?.lat ?? null, lng: pos?.lng ?? null,
      photos: photos.map((uri, n) => ({ uri, bucket: "driver-uploads", path: driverUploadPath(profile.organization.id, profile.driver.id, "incident", requestId, n), contentType: "image/jpeg" })),
      occurredAt: new Date().toISOString(),
    }, requestId);
    setBusy(false);
    setDone(true);
  };

  return (
    <Screen footer={<Button label="Send report" size="xl" variant={serious ? "danger" : "primary"} busy={busy} icon={<AlertTriangle size={22} color={serious ? "#fff" : colors.primaryForeground} />} onPress={() => void submit()} />}>
      <BackBar onBack={() => router.back()} title="Report issue" />
      {job ? <Text style={type.small}>Linked to job {job.reference} · {job.customer}</Text> : null}
      {serious ? (
        <Banner tone="danger" title="If anyone is hurt or in danger, call 999 first." body="Make the scene safe, then report here so the office knows." />
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Issue type">
        {TYPES.map((t) => {
          const on = kind === t.value;
          const c = t.serious ? colors.destructive : colors.primary;
          return (
            <Pressable key={t.value} onPress={() => setKind(t.value)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={t.label}
              style={({ pressed }) => [{ width: "48%", minHeight: TOUCH + 8, borderRadius: radius.lg, borderWidth: 1, borderColor: on ? c : colors.borderStrong,
                backgroundColor: on ? (t.serious ? colors.destructiveSoft : colors.primarySoft) : colors.card, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, padding: 8 }, pressed && { opacity: 0.8 }]}>
              {t.serious ? <AlertOctagon size={18} color={colors.destructive} /> : null}
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: on ? c : colors.foreground }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Card>
        <Field label="What happened?" value={text} onChangeText={setText} multiline placeholder="Where, what, anyone involved, is the load OK?" maxLength={4000} />
        <PhotoField label="Photos" uris={photos} onChange={setPhotos} max={3} />
        <Text style={type.small}>Time and location are recorded automatically.</Text>
      </Card>
    </Screen>
  );
}
