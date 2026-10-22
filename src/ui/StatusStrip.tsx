// One line under the header that always answers "is the office seeing me?":
// online/offline, location sharing, and anything waiting to sync.
import { useRouter } from "expo-router";
import { MapPin, MapPinOff, Wifi, WifiOff } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useApp } from "../state/AppContext";
import { colors, fonts } from "../theme";
import { formatClock } from "../services/navigation";
import { useT } from "../i18n/react";

export function StatusStrip() {
  const t = useT();
  const { online, gps, outboxItems, sync } = useApp();
  const router = useRouter();
  const pending = outboxItems.filter((i) => i.state === "pending").length;
  const failed = outboxItems.filter((i) => i.state === "failed").length;

  const net = online
    ? { icon: <Wifi size={15} color={colors.success} />, text: t("sync.online"), c: colors.success }
    : { icon: <WifiOff size={15} color={colors.warning} />, text: t("sync.offline"), c: colors.warning };

  const perm = gps.permission;
  const loc = !gps.tracking
    ? perm === "denied" || perm === "services_off" || perm === "undetermined"
      ? { icon: <MapPinOff size={15} color={colors.destructive} />, text: t("strip.locRequired"), c: colors.destructive }
      : { icon: <MapPinOff size={15} color={colors.mutedForeground} />, text: t("strip.locPaused"), c: colors.mutedForeground }
    : gps.queued > 0
      ? { icon: <MapPin size={15} color={colors.warning} />, text: t("strip.locOffline", { n: gps.queued }), c: colors.warning }
      : { icon: <MapPin size={15} color={colors.primary} />, text: `${t("strip.locActive")}${gps.lastSentAt ? t("strip.sentAt", { time: formatClock(gps.lastSentAt) }) : ""}${perm === "granted_foreground" ? t("strip.appOnly") : ""}`, c: colors.primary };

  const syncText = failed ? t("strip.attention", { n: failed }) : pending ? t("strip.toSync", { n: pending }) : null;
  const label = [net.text, loc.text, syncText].filter(Boolean).join(". ");

  return (
    <Pressable onPress={() => router.push("/sync")} accessibilityRole="button" accessibilityLabel={t("strip.a11y", { label })}
      style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, paddingVertical: 6, minHeight: 44 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>{net.icon}<Text style={{ color: net.c, fontFamily: fonts.medium, fontSize: 13 }}>{net.text}</Text></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 }}>{loc.icon}<Text style={{ color: loc.c, fontFamily: fonts.medium, fontSize: 13, flexShrink: 1 }}>{loc.text}</Text></View>
      {syncText ? <Text style={{ color: sync === "error" ? colors.destructive : colors.primary, fontFamily: fonts.medium, fontSize: 13 }}>{syncText}</Text> : null}
    </Pressable>
  );
}
