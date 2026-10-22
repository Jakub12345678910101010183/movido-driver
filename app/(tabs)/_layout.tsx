// Bottom navigation: HOME · JOBS · MESSAGES · MORE.
import { Tabs } from "expo-router";
import { Home, ListChecks, Menu, MessageSquare } from "lucide-react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../src/state/AppContext";
import { colors, fonts } from "../../src/theme";

export default function TabsLayout() {
  const { unread, outboxItems } = useApp();
  const insets = useSafeAreaInsets();
  const failed = outboxItems.filter((i) => i.state === "failed").length;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 64 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8) },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.4 },
        tabBarItemStyle: { minHeight: 52 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "HOME", tabBarAccessibilityLabel: "Home", tabBarIcon: ({ color }) => <Home size={24} color={color} /> }} />
      <Tabs.Screen name="jobs" options={{ title: "JOBS", tabBarAccessibilityLabel: "Jobs", tabBarIcon: ({ color }) => <ListChecks size={24} color={color} /> }} />
      <Tabs.Screen name="messages" options={{
        title: "MESSAGES", tabBarAccessibilityLabel: unread ? `Messages, ${unread} unread` : "Messages",
        tabBarBadge: unread || undefined, tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.primaryForeground, fontFamily: fonts.bold },
        tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} />,
      }} />
      <Tabs.Screen name="more" options={{
        title: "MORE", tabBarAccessibilityLabel: failed ? `More, ${failed} items need attention` : "More",
        tabBarBadge: failed || undefined, tabBarBadgeStyle: { backgroundColor: colors.destructive, color: "#fff" },
        tabBarIcon: ({ color }) => <Menu size={24} color={color} />,
      }} />
    </Tabs>
  );
}
