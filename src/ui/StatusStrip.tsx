// One line under the header that always answers "is the office seeing me?":
// online/offline, location sharing, and anything waiting to sync.
import { useRouter } from "expo-router";
import { MapPin, MapPinOff, Wifi, WifiOff } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useApp } from "../state/AppContext";
import { colors, fonts } from "../theme";
import { formatClock } from "../services/navigation";

export function StatusStrip() {
  const { online, gps, outboxItems, sync } = useApp();
  const router = useRouter();
  const pending = outboxItems.filter((i) => i.state === "pending").length;
  const failed = outboxItems.filter((i) => i.state === "failed").length;

  const net = online
    ? { icon: <Wifi size={15} color={colors.success} />, text: "Online", c: colors.success }
    : { icon: <WifiOff size={15} color={colors.warning} />, text: "Offline", c: colors.warning };

  const perm = gps.permission;
  const loc = !gps.tracking
    ? perm === "denied" || perm === "services_off" || perm === "undetermined"
      ? { icon: <MapPinOff size={15} color={colors.destructive} />, text: "Location permission required", c: colors.destructive }
      : { icon: <MapPinOff size={15} color={colors.mutedForeground} />, text: "Location paused (no job in progress)", c: colors.mutedForeground }
    : gps.queued > 0
      ? { icon: <MapPin size={15} color={colors.warning} />, text: `Location offline — ${gps.queued} will sync`, c: colors.warning }
      : { icon: <MapPin size={15} color={colors.primary} />, text: `Location active${gps.lastSentAt ? ` · sent ${formatClock(gps.lastSentAt)}` : ""}${perm === "granted_foreground" ? " (app open only)" : ""}`, c: colors.primary };

  const syncText = failed ? `${failed} need attention` : pending ? `${pending} to sync` : null;
  const label = [net.text, loc.text, syncText].filter(Boolean).join(". ");

  return (
    <Pressable onPress={() => router.push("/sync")} accessibilityRole="button" accessibilityLabel={`${label}. Open sync and location status.`}
      style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, paddingVertical: 6, minHeight: 44 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>{net.icon}<Text style={{ color: net.c, fontFamily: fonts.medium, fontSize: 13 }}>{net.text}</Text></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 }}>{loc.icon}<Text style={{ color: loc.c, fontFamily: fonts.medium, fontSize: 13, flexShrink: 1 }}>{loc.text}</Text></View>
      {syncText ? <Text style={{ color: sync === "error" ? colors.destructive : colors.primary, fontFamily: fonts.medium, fontSize: 13 }}>{syncText}</Text> : null}
    </Pressable>
  );
}
