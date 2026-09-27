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

const ITEMS: { key: CheckKey; label: string; hint: string; critical?: boolean }[] = [
  { key: "tyres", label: "Tyres & wheels", hint: "Tread, damage, pressure, wheel nuts", critical: true },
  { key: "lights", label: "Lights & indicators", hint: "Head, tail, brake, indicators, markers", critical: true },
  { key: "brakes", label: "Brakes", hint: "Service & parking brake, air build-up", critical: true },
  { key: "mirrors", label: "Mirrors & glass", hint: "Mirrors, windscreen, wipers" },
  { key: "body", label: "Bodywork & doors", hint: "Panels, doors, load security" },
  { key: "trailer", label: "Trailer", hint: "Body, curtains, landing legs" },
  { key: "coupling", label: "Coupling", hint: "Fifth wheel, kingpin, air & electric lines", critical: true },
  { key: "fluids", label: "Fluids & leaks", hint: "Oil, coolant, AdBlue, fuel leaks" },
  { key: "safety_equipment", label: "Safety equipment", hint: "Extinguisher, first aid, hi-vis" },
  { key: "damage", label: "New damage", hint: "Any damage not reported before" },
  { key: "other", label: "Other", hint: "Anything else" },
];

type Status = "pass" | "fail" | "na" | "";

export default function VehicleCheck() {
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
      <Screen><BackBar onBack={() => router.back()} title="Vehicle check" />
        <Banner tone="warning" title="No vehicle assigned" body="Ask the office to assign your vehicle, then do the check." /></Screen>
    );
  }
  if (done) {
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: space.lg, paddingTop: space.xxl * 2 }}>
          {done.critical ? <ShieldAlert size={72} color={colors.destructive} /> : <ClipboardCheck size={72} color={done.fails ? colors.warning : colors.success} />}
          <Text style={[type.display, { textAlign: "center" }]}>{done.critical ? "Do not drive" : done.fails ? "Check submitted with defects" : "Vehicle check passed"}</Text>
          <Text style={[type.body, { textAlign: "center", color: colors.mutedForeground }]}>
            {done.critical ? "A safety-critical defect was reported. Contact the office before driving this vehicle." : online ? "The office can see this check." : "Saved offline — it will sync automatically."}
          </Text>
        </View>
        <Button label="Done" size="xl" onPress={() => router.replace("/(tabs)")} />
      </Screen>
    );
  }

  const submit = async () => {
    if (answered < ITEMS.length) { Alert.alert("Check not finished", `Mark all ${ITEMS.length} items as Pass, Fail or N/A.`); return; }
    const missingNote = fails.find((i) => !(notes[i.key] ?? "").trim());
    if (missingNote) { Alert.alert("Describe the defect", `Add a short note for "${missingNote.label}".`); return; }
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
    <Screen footer={<Button label={`Submit check (${answered}/${ITEMS.length})`} size="xl" busy={busy} variant={critical ? "danger" : "primary"} onPress={() => void submit()} />}>
      <BackBar onBack={() => router.back()} title="Pre-start check" />
      <Card>
        <Text style={type.heading}>{profile.vehicle.vehicle_id}{profile.vehicle.registration ? ` · ${profile.vehicle.registration}` : ""}</Text>
        <Field label="Odometer (miles)" value={odometer} onChangeText={setOdometer} keyboardType="number-pad" placeholder="e.g. 250100" />
        <Button label="All items pass" variant="ghost" size="md" onPress={() => setStatus(Object.fromEntries(ITEMS.map((i) => [i.key, status[i.key] || "pass"])))}
          accessibilityHint="Marks every unanswered item as pass" />
      </Card>
      {critical ? <Banner tone="danger" title="Safety-critical defect" body="Brakes, tyres, lights or coupling failed. Do not drive until the office confirms it is safe." /> : null}
      {ITEMS.map((i) => (
        <Card key={i.key} tone={status[i.key] === "fail" ? (i.critical ? "danger" : "warning") : undefined}>
          <View style={{ gap: 2 }}>
            <Text style={type.bodyStrong}>{i.label}{i.critical ? <Text style={{ color: colors.destructive }}>  · critical</Text> : null}</Text>
            <Text style={type.small}>{i.hint}</Text>
          </View>
          <Segmented label={i.label} value={(status[i.key] || "") as Status} onChange={(v) => setStatus((p) => ({ ...p, [i.key]: v }))}
            options={[{ value: "pass", label: "Pass", tone: "success" }, { value: "fail", label: "Fail", tone: "danger" }, { value: "na", label: "N/A", tone: "neutral" }]} />
          {status[i.key] === "fail" ? (
            <Field label="What is wrong?" value={notes[i.key] ?? ""} onChangeText={(t) => setNotes((p) => ({ ...p, [i.key]: t }))} placeholder="Describe the defect" multiline maxLength={500} />
          ) : null}
        </Card>
      ))}
      <Card>
        <PhotoField label="Defect photos" uris={photos} onChange={setPhotos} max={4} />
        <Field label="Other notes (optional)" value={general} onChangeText={setGeneral} multiline maxLength={2000} />
      </Card>
    </Screen>
  );
}
