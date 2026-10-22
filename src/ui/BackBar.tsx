import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { colors, TOUCH, type } from "../theme";

export function BackBar({ onBack, title }: { onBack: () => void; title?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}
        style={({ pressed }) => [{ width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.7 }]}>
        <ArrowLeft size={22} color={colors.foreground} />
      </Pressable>
      {title ? <Text style={type.heading}>{title}</Text> : null}
    </View>
  );
}
