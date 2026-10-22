// PRE-START VEHICLE CHECK — PASS / FAIL / N/A per item, notes + photo on a
// defect. The server computes the result (and "critical") from the items;
// the office sees it under Vehicle checks.
import { useRouter } from "expo-router";
import { ClipboardCheck, ShieldAlert } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Text, View } from "react-native";
import { driverUploadPath } from "../src/core/outbox.ts";
import type { CheckItem, CheckKey } from "../src/core/types.ts";
import { currentPosition } from "../src/services/location";
import { newId } from "../src/services/sync";
import { useApp } from "../src/state/AppContext";
import { Banner, Button, Card, Field, Screen, Segmented } from "../src/ui";
import { BackBar } from "../src/ui/BackBar";
import { PhotoField } from "../src/ui/PhotoField";
import { colors, space, type } from "../src/theme";
import { t as tr } from "../src/i18n/index.ts";
import { useT } from "../src/i18n/react";

const ITEMS: { key: CheckKey; critical?: boolean }[] = [
  { key: "tyres", critical: true },
  { key: "lights", critical: true },
  { key: "brakes", critical: true },
  { key: "mirrors" },
  { key: "body" },
  { key: "trailer" },
  { key: "coupling", critical: true },
  { key: "fluids" },
  { key: "safety_equipment" },
  { key: "damage" },
  { key: "other" },
];
const itemLabel = (k: CheckKey) => tr(`check.item.${k}`);

type Status = "pass" | "fail" | "na" | "";

export default function VehicleCheck() {
  const t = useT();
  const router = useRouter();
  const { profile, act, online } = useApp();
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [odometer, setOdometer] = useState("");
  const [general, setGeneral] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { critical: boolean; fails: number }>(null);

  const answered = ITEMS.filter((i) => status[i.key]).length;
  const fails = ITEMS.filter((i) => status[i.key] === "fail");
  const critical = fails.some((i) => i.critical);

  if (!profile?.vehicle) {
    return (
      <Screen><BackBar onBack={() => router.back()} title={t("common.vehicleCheck")} />
        <Banner tone="warning" title={t("check.noVehicleTitle")} body={t("check.noVehicleBody")} /></Screen>
    );
  }
  if (done) {
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: space.lg, paddingTop: space.xxl * 2 }}>
          {done.critical ? <ShieldAlert size={72} color={colors.destructive} /> : <ClipboardCheck size={72} color={done.fails ? colors.warning : colors.success} />}
          <Text style={[type.display, { textAlign: "center" }]}>{done.critical ? t("check.doNotDrive") : done.fails ? t("check.withDefects") : t("check.passed")}</Text>
          <Text style={[type.body, { textAlign: "center", color: colors.mutedForeground }]}>
            {done.critical ? t("check.criticalDone") : online ? t("check.officeSees") : t("common.savedOffline")}
          </Text>
        </View>
        <Button label={t("common.done")} size="xl" onPress={() => router.replace("/(tabs)")} />
      </Screen>
    );
  }

  const submit = async () => {
    if (answered < ITEMS.length) { Alert.alert(t("check.notFinishedTitle"), t("check.notFinishedBody", { n: ITEMS.length })); return; }
    const missingNote = fails.find((i) => !(notes[i.key] ?? "").trim());
    if (missingNote) { Alert.alert(t("check.describeTitle"), t("check.describeBody", { item: itemLabel(missingNote.key) })); return; }
    const odo = odometer.trim() ? Number(odometer.replace(/[^0-9]/g, "")) : null;
    setBusy(true);
    const requestId = newId();
    const pos = await currentPosition();
    const items: CheckItem[] = ITEMS.map((i) => ({ key: i.key, status: status[i.key] as "pass" | "fail" | "na", note: notes[i.key]?.trim() || undefined }));
    await act({
      kind: "vehicle_check", items, vehicleId: profile.vehicle!.id, odometer: odo, notes: general.trim() || null,
      photos: photos.map((uri, n) => ({ uri, bucket: "driver-uploads", path: driverUploadPath(profile.organization.id, profile.driver.id, "check", requestId, n), contentType: "image/jpeg" })),
      lat: pos?.lat ?? null, lng: pos?.lng ?? null, checkedAt: new Date().toISOString(),
    }, requestId);
    setBusy(false);
    setDone({ critical, fails: fails.length });
  };

  return (
    <Screen footer={<Button label={t("check.submit", { done: answered, total: ITEMS.length })} size="xl" busy={busy} variant={critical ? "danger" : "primary"} onPress={() => void submit()} />}>
      <BackBar onBack={() => router.back()} title={t("check.title")} />
      <Card>
        <Text style={type.heading}>{profile.vehicle.vehicle_id}{profile.vehicle.registration ? ` · ${profile.vehicle.registration}` : ""}</Text>
        <Field label={t("check.odometer")} value={odometer} onChangeText={setOdometer} keyboardType="number-pad" placeholder={t("check.odometerPh")} />
        <Button label={t("check.allPass")} variant="ghost" size="md" onPress={() => setStatus(Object.fromEntries(ITEMS.map((i) => [i.key, status[i.key] || "pass"])))}
          accessibilityHint={t("check.allPassHint")} />
      </Card>
      {critical ? <Banner tone="danger" title={t("check.criticalTitle")} body={t("check.criticalBody")} /> : null}
      {ITEMS.map((i) => (
        <Card key={i.key} tone={status[i.key] === "fail" ? (i.critical ? "danger" : "warning") : undefined}>
          <View style={{ gap: 2 }}>
            <Text style={type.bodyStrong}>{itemLabel(i.key)}{i.critical ? <Text style={{ color: colors.destructive }}>{t("check.criticalTag")}</Text> : null}</Text>
            <Text style={type.small}>{t(`check.hint.${i.key}`)}</Text>
          </View>
          <Segmented label={itemLabel(i.key)} value={(status[i.key] || "") as Status} onChange={(v) => setStatus((p) => ({ ...p, [i.key]: v }))}
            options={[{ value: "pass", label: t("check.pass"), tone: "success" }, { value: "fail", label: t("check.fail"), tone: "danger" }, { value: "na", label: t("check.na"), tone: "neutral" }]} />
          {status[i.key] === "fail" ? (
            <Field label={t("check.whatWrong")} value={notes[i.key] ?? ""} onChangeText={(v) => setNotes((p) => ({ ...p, [i.key]: v }))} placeholder={t("check.defectPh")} multiline maxLength={500} />
          ) : null}
        </Card>
      ))}
      <Card>
        <PhotoField label={t("check.photos")} uris={photos} onChange={setPhotos} max={4} />
        <Field label={t("check.otherNotes")} value={general} onChangeText={setGeneral} multiline maxLength={2000} />
      </Card>
    </Screen>
  );
}
