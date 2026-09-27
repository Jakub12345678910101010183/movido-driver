// Root: fonts, app state, and routing by account state. The location task
// module is imported first so the OS can deliver background locations even
// when it relaunches the app without UI.
import "../src/services/location";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "../src/state/AppContext";
import { colors } from "../src/theme";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { auth } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (auth === "loading") return;
    void SplashScreen.hideAsync().catch(() => {});
    const onLogin = segments[0] === "login" || segments[0] === "forgot-password";
    if (auth !== "ready" && !onLogin) router.replace("/login");
    if (auth === "ready" && (onLogin || !segments[0])) router.replace("/(tabs)");
  }, [auth, segments, router]);

  // Tapping a notification opens the job or the messages.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const d = r.notification.request.content.data as { type?: string; job_id?: number };
      if (d?.type === "message") router.push("/(tabs)/messages");
      else if (d?.job_id) router.push({ pathname: "/job/[id]", params: { id: String(d.job_id) } });
    });
    return () => sub.remove();
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "slide_from_right" }}>
      <Stack.Screen name="login" options={{ animation: "fade" }} />
      <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, JetBrainsMono_500Medium, JetBrainsMono_700Bold });
  if (!loaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="light" />
          <Gate />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
