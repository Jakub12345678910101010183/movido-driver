// MORE — driver tools, profile and settings. No office/admin controls.
import * as Application from "expo-application";
import { useRouter } from "expo-router";
import { Bell, ClipboardCheck, Fuel, LogOut, MapPin, RefreshCw, TriangleAlert, User } from "lucide-react-native";
import React from "react";
import { Alert, Linking, Text, View } from "react-native";
import { SUPPORT_EMAIL } from "../../src/config";
import { turnOnAction } from "../../src/core/push.ts";
import { useApp } from "../../src/state/AppContext";
import { Banner, Button, Card, Row, Screen, Section, Segmented } from "../../src/ui";
import { colors, space, type } from "../../src/theme";
import { LANGS } from "../../src/i18n/index.ts";
import { chooseLang, useLang, useT } from "../../src/i18n/react";

export default function More() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { profile, session, signOut, outboxItems, gps, push, enablePush } = useApp();
  const pending = outboxItems.length;

  const confirmSignOut = () => {
    Alert.alert(
      pending ? t("more.unsyncedTitle", { n: pending }) : t("more.signOutQ"),
      pending
        ? t("more.unsyncedBody")
        : t("more.signOutBody"),
      pending
        ? [{ text: t("common.cancel"), style: "cancel" }, { text: t("more.openSync"), onPress: () => router.push("/sync") }, { text: t("more.signOutDelete"), style: "destructive", onPress: () => void signOut() }]
        : [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.signOut"), style: "destructive", onPress: () => void signOut() }],
    );
  };

  const pushText = push ? t(`more.push.${push}`) : "…";
  const pushAction = turnOnAction(push);
  const locText = t(gps.permission === "granted_always" ? "more.loc.always" : gps.permission === "granted_foreground" ? "more.loc.foreground" : gps.permission === "services_off" ? "more.loc.servicesOff" : gps.permission === "denied" ? "more.loc.denied" : "more.loc.notAsked");

  return (
    <Screen>
      <Text style={type.title}>{t("more.title")}</Text>

      <Section title={t("more.tools")}>
        <Button label={t("common.vehicleCheck")} variant="secondary" icon={<ClipboardCheck size={20} color={colors.foreground} />} onPress={() => router.push("/check")} />
        <Button label={t("common.reportIssue")} variant="secondary" icon={<TriangleAlert size={20} color={colors.warning} />} onPress={() => router.push("/incident")} />
        <Button label={t("common.recordFuel")} variant="secondary" icon={<Fuel size={20} color={colors.foreground} />} onPress={() => router.push("/fuel")} />
        <Button label={pending ? t("more.syncStatusN", { n: pending }) : t("more.syncStatus")} variant="secondary" icon={<RefreshCw size={20} color={colors.foreground} />} onPress={() => router.push("/sync")} />
      </Section>

      <Section title={t("more.profile")}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <User size={28} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={type.heading}>{profile?.driver.name}</Text>
              <Text style={type.small}>{profile?.organization.name}</Text>
            </View>
          </View>
          <Row label={t("common.vehicle")} value={profile?.vehicle ? `${profile.vehicle.vehicle_id}${profile.vehicle.registration ? ` · ${profile.vehicle.registration}` : ""}` : t("common.noneAssigned")} />
          <Row label={t("common.email")} value={session?.user.email ?? "—"} />
          {profile?.driver.phone ? <Row label={t("common.phone")} value={profile.driver.phone} /> : null}
        </Card>
      </Section>

      <Section title={t("more.settings")}>
        <Card>
          <Text style={type.label}>{t("more.language")}</Text>
          <Segmented label={t("more.language")} value={lang} onChange={(v) => void chooseLang(v)} options={LANGS.map((l) => ({ value: l.value, label: l.label }))} />
          <Row label={t("more.location")} value={locText} />
          {gps.permission !== "granted_always" ? (
            <Button label={t("more.locationSettings")} variant="ghost" size="md" icon={<MapPin size={18} color={colors.foreground} />} onPress={() => router.push("/sync")} />
          ) : null}
          <Row label={t("more.notifications")} value={pushText} />
          {pushAction !== "none" ? (
            <Button label={pushAction === "settings" ? t("more.allowNotifications") : t("more.turnOnNotifications")} variant="ghost" size="md" icon={<Bell size={18} color={colors.foreground} />}
              onPress={() => (pushAction === "settings" ? void Linking.openSettings() : void enablePush())} />
          ) : null}
          <Row label={t("more.appVersion")} value={`${Application.nativeApplicationVersion ?? "1.0.0"} (${Application.nativeBuildVersion ?? "dev"})`} mono />
        </Card>
      </Section>

      {pending ? <Banner tone="warning" title={t("more.waitingTitle", { n: pending })} body={t("more.waitingBody")} /> : null}
      <Button label={t("common.signOut")} variant="danger" icon={<LogOut size={20} color="#fff" />} onPress={confirmSignOut} />
      <Text style={[type.small, { textAlign: "center" }]}>{t("common.help")} <Text style={{ color: colors.primary }} onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>{SUPPORT_EMAIL}</Text></Text>
    </Screen>
  );
}
