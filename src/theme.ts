// MOViDO design tokens, taken from the live web app (www.movidologistics.uk,
// client/src/index.css): same near-black surfaces, cyan primary, borders,
// 8 px radius, Inter + JetBrains Mono. Sizes are scaled up for a phone used
// in a cab: 56 px primary buttons, 16 px minimum body text.

export const colors = {
  background: "#000001",
  backgroundEnd: "#000000",
  card: "#0b0c0e",
  cardRaised: "#111316",
  border: "#202224",
  borderStrong: "#2c2f33",
  input: "#0a0b0d",
  foreground: "#eeeeee",
  muted: "#151618",
  mutedForeground: "#8a8a8a",
  primary: "#00f1ec",
  primaryForeground: "#000001",
  primarySoft: "rgba(0, 241, 236, 0.12)",
  primaryBorder: "rgba(0, 241, 236, 0.45)",
  destructive: "#f94144",
  destructiveSoft: "rgba(249, 65, 68, 0.14)",
  warning: "#fe9a00",
  warningSoft: "rgba(254, 154, 0, 0.14)",
  success: "#00c951",
  successSoft: "rgba(0, 201, 81, 0.14)",
  info: "#2b7fff",
} as const;

export const radius = { sm: 4, md: 6, lg: 8, xl: 12, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  mono: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
} as const;

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, color: colors.foreground },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: colors.foreground },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.foreground },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.foreground },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.foreground },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" as const },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  mono: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 20, color: colors.foreground },
} as const;

/** Minimum touch target (Apple HIG 44, Material 48; larger for gloves/cab use). */
export const TOUCH = 52;

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  arrived: "Arrived",
};

export const statusTone = (s: string): "neutral" | "primary" | "success" | "warning" | "danger" =>
  s === "in_progress" || s === "arrived" ? "primary" : s === "completed" ? "success" : s === "cancelled" ? "danger" : s === "assigned" ? "warning" : "neutral";
