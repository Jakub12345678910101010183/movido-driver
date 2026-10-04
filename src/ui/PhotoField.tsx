// TAKE PHOTO → PREVIEW → RETAKE / REMOVE. Photos are resized and kept on the
// phone until the outbox uploads them.
import { Camera, ImagePlus, RotateCcw, Trash2 } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Image, Linking, Text, View } from "react-native";
import { discardPhoto, pickPhoto, takePhoto } from "../services/photos";
import { colors, radius, space, type } from "../theme";
import { Button } from "./index";

export function PhotoField({ label, uris, onChange, max = 1, required }: {
  label: string; uris: string[]; onChange: (uris: string[]) => void; max?: number; required?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const add = async (source: "camera" | "library", replace?: number) => {
    setBusy(true);
    const r = source === "camera" ? await takePhoto() : await pickPhoto();
    setBusy(false);
    if ("error" in r) {
      if (r.error === "permission") {
        Alert.alert(source === "camera" ? "Camera permission required" : "Photo access required",
          "Allow access in Settings to attach photos.", [{ text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: () => void Linking.openSettings() }]);
      } else if (r.error === "failed") Alert.alert("Photo not saved", "Please take the photo again.");
      return;
    }
    if (replace !== undefined) {
      await discardPhoto(uris[replace]);
      onChange(uris.map((u, i) => (i === replace ? r.uri : u)));
    } else onChange([...uris, r.uri].slice(0, max));
  };
  const remove = async (i: number) => { await discardPhoto(uris[i]); onChange(uris.filter((_, k) => k !== i)); };

  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.label}>{label}{required ? " *" : ""}</Text>
      {uris.map((u, i) => (
        <View key={u} style={{ gap: space.sm }}>
          <Image source={{ uri: u }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}
            accessibilityLabel={`${label} ${i + 1} preview`} resizeMode="cover" />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button style={{ flex: 1 }} size="md" variant="secondary" label="Retake" icon={<RotateCcw size={18} color={colors.foreground} />} onPress={() => void add("camera", i)} busy={busy} />
            <Button style={{ flex: 1 }} size="md" variant="ghost" label="Remove" icon={<Trash2 size={18} color={colors.destructive} />} onPress={() => void remove(i)} />
          </View>
        </View>
      ))}
      {uris.length < max ? (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button style={{ flex: 2 }} label={uris.length ? "Add another photo" : "Take photo"} variant={uris.length ? "secondary" : "primary"} busy={busy}
            icon={<Camera size={20} color={uris.length ? colors.foreground : colors.primaryForeground} />} onPress={() => void add("camera")} />
          <Button style={{ flex: 1 }} label="Library" variant="ghost" size="md" icon={<ImagePlus size={18} color={colors.foreground} />} onPress={() => void add("library")} />
        </View>
      ) : null}
    </View>
  );
}
