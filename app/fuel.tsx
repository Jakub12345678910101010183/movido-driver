// FUEL — type, litres, price, total (calculated, receipt total wins),
// mileage, station, receipt photo. The server recalculates and validates.
import { useRouter } from "expo-router";
import { CheckCircle2, Fuel as FuelIcon } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Text, View } from "react-native";
import { driverUploadPath } from "../src/core/outbox.ts";
import type { FuelType } from "../src/core/types.ts";
import { currentPosition } from "../src/services/location";
import { newId } from "../src/services/sync";
import { useApp } from "../src/state/AppContext";
import { Button, Card, Field, Row, Screen, Segmented } from "../src/ui";
import { BackBar } from "../src/ui/BackBar";
import { PhotoField } from "../src/ui/PhotoField";
import { colors, space, type } from "../src/theme";

const num = (s: string) => { const v = Number(s.replace(",", ".").replace(/[^0-9.]/g, "")); return s.trim() && Number.isFinite(v) ? v : null; };

export default function Fuel() {
  const router = useRouter();
  const { profile, act, online } = useApp();
  const [fuelType, setFuelType] = useState<FuelType>("diesel");
  const [litres, setLitres] = useState("");
  const [ppl, setPpl] = useState("");
  const [total, setTotal] = useState("");
  const [mileage, setMileage] = useState("");
  const [station, setStation] = useState("");
  const [receipt, setReceipt] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const l = num(litres), p = num(ppl), t = num(total);
  const calc = l && p ? Math.round(l * p * 100) / 100 : null;
  const mismatch = t !== null && calc !== null && Math.abs(t - calc) > Math.max(1, calc * 0.02);

  if (done) {
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: space.lg, paddingTop: space.xxl * 2 }}>
          <CheckCircle2 size={72} color={colors.success} />
          <Text style={[type.display, { textAlign: "center" }]}>Fuel recorded</Text>
          <Text style={[type.body, { textAlign: "center", color: colors.mutedForeground }]}>{online ? "Sent to the office." : "Saved offline — it will sync automatically."}</Text>
        </View>
        <Button label="Done" size="xl" onPress={() => router.back()} />
      </Screen>
    );
  }

  const submit = async () => {
    if (!l || l <= 0) { Alert.alert("Litres", "Enter how many litres you filled."); return; }
    if (!p && !t) { Alert.alert("Price", "Enter the price per litre or the receipt total."); return; }
    if (!profile) return;
    setBusy(true);
    const requestId = newId();
    const pos = await currentPosition();
    await act({
      kind: "fuel", fuelType, litres: l, pricePerLitre: p, totalCost: t, mileage: num(mileage) !== null ? Math.round(num(mileage)!) : null,
      station: station.trim() || null, lat: pos?.lat ?? null, lng: pos?.lng ?? null,
      receipt: receipt[0] ? { uri: receipt[0], bucket: "driver-uploads", path: driverUploadPath(profile.organization.id, profile.driver.id, "fuel", requestId, 0), contentType: "image/jpeg" } : null,
      filledAt: new Date().toISOString(),
    }, requestId);
    setBusy(false);
    setDone(true);
  };

  return (
    <Screen footer={<Button label="Save fuel" size="xl" busy={busy} icon={<FuelIcon size={22} color={colors.primaryForeground} />} onPress={() => void submit()} />}>
      <BackBar onBack={() => router.back()} title="Record fuel" />
      <Card>
        <Segmented label="Fuel type" value={fuelType} onChange={setFuelType} options={[
          { value: "diesel", label: "Diesel" }, { value: "adblue", label: "AdBlue" }, { value: "hvo", label: "HVO" }, { value: "petrol", label: "Petrol" },
        ]} />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}><Field label="Litres" value={litres} onChangeText={setLitres} keyboardType="decimal-pad" placeholder="0.0" /></View>
          <View style={{ flex: 1 }}><Field label="£ per litre" value={ppl} onChangeText={setPpl} keyboardType="decimal-pad" placeholder="1.459" /></View>
        </View>
        {calc !== null ? <Row label="Calculated total" value={`£${calc.toFixed(2)}`} mono /> : null}
        <Field label="Receipt total £ (optional)" value={total} onChangeText={setTotal} keyboardType="decimal-pad" placeholder={calc !== null ? calc.toFixed(2) : "0.00"}
          hint="If entered, the receipt total is used." error={mismatch ? "Does not match litres × price — check the receipt." : null} />
        <Field label="Mileage (optional)" value={mileage} onChangeText={setMileage} keyboardType="number-pad" />
        <Field label="Station (optional)" value={station} onChangeText={setStation} placeholder="e.g. Watford Gap services" />
      </Card>
      <Card>
        <PhotoField label="Receipt photo" uris={receipt} onChange={setReceipt} max={1} />
        {profile?.vehicle ? <Text style={type.small}>Recorded for {profile.vehicle.vehicle_id}. Time and location are added automatically.</Text> : null}
      </Card>
    </Screen>
  );
}
