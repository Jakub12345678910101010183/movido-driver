// PROOF OF DELIVERY — photo and/or signature, recipient, notes, time and
// location. Saved on the phone first (outbox), then uploaded: photo to
// pod-photos/<company>/<job>/<request>.jpg, then driver_complete_job.
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, Eraser, PenLine } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import SignatureScreen, { type SignatureViewRef } from "react-native-signature-canvas";
import { podPhotoPath } from "../../src/core/outbox.ts";
import { currentPosition } from "../../src/services/location";
import { newId } from "../../src/services/sync";
import { useApp } from "../../src/state/AppContext";
import { Banner, Button, Card, Field, Screen } from "../../src/ui";
import { BackBar } from "../../src/ui/BackBar";
import { PhotoField } from "../../src/ui/PhotoField";
import { colors, radius, space, type } from "../../src/theme";

const PAD_STYLE = `.m-signature-pad{box-shadow:none;border:none;margin:0;width:100%;height:100%}
.m-signature-pad--body{border:none}.m-signature-pad--footer{display:none}body,html{background:#ffffff;margin:0;height:100%}`;

export default function Pod() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { jobs, act, online } = useApp();
  const job = jobs.find((j) => String(j.id) === id);
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const pad = useRef<SignatureViewRef>(null);

  if (!job) return <Screen><BackBar onBack={() => router.back()} /><Banner tone="warning" title="Job not found" /></Screen>;
  if (saved || job.status === "completed") {
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: space.lg, paddingTop: space.xxl * 2 }}>
          <CheckCircle2 size={72} color={colors.success} />
          <Text style={[type.display, { textAlign: "center" }]}>Delivery completed</Text>
          <Text style={[type.body, { textAlign: "center", color: colors.mutedForeground }]}>
            {online ? "Proof of delivery is being sent to the office." : "Saved offline — it will sync automatically when you have signal."}
          </Text>
        </View>
        <Button label="Back to my jobs" size="xl" onPress={() => router.replace("/(tabs)")} />
      </Screen>
    );
  }

  const submit = async () => {
    if (!photos.length && !signature) { Alert.alert("Proof of delivery needed", "Take a photo of the delivered goods or get the recipient's signature."); return; }
    if (signature && !recipient.trim()) { Alert.alert("Recipient name", "Enter the name of the person who signed."); return; }
    setBusy(true);
    const requestId = newId();
    const pos = await currentPosition();
    await act({
      kind: "complete_job",
      jobId: job.id,
      photo: photos[0] ? { uri: photos[0], bucket: "pod-photos", path: podPhotoPath(job.organization_id, job.id, requestId), contentType: "image/jpeg" } : null,
      signature,
      recipient: recipient.trim() || null,
      notes: notes.trim() || null,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      capturedAt: new Date().toISOString(),
    }, requestId);
    setBusy(false);
    setSaved(true);
  };

  return (
    <Screen
      footer={<Button label="Confirm delivery" size="xl" variant="success" busy={busy} icon={<CheckCircle2 size={22} color={colors.primaryForeground} />} onPress={() => void submit()} />}
    >
      <BackBar onBack={() => router.back()} title={`POD · ${job.reference}`} />
      <Text style={type.small}>{job.customer}{job.delivery_address ? ` · ${job.delivery_address}` : ""}</Text>

      <Card>
        <PhotoField label="Delivery photo" uris={photos} onChange={setPhotos} max={1} />
      </Card>

      <Card>
        <Text style={type.label}>Recipient signature</Text>
        {signature && !signing ? (
          <View style={{ gap: space.sm }}>
            <Banner tone="success" title="Signature captured" />
            <Button label="Sign again" variant="secondary" size="md" icon={<PenLine size={18} color={colors.foreground} />} onPress={() => { setSignature(null); setSigning(true); }} />
          </View>
        ) : signing ? (
          <View style={{ gap: space.sm }}>
            <View style={{ height: 260, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.primaryBorder }}
              accessibilityLabel="Signature pad. The recipient signs here with a finger.">
              <SignatureScreen ref={pad} webStyle={PAD_STYLE} penColor="#000000" backgroundColor="#ffffff" autoClear={false}
                imageType="image/png" onOK={(sig) => { setSignature(sig); setSigning(false); }} onEmpty={() => Alert.alert("No signature", "Ask the recipient to sign in the box.")} />
            </View>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button style={{ flex: 1 }} label="Clear" variant="ghost" icon={<Eraser size={18} color={colors.foreground} />} onPress={() => pad.current?.clearSignature()} />
              <Button style={{ flex: 2 }} label="Confirm signature" onPress={() => pad.current?.readSignature()} />
            </View>
          </View>
        ) : (
          <Button label="Get signature" variant="secondary" icon={<PenLine size={20} color={colors.foreground} />} onPress={() => setSigning(true)} />
        )}
        <Field label="Recipient name" value={recipient} onChangeText={setRecipient} placeholder="Name of the person receiving" autoCapitalize="words" />
      </Card>

      <Card>
        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. left at goods-in, 2 pallets" multiline maxLength={2000} />
        <Text style={type.small}>Time and location are recorded automatically.</Text>
      </Card>
    </Screen>
  );
}
