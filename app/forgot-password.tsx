import { useRouter } from "expo-router";
import { ArrowLeft, Mail } from "lucide-react-native";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { WEB_URL } from "../src/config";
import { supabase } from "../src/lib/supabase";
import { Banner, Button, Card, Field, Logo, Screen } from "../src/ui";
import { colors, space, type } from "../src/theme";
import { useT } from "../src/i18n/react";

export default function ForgotPassword() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) { setError(t("forgot.enterEmail")); return; }
    setBusy(true); setError(null);
    // The link opens the secure MOViDO reset page; the new password then works here.
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${WEB_URL}/reset-password` });
    setBusy(false);
    if (e && /network|fetch/i.test(e.message)) { setError(t("forgot.noConnection")); return; }
    setSent(true); // same answer whether or not the address exists
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ paddingTop: space.xl, gap: space.sm }}>
        <Logo subtitle={t("common.driver")} />
        <Text style={[type.title, { marginTop: space.lg }]}>{t("forgot.title")}</Text>
      </View>
      {sent ? (
        <Banner tone="success" title={t("forgot.sentTitle")} body={t("forgot.sentBody")} />
      ) : (
        <Card>
          <Field label={t("common.email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={error} />
          <Button label={t("forgot.send")} icon={<Mail size={20} color={colors.primaryForeground} />} onPress={submit} busy={busy} />
        </Card>
      )}
      <Button label={t("forgot.back")} variant="ghost" icon={<ArrowLeft size={20} color={colors.foreground} />} onPress={() => router.replace("/login")} />
    </Screen>
  );
}
