// The web app's "bg-terminal" background (a subtle vertical gradient on near
// black), drawn with react-native-svg so no extra native module is needed.
import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from "react-native-svg";
import { colors } from "../theme";

export function LinearGradient() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none" preserveAspectRatio="none">
      <Defs>
        <SvgGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#07080a" />
          <Stop offset="1" stopColor={colors.backgroundEnd} />
        </SvgGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" />
    </Svg>
  );
}
