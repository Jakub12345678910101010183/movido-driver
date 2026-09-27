// MOViDO Driver UI kit. Same visual language as the web app (dark terminal
// surfaces, cyan primary, thin borders, 8 px radius, Inter/JetBrains Mono),
// sized for a phone in a cab: 56 px primary buttons, 52 px minimum targets.
import { LinearGradient } from "./gradient";
import { AlertTriangle, CloudOff, RefreshCw, Truck, WifiOff } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle, RefreshControl, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, fonts, radius, space, statusTone, STATUS_LABEL, TOUCH, type } from "../theme";

export { colors };

export function Screen({ children, scroll = true, edges = ["top"], refreshing, onRefresh, footer }: {
  children: React.ReactNode; scroll?: boolean; edges?: Edge[]; refreshing?: boolean; onRefresh?: () => void; footer?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={s.screen} edges={edges}>
      <LinearGradient />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={s.scrollBody}
            keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
          >
            {children}
          </ScrollView>
        ) : <View style={{ flex: 1 }}>{children}</View>}
        {footer ? <View style={s.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <View style={s.logoRow} accessible accessibilityRole="header" accessibilityLabel={`MOViDO ${subtitle ?? "Driver"}`}>
      <View style={s.logoMark}><Truck size={18} color={colors.primary} /></View>
      <Text style={s.logoText}>MOViDO</Text>
      {subtitle ? <Text style={s.logoSub}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style, tone, onPress, accessibilityLabel }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: "primary" | "warning" | "danger" | "success"; onPress?: () => void; accessibilityLabel?: string;
}) {
  const border = tone === "primary" ? colors.primaryBorder : tone === "warning" ? colors.warning : tone === "danger" ? colors.destructive : tone === "success" ? colors.success : colors.border;
  const body = <View style={[s.card, { borderColor: border }, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] }]}>
      {body}
    </Pressable>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success";
export function Button({ label, onPress, variant = "primary", icon, disabled, busy, size = "lg", accessibilityHint, style }: {
  label: string; onPress: () => void; variant?: ButtonVariant; icon?: React.ReactNode; disabled?: boolean; busy?: boolean;
  size?: "md" | "lg" | "xl"; accessibilityHint?: string; style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: colors.primary, secondary: colors.cardRaised, danger: colors.destructive, ghost: "transparent", success: colors.success }[variant];
  const fg = variant === "primary" || variant === "success" ? colors.primaryForeground : variant === "danger" ? "#ffffff" : colors.foreground;
  const h = size === "xl" ? 64 : size === "lg" ? 56 : TOUCH;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      style={({ pressed }) => [
        s.button, { backgroundColor: bg, minHeight: h },
        variant === "secondary" && { borderWidth: 1, borderColor: colors.borderStrong },
        variant === "ghost" && { borderWidth: 1, borderColor: colors.border },
        variant === "primary" && s.glow,
        (disabled || busy) && { opacity: 0.45 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon}
      <Text style={[s.buttonText, { color: fg, fontSize: size === "xl" ? 19 : 17 }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ status, label, tone }: { status?: string; label?: string; tone?: "neutral" | "primary" | "success" | "warning" | "danger" }) {
  const t = tone ?? statusTone(status ?? "");
  const c = { neutral: colors.mutedForeground, primary: colors.primary, success: colors.success, warning: colors.warning, danger: colors.destructive }[t];
  const text = label ?? STATUS_LABEL[status ?? ""] ?? status ?? "";
  return (
    <View style={[s.pill, { borderColor: c }]} accessibilityLabel={`Status: ${text}`}>
      <View style={[s.pillDot, { backgroundColor: c }]} />
      <Text style={[s.pillText, { color: c }]}>{text}</Text>
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={type.label}>{children}</Text>;
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={type.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={label}
        style={[s.input, props.multiline && { minHeight: 96, textAlignVertical: "top", paddingTop: 14 }, error ? { borderColor: colors.destructive } : null]}
        {...props}
      />
      {error ? <Text style={[type.small, { color: colors.destructive }]}>{error}</Text> : hint ? <Text style={type.small}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string; tone?: "success" | "danger" | "neutral" }[]; onChange: (v: T) => void; label?: string;
}) {
  return (
    <View style={s.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        const c = o.tone === "success" ? colors.success : o.tone === "danger" ? colors.destructive : colors.primary;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            accessibilityLabel={`${label ? label + ": " : ""}${o.label}`}
            style={({ pressed }) => [s.segment, on && { backgroundColor: c, borderColor: c }, pressed && { opacity: 0.8 }]}>
            <Text style={[s.segmentText, on && { color: colors.primaryForeground }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={type.small}>{label}</Text>
      {typeof value === "string" || typeof value === "number"
        ? <Text style={[mono ? type.mono : type.bodyStrong, { flexShrink: 1, textAlign: "right" }]}>{value}</Text> : value}
    </View>
  );
}

export function Banner({ tone, title, body, action }: { tone: "info" | "warning" | "danger" | "success"; title: string; body?: string; action?: React.ReactNode }) {
  const c = { info: colors.primary, warning: colors.warning, danger: colors.destructive, success: colors.success }[tone];
  const bg = { info: colors.primarySoft, warning: colors.warningSoft, danger: colors.destructiveSoft, success: colors.successSoft }[tone];
  return (
    <View style={[s.banner, { borderColor: c, backgroundColor: bg }]} accessibilityRole="alert">
      <Text style={[type.bodyStrong, { color: c }]}>{title}</Text>
      {body ? <Text style={[type.small, { color: colors.foreground }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function SyncBar({ sync, pending, onPress }: { sync: "online" | "offline" | "syncing" | "error"; pending: number; onPress?: () => void }) {
  if (sync === "online" && !pending) return null;
  const cfg = {
    offline: { c: colors.warning, icon: <WifiOff size={18} color={colors.warning} />, text: pending ? `Offline — ${pending} saved, will sync automatically` : "Offline — showing last saved work" },
    syncing: { c: colors.primary, icon: <RefreshCw size={18} color={colors.primary} />, text: pending ? `Syncing ${pending} update${pending === 1 ? "" : "s"}…` : "Syncing…" },
    error: { c: colors.destructive, icon: <AlertTriangle size={18} color={colors.destructive} />, text: "Sync problem — tap to review" },
    online: { c: colors.primary, icon: <CloudOff size={18} color={colors.primary} />, text: `${pending} waiting to sync` },
  }[sync];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={cfg.text} style={[s.syncBar, { borderColor: cfg.c }]}>
      {cfg.icon}
      <Text style={[type.small, { color: cfg.c, flex: 1 }]}>{cfg.text}</Text>
    </Pressable>
  );
}

export function Empty({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={s.empty}>
      {icon}
      <Text style={[type.heading, { textAlign: "center" }]}>{title}</Text>
      {body ? <Text style={[type.small, { textAlign: "center" }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={s.empty} accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={type.label}>{title}</Text>{right}
      </View>
      {children}
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollBody: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  footer: { padding: space.lg, paddingTop: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: { width: 34, height: 34, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  logoText: { fontFamily: fonts.bold, fontSize: 20, color: colors.foreground, letterSpacing: 0.5 },
  logoSub: { fontFamily: fonts.mono, fontSize: 12, color: colors.primary, letterSpacing: 1, textTransform: "uppercase", marginLeft: 2 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: radius.lg, paddingHorizontal: space.lg },
  glow: { shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  buttonText: { fontFamily: fonts.bold, letterSpacing: 0.3 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontFamily: fonts.semibold, fontSize: 13 },
  input: { minHeight: TOUCH, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.input, borderRadius: radius.lg, paddingHorizontal: 14, color: colors.foreground, fontFamily: fonts.regular, fontSize: 17 },
  segmented: { flexDirection: "row", gap: 8 },
  segment: { flex: 1, minHeight: TOUCH, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.input, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segmentText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.foreground },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md, minHeight: 28 },
  banner: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: 4 },
  syncBar: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md, minHeight: 44, backgroundColor: colors.card },
  empty: { alignItems: "center", justifyContent: "center", gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
});
