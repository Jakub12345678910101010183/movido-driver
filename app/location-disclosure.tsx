// LOCATION DISCLOSURE — shown before any OS location prompt (Google Play
// "prominent disclosure" for background location). Explains what is collected,
// when, why and who receives it; the OS prompts only follow "Continue".
import { useRouter } from "expo-router";
import { MapPin } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { PRIVACY_URL } from "../src/config";
import { requestPermissions } from "../src/services/location";
import { useApp } from "../src/state/AppContext";
import { Button, Card, Screen } from "../src/ui";
import { colors, space, type } from "../src/theme";
import { useT } from "../src/i18n/react";

export default function LocationDisclosure() {
  const t = useT();
  const router = useRouter();
  const { refreshGps } = useApp();
  const [busy, setBusy] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  const accept = async () => {
    setBusy(true);
    const r = await requestPermissions().catch(() => "denied" as const);
    await refreshGps();
    setBusy(false);
    if (r !== "granted_always") {
      Alert.alert(t("sync.allowAlways"), t("sync.allowAlwaysBody"),
        [{ text: t("common.later"), style: "cancel", onPress: close }, { text: t("common.openSettings"), onPress: () => { void Linking.openSettings(); close(); } }]);
    } else close();
  };

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: space.md, marginTop: space.lg }}>
        <MapPin size={48} color={colors.primary} />
        <Text style={[type.title, { textAlign: "center" }]}>{t("disclosure.title")}</Text>
      </View>
      <Card>
        <Text style={type.body}>{t("disclosure.body")}</Text>
        <Text style={type.bodyStrong}>{t("disclosure.whenTitle")}</Text>
        <Text style={type.body}>{t("disclosure.when")}</Text>
        <Text style={type.bodyStrong}>{t("disclosure.whyTitle")}</Text>
        <Text style={type.body}>{t("disclosure.why")}</Text>
        <Text style={type.bodyStrong}>{t("disclosure.whoTitle")}</Text>
        <Text style={type.body}>{t("disclosure.who")}</Text>
        <Text style={[type.small, { color: colors.primary }]} onPress={() => void Linking.openURL(PRIVACY_URL)}>{t("disclosure.privacy")}</Text>
      </Card>
      <Button label={t("disclosure.continue")} busy={busy} onPress={() => void accept()} />
      <Button label={t("disclosure.notNow")} variant="ghost" onPress={close} />
    </Screen>
  );
}
