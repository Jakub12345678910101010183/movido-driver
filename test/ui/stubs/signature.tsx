import React, { forwardRef } from "react";
import { View } from "react-native";
export type SignatureViewRef = { readSignature(): void; clearSignature(): void };
export default forwardRef<SignatureViewRef, Record<string, unknown>>(function Pad() {
  return <View style={{ flex: 1, backgroundColor: "#fff" }} accessibilityLabel="signature pad (test double)" />;
});
