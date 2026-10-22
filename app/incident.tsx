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
import { useT } from "../src/i18n/react";

const TYPES: { value: IncidentType; serious?: boolean }[] = [
  { value: "accident", serious: true },
  { value: "vehicle_damage" },
  { value: "breakdown", serious: true },
  { value: "traffic_delay" },
  { value: "customer_issue" },
  { value: "delivery_issue" },
  { value: "road_closure" },
  { value: "load_damage" },
  { value: "theft", serious: true },
  { value: "other" },
];

export default function Incident() {
  const t = useT();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const router = useRouter();
  const { profile, act, online, jobs } = useApp();
  const job = jobs.find((j) => String(j.id) === jobId);
  const [kind, setKind] = useState<IncidentType | null>(null);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const serious = TYPES.find((x) => x.value === kind)?.serious;

  if (done) {
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: space.lg, paddingTop: space.xxl * 2 }}>
          <CheckCircle2 size={72} color={colors.success} />
          <Text style={[type.display, { textAlign: "center" }]}>{t("incident.reported")}</Text>
          <Text style={[type.body, { textAlign: "center", color: colors.mutedForeground }]}>{online ? t("incident.sent") : t("common.savedOffline")}</Text>
        </View>
        <Button label={t("common.done")} size="xl" onPress={() => router.back()} />
      </Screen>
    );
  }

  const submit = async () => {
    if (!kind) { Alert.alert(t("incident.chooseTitle"), t("incident.chooseBody")); return; }
    if (!text.trim()) { Alert.alert(t("incident.describeTitle"), t("incident.describeBody")); return; }
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
    <Screen footer={<Button label={t("incident.send")} size="xl" variant={serious ? "danger" : "primary"} busy={busy} icon={<AlertTriangle size={22} color={serious ? "#fff" : colors.primaryForeground} />} onPress={() => void submit()} />}>
      <BackBar onBack={() => router.back()} title={t("common.reportIssue")} />
      {job ? <Text style={type.small}>{t("incident.linked", { ref: job.reference, customer: job.customer })}</Text> : null}
      {serious ? (
        <Banner tone="danger" title={t("incident.call999Title")} body={t("incident.call999Body")} />
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={t("incident.typeA11y")}>
        {TYPES.map((ty) => {
          const on = kind === ty.value;
          const c = ty.serious ? colors.destructive : colors.primary;
          return (
            <Pressable key={ty.value} onPress={() => setKind(ty.value)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={t(`incident.type.${ty.value}`)}
              style={({ pressed }) => [{ width: "48%", minHeight: TOUCH + 8, borderRadius: radius.lg, borderWidth: 1, borderColor: on ? c : colors.borderStrong,
                backgroundColor: on ? (ty.serious ? colors.destructiveSoft : colors.primarySoft) : colors.card, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, padding: 8 }, pressed && { opacity: 0.8 }]}>
              {ty.serious ? <AlertOctagon size={18} color={colors.destructive} /> : null}
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: on ? c : colors.foreground }}>{t(`incident.type.${ty.value}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Card>
        <Field label={t("incident.what")} value={text} onChangeText={setText} multiline placeholder={t("incident.whatPh")} maxLength={4000} />
        <PhotoField label={t("incident.photos")} uris={photos} onChange={setPhotos} max={3} />
        <Text style={type.small}>{t("common.timeLocationAuto")}</Text>
      </Card>
    </Screen>
  );
}
