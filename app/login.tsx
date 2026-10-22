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

export default function Login() {
  const { signIn, auth, authMessage, signOut } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = configProblems();

  const submit = async () => {
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setBusy(true); setError(null);
    const e = await signIn(email, password);
    setBusy(false);
    if (e) setError(e);
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ paddingTop: space.xxl, gap: space.sm }}>
        <Logo subtitle="Driver" />
        <Text style={[type.display, { marginTop: space.xl }]}>Sign in</Text>
        <Text style={type.small}>Use the email and password from your MOViDO invitation.</Text>
      </View>

      {missing.length ? <Banner tone="danger" title="App not configured" body={`Missing: ${missing.join(", ")}`} /> : null}
      {auth === "disabled" ? (
        <Banner tone="danger" title="Your account is disabled" body="Your company has disabled this driver account. Contact your office if you think this is a mistake."
          action={<Button label="Use another account" variant="secondary" size="md" onPress={() => void signOut()} />} />
      ) : null}
      {auth === "not_driver" ? (
        <Banner tone="warning" title="Not a driver account" body="This app is for drivers. Office users sign in at movidologistics.uk."
          action={<Button label="Use another account" variant="secondary" size="md" onPress={() => void signOut()} />} />
      ) : null}
      {authMessage ? <Banner tone="warning" title={authMessage} /> : null}

      <Card>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address"
          textContentType="username" returnKeyType="next" placeholder="you@company.co.uk" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password"
          textContentType="password" returnKeyType="go" onSubmitEditing={submit} placeholder="••••••••" error={error} />
        <Button label="Sign in" icon={<LogIn size={20} color={colors.primaryForeground} />} onPress={submit} busy={busy} size="xl" />
        <Link href="/forgot-password" style={[type.bodyStrong, { color: colors.primary, textAlign: "center", paddingVertical: 12 }]}
          accessibilityRole="link">Forgot password?</Link>
      </Card>

      <Text style={[type.small, { textAlign: "center" }]}>
        No account yet? Your office invites you by email.{"\n"}Help:{" "}
        <Text style={{ color: colors.primary }} onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>{SUPPORT_EMAIL}</Text>
      </Text>
    </Screen>
  );
}
