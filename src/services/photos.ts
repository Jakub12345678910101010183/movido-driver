// Camera capture → resized JPEG kept in the app's own documents folder, so a
// photo taken with no signal survives app restarts until the outbox uploads it.
import * as FS from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

const DIR = `${FS.documentDirectory}outbox/`;
const MAX_EDGE = 1600; // enough to read a label or a dent; ~200–400 KB

export type CaptureResult = { uri: string } | { error: "permission" | "cancelled" | "failed" };

export async function takePhoto(): Promise<CaptureResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { error: "permission" };
  try {
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: false, exif: false });
    if (r.canceled || !r.assets?.[0]) return { error: "cancelled" };
    return { uri: await compress(r.assets[0].uri, r.assets[0].width, r.assets[0].height) };
  } catch { return { error: "failed" }; }
}

export async function pickPhoto(): Promise<CaptureResult> {
  // Android uses the system photo picker, which needs no storage permission
  // (and the storage permissions are blocked in app.json).
  if (Platform.OS === "ios") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { error: "permission" };
  }
  try {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, exif: false });
    if (r.canceled || !r.assets?.[0]) return { error: "cancelled" };
    return { uri: await compress(r.assets[0].uri, r.assets[0].width, r.assets[0].height) };
  } catch { return { error: "failed" }; }
}

async function compress(uri: string, w: number, h: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(w, h) > MAX_EDGE) ctx.resize(w >= h ? { width: MAX_EDGE } : { height: MAX_EDGE });
  const img = await ctx.renderAsync();
  const saved = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  await FS.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  const dest = `${DIR}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await FS.copyAsync({ from: saved.uri, to: dest });
  return dest;
}

export async function discardPhoto(uri: string | null | undefined) {
  if (uri) await FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
}
