// SYNC & LOCATION — what is waiting on this phone, what failed and why,
// and location permission with the steps to fix it.
import { useRouter } from "expo-router";
import { MapPin, RefreshCw, Trash2 } from "lucide-react-native";
import React from "react";
import { Alert, Linking, Text, View } from "react-native";
import { HELD_NOTE, type OutboxItem } from "../src/core/outbox.ts";
import { requestPermissions } from "../src/services/location";
import { formatClock } from "../src/services/navigation";
import { outbox } from "../src/services/sync";
import { useApp } from "../src/state/AppContext";
import { Banner, Button, Card, Empty, Pill, Row, Screen, Section } from "../src/ui";
import { BackBar } from "../src/ui/BackBar";
import { colors, space, type } from "../src/theme";
import { t as tr } from "../src/i18n/index.ts";
import { useT } from "../src/i18n/react";

const describe = (i: OutboxItem): string => {
  const a = i.action;
  switch (a.kind) {
    case "start_job": return tr("sync.item.startJob");
    case "mark_stop": return tr(a.status === "arrived" ? "sync.item.stopArrival" : "sync.item.stopCompleted", { n: a.stopIndex + 1 });
    case "complete_job": return `${tr("sync.item.pod")}${a.photo ? tr("sync.item.podPhoto") : ""}${a.signature ? tr("sync.item.podSignature") : ""}`;
    case "incident": return tr("sync.item.issue", { type: tr(`incident.type.${a.type}`) });
    case "fuel": return tr("sync.item.fuel", { litres: a.litres });
    case "vehicle_check": return tr("sync.item.check");
    case "message": return tr("sync.item.message");
    case "read_messages": return tr("sync.item.read");
  }
};

export default function Sync() {
  const t = useT();
  const router = useRouter();
  const { outboxItems, online, syncNow, gps, refreshGps, sync } = useApp();

  const fixLocation = async () => {
    const r = await requestPermissions();
    if (r !== "granted_always") {
      Alert.alert(t("sync.allowAlways"), t("sync.allowAlwaysBody"),
        [{ text: t("common.later"), style: "cancel" }, { text: t("common.openSettings"), onPress: () => void Linking.openSettings() }]);
    }
    await refreshGps();
  };

  return (
    <Screen>
      <BackBar onBack={() => router.back()} title={t("sync.title")} />
      <Card>
        <Row label={t("sync.connection")} value={<Pill label={online ? t("sync.online") : t("sync.offline")} tone={online ? "success" : "warning"} />} />
        <Row label={t("sync.sync")} value={<Pill label={t(`sync.state.${sync}`)} tone={sync === "error" ? "danger" : sync === "online" ? "success" : "warning"} />} />
        <Button label={t("sync.syncNow")} variant="secondary" size="md" disabled={!online} icon={<RefreshCw size={18} color={colors.foreground} />} onPress={() => void syncNow()} />
      </Card>

      <Section title={t("more.location")}>
        <Card>
          <Row label={t("sync.sharing")} value={gps.tracking ? t("sync.sharingActive") : t("sync.sharingPaused")} />
          <Row label={t("sync.permission")} value={gps.permission === "granted_always" ? t("sync.perm.always") : gps.permission === "granted_foreground" ? t("sync.perm.whileUsing") : gps.permission ?? "—"} />
          <Row label={t("sync.lastSent")} value={formatClock(gps.lastSentAt)} mono />
          <Row label={t("sync.waitingToSend")} value={String(gps.queued)} mono />
          {gps.permission !== "granted_always" ? (
            <Button label={gps.permission === "granted_foreground" ? t("sync.allowAlways") : t("sync.allowLocation")} icon={<MapPin size={20} color={colors.primaryForeground} />} onPress={() => void fixLocation()} />
          ) : null}
          <Text style={type.small}>{t("sync.privacy")}</Text>
        </Card>
      </Section>

      <Section title={t("sync.onPhone", { n: outboxItems.length })}>
        {outboxItems.length ? outboxItems.map((i) => (
          <Card key={i.id} tone={i.state === "failed" ? "danger" : undefined}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Text style={[type.bodyStrong, { flex: 1 }]}>{describe(i)}</Text>
              <Pill label={i.state === "failed" ? t("sync.failed") : t("sync.waiting")} tone={i.state === "failed" ? "danger" : "warning"} />
            </View>
            <Text style={type.small}>{t("sync.savedAt", { time: formatClock(i.createdAt) })}{i.attempts ? t("sync.attempts", { n: i.attempts }) : ""}</Text>
            {i.lastError ? <Text style={[type.small, { color: i.state === "failed" ? colors.destructive : colors.warning }]}>{i.lastError === HELD_NOTE ? t("sync.held") : i.lastError}</Text> : null}
            {i.state === "failed" ? (
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Button style={{ flex: 1 }} label={t("sync.tryAgain")} size="md" variant="secondary" onPress={() => void outbox.retry(i.id).then(syncNow)} />
                <Button style={{ flex: 1 }} label={t("common.delete")} size="md" variant="ghost" icon={<Trash2 size={16} color={colors.destructive} />}
                  onPress={() => Alert.alert(t("sync.deleteQ"), t("sync.deleteBody"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: () => void outbox.discard(i.id) }])} />
              </View>
            ) : null}
          </Card>
        )) : <Empty title={t("sync.emptyTitle")} body={t("sync.emptyBody")} />}
      </Section>
      {outboxItems.some((i) => i.state === "failed") ? (
        <Banner tone="danger" title={t("sync.rejectedTitle")} body={t("sync.rejectedBody")} />
      ) : null}
    </Screen>
  );
}
