// Sign in. Driver accounts are created by the office (invitation email →
// set password on the web → sign in here). Password reset uses the same
// secure web page as the office app.
import { Link } from "expo-router";
import { LogIn } from "lucide-react-native";
import React, { useState } from "react";
import { Linking, Text, View } from "react-native";
import { configProblems, SUPPORT_EMAIL } from "../src/config";
import { useApp } from "../src/state/AppContext";
import { Banner, Button, Card, Field, Logo, Screen } from "../src/ui";
import { colors, space, type } from "../src/theme";
import { useT } from "../src/i18n/react";

export default function Login() {
  const t = useT();
  const { signIn, auth, authMessage, signOut } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = configProblems();

  const submit = async () => {
    if (!email.trim() || !password) { setError(t("login.enterEmailPassword")); return; }
    setBusy(true); setError(null);
    const e = await signIn(email, password);
    setBusy(false);
    if (e) setError(e);
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ paddingTop: space.xxl, gap: space.sm }}>
        <Logo subtitle={t("common.driver")} />
        <Text style={[type.display, { marginTop: space.xl }]}>{t("login.title")}</Text>
        <Text style={type.small}>{t("login.subtitle")}</Text>
      </View>

      {missing.length ? <Banner tone="danger" title={t("login.notConfigured")} body={t("login.missing", { list: missing.join(", ") })} /> : null}
      {auth === "disabled" ? (
        <Banner tone="danger" title={t("login.disabledTitle")} body={t("login.disabledBody")}
          action={<Button label={t("common.useAnotherAccount")} variant="secondary" size="md" onPress={() => void signOut()} />} />
      ) : null}
      {auth === "not_driver" ? (
        <Banner tone="warning" title={t("login.notDriverTitle")} body={t("login.notDriverBody")}
          action={<Button label={t("common.useAnotherAccount")} variant="secondary" size="md" onPress={() => void signOut()} />} />
      ) : null}
      {authMessage ? <Banner tone="warning" title={authMessage} /> : null}

      <Card>
        <Field label={t("common.email")} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address"
          textContentType="username" returnKeyType="next" placeholder="you@company.co.uk" />
        <Field label={t("login.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password"
          textContentType="password" returnKeyType="go" onSubmitEditing={submit} placeholder="••••••••" error={error} />
        <Button label={t("login.title")} icon={<LogIn size={20} color={colors.primaryForeground} />} onPress={submit} busy={busy} size="xl" />
        <Link href="/forgot-password" style={[type.bodyStrong, { color: colors.primary, textAlign: "center", paddingVertical: 12 }]}
          accessibilityRole="link">{t("login.forgot")}</Link>
      </Card>

      <Text style={[type.small, { textAlign: "center" }]}>
        {t("login.noAccount")}{"\n"}{t("common.help")}{" "}
        <Text style={{ color: colors.primary }} onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>{SUPPORT_EMAIL}</Text>
      </Text>
    </Screen>
  );
}
