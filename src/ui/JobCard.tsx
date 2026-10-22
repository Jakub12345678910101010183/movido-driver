import { ChevronRight, Clock, MapPin } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import { nextDestination, stopCounts } from "../core/stops.ts";
import type { Job } from "../core/types.ts";
import { colors, fonts, type } from "../theme";
import { Card, Pill } from "./index";
import { dateLocale, t, type Key } from "../i18n/index.ts";

export const scheduleLabel = (d: string | null) => {
  if (!d) return t("date.unscheduled");
  const day = new Date(d + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return t("date.today");
  if (diff === 1) return t("date.tomorrow");
  if (diff === -1) return t("date.yesterday");
  return day.toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" });
};

export function JobCard({ job, pending, onPress }: { job: Job; pending?: boolean; onPress: () => void }) {
  const next = nextDestination(job);
  const { total, done } = stopCounts(job);
  const label = t("jobs.cardA11y", { ref: job.reference, customer: job.customer, status: t(`status.${job.status}` as Key) })
    + (next ? t("jobs.cardNextA11y", { label: next.label, address: next.address }) : "");
  return (
    <Card onPress={onPress} accessibilityLabel={label} tone={job.status === "in_progress" ? "primary" : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ fontFamily: fonts.monoBold, fontSize: 16, color: colors.primary }}>{job.reference}</Text>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {job.priority === "urgent" || job.priority === "high" ? <Pill label={t(job.priority === "urgent" ? "priority.urgent" : "priority.high")} tone="danger" /> : null}
          <Pill status={job.status} />
        </View>
      </View>
      <Text style={type.heading} numberOfLines={1}>{job.customer}</Text>
      {next && job.status !== "completed" ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <MapPin size={18} color={colors.mutedForeground} style={{ marginTop: 2 }} />
          <Text style={[type.body, { flex: 1 }]} numberOfLines={2}><Text style={{ color: colors.mutedForeground }}>{next.label}: </Text>{next.address}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Clock size={15} color={colors.mutedForeground} />
          <Text style={type.small}>{scheduleLabel(job.scheduled_date)}</Text>
        </View>
        {total ? <Text style={type.small}>{t("jobs.stopsCount", { done, total })}</Text> : null}
        {pending ? <Text style={[type.small, { color: colors.warning }]}>{t("jobs.waitingSync")}</Text> : null}
        <View style={{ flex: 1 }} />
        <ChevronRight size={20} color={colors.mutedForeground} />
      </View>
    </Card>
  );
}
