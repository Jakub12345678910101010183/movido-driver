// MORE — driver tools, profile and settings. No office/admin controls.
import * as Application from "expo-application";
import { useRouter } from "expo-router";
import { Bell, ClipboardCheck, Fuel, LogOut, MapPin, RefreshCw, TriangleAlert, User } from "lucide-react-native";
import React from "react";
import { Alert, Linking, Text, View } from "react-native";
import { SUPPORT_EMAIL } from "../../src/config";
import { useApp } from "../../src/state/AppContext";
import { Banner, Button, Card, Row, Screen, Section } from "../../src/ui";
import { colors, space, type } from "../../src/theme";

export default function More() {
  const router = useRouter();
  const { profile, session, signOut, outboxItems, gps, push, enablePush } = useApp();
  const pending = outboxItems.length;

  const confirmSignOut = () => {
    Alert.alert(
      pending ? `${pending} update${pending === 1 ? "" : "s"} not synced` : "Sign out?",
      pending
        ? "Some of your work is saved only on this phone. Signing out now deletes it. Get signal and let it sync first."
        : "Location sharing stops and this phone stops receiving your notifications.",
      pending
        ? [{ text: "Cancel", style: "cancel" }, { text: "Open sync status", onPress: () => router.push("/sync") }, { text: "Sign out and delete", style: "destructive", onPress: () => void signOut() }]
        : [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: () => void signOut() }],
    );
  };

  const pushText = { registered: "On", denied: "Off — allow in Settings", unavailable: "Not available on this device", not_configured: "Not configured in this build", error: "Could not register" }[push ?? "unavailable"] ?? "…";
  const locText = gps.permission === "granted_always" ? "Always (recommended)" : gps.permission === "granted_foreground" ? "Only while app is open" : gps.permission === "services_off" ? "Location services off" : gps.permission === "denied" ? "Denied" : "Not asked yet";

  return (
    <Screen>
      <Text style={type.title}>More</Text>

      <Section title="Driver tools">
        <Button label="Vehicle check" variant="secondary" icon={<ClipboardCheck size={20} color={colors.foreground} />} onPress={() => router.push("/check")} />
        <Button label="Report issue" variant="secondary" icon={<TriangleAlert size={20} color={colors.warning} />} onPress={() => router.push("/incident")} />
        <Button label="Record fuel" variant="secondary" icon={<Fuel size={20} color={colors.foreground} />} onPress={() => router.push("/fuel")} />
        <Button label={pending ? `Sync status (${pending})` : "Sync status"} variant="secondary" icon={<RefreshCw size={20} color={colors.foreground} />} onPress={() => router.push("/sync")} />
      </Section>

      <Section title="Profile">
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <User size={28} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={type.heading}>{profile?.driver.name}</Text>
              <Text style={type.small}>{profile?.organization.name}</Text>
            </View>
          </View>
          <Row label="Vehicle" value={profile?.vehicle ? `${profile.vehicle.vehicle_id}${profile.vehicle.registration ? ` · ${profile.vehicle.registration}` : ""}` : "None assigned"} />
          <Row label="Email" value={session?.user.email ?? "—"} />
          {profile?.driver.phone ? <Row label="Phone" value={profile.driver.phone} /> : null}
        </Card>
      </Section>

      <Section title="Settings">
        <Card>
          <Row label="Location" value={locText} />
          {gps.permission !== "granted_always" ? (
            <Button label="Location settings" variant="ghost" size="md" icon={<MapPin size={18} color={colors.foreground} />} onPress={() => router.push("/sync")} />
          ) : null}
          <Row label="Notifications" value={pushText} />
          {push !== "registered" && push !== "unavailable" && push !== "not_configured" ? (
            <Button label="Turn on notifications" variant="ghost" size="md" icon={<Bell size={18} color={colors.foreground} />}
              onPress={() => (push === "denied" ? void Linking.openSettings() : void enablePush())} />
          ) : null}
          <Row label="App version" value={`${Application.nativeApplicationVersion ?? "1.0.0"} (${Application.nativeBuildVersion ?? "dev"})`} mono />
        </Card>
      </Section>

      {pending ? <Banner tone="warning" title={`${pending} update${pending === 1 ? "" : "s"} waiting to sync`} body="Keep the app signed in until they sync." /> : null}
      <Button label="Sign out" variant="danger" icon={<LogOut size={20} color="#fff" />} onPress={confirmSignOut} />
      <Text style={[type.small, { textAlign: "center" }]}>Help: <Text style={{ color: colors.primary }} onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>{SUPPORT_EMAIL}</Text></Text>
    </Screen>
  );
}
