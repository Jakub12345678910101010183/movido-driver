// MESSAGES — one conversation with the office, plus office broadcasts.
// Sending is idempotent (request id), so a resend after a dropped connection
// never duplicates. Opening the screen marks office messages as read.
import { useFocusEffect } from "expo-router";
import { Megaphone, Send } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Message } from "../../src/core/types.ts";
import { formatClock } from "../../src/services/navigation";
import { useApp } from "../../src/state/AppContext";
import { Empty, SyncBar } from "../../src/ui";
import { colors, fonts, radius, space, TOUCH, type } from "../../src/theme";

type Row = Message & { pending?: boolean };

export default function Messages() {
  const { messages, session, profile, act, refreshMessages, outboxItems, sync } = useApp();
  const [text, setText] = useState("");
  const list = useRef<FlatList<Row>>(null);
  const uid = session?.user.id;

  // Messages still in the outbox are shown as "sending".
  const all = useMemo<Row[]>(() => {
    const queued = outboxItems.filter((i) => i.action.kind === "message").map((i) => ({
      id: -1, sender_id: uid ?? "", recipient_id: "dispatch", channel: "driver" as const,
      content: (i.action as { content: string }).content, read: true, created_at: i.createdAt, organization_id: "",
      client_request_id: i.id, pending: true,
    }));
    const sent = new Set(messages.map((m) => m.client_request_id).filter(Boolean));
    return [...messages.map((m) => ({ ...m, pending: false })), ...queued.filter((q) => !sent.has(q.client_request_id))];
  }, [messages, outboxItems, uid]);

  useFocusEffect(useCallback(() => {
    const unreadIds = messages.filter((m) => !m.read && m.recipient_id === uid && m.id > 0).map((m) => m.id);
    if (unreadIds.length) void act({ kind: "read_messages", ids: unreadIds }).then(() => refreshMessages());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]));

  const send = async () => {
    const content = text.trim();
    if (!content || !uid || !profile) return;
    setText("");
    await act({ kind: "message", content, senderId: uid, organizationId: profile.organization.id });
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}>
        <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.sm }}>
          <Text style={type.title}>Office</Text>
          <SyncBar sync={sync} pending={outboxItems.filter((i) => i.state === "pending").length} />
        </View>
        <FlatList
          ref={list}
          data={all}
          keyExtractor={(m, i) => `${m.id}-${m.client_request_id ?? i}`}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Empty title="No messages yet" body="Messages from your office appear here. You can message the office any time." />}
          renderItem={({ item: m }) => {
            const mine = m.sender_id === uid;
            const broadcast = m.recipient_id === "broadcast";
            const urgent = m.channel === "alert";
            return (
              <View style={{ alignItems: mine ? "flex-end" : "flex-start" }} accessible
                accessibilityLabel={`${mine ? "You" : broadcast ? "Office broadcast" : "Office"}${urgent ? ", urgent" : ""}: ${m.content}. ${formatClock(m.created_at)}${m.pending ? ", sending" : ""}`}>
                <View style={{ maxWidth: "85%", borderRadius: radius.xl, padding: space.md, gap: 4, borderWidth: 1,
                  backgroundColor: mine ? colors.primarySoft : urgent ? colors.destructiveSoft : colors.card,
                  borderColor: mine ? colors.primaryBorder : urgent ? colors.destructive : colors.border }}>
                  {!mine ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {broadcast ? <Megaphone size={14} color={urgent ? colors.destructive : colors.warning} /> : null}
                      <Text style={[type.label, urgent && { color: colors.destructive }]}>{urgent ? "Urgent · " : ""}{broadcast ? "Broadcast" : "Office"}</Text>
                    </View>
                  ) : null}
                  <Text style={type.body}>{m.content}</Text>
                  <Text style={[type.small, { fontSize: 12 }]}>{m.pending ? "Sending…" : formatClock(m.created_at)}{mine && !m.pending ? " · sent" : ""}</Text>
                </View>
              </View>
            );
          }}
        />
        <View style={{ flexDirection: "row", gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card }}>
          <TextInput value={text} onChangeText={setText} placeholder="Message the office…" placeholderTextColor={colors.mutedForeground}
            accessibilityLabel="Message to the office" multiline maxLength={2000}
            style={{ flex: 1, minHeight: TOUCH, maxHeight: 120, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, paddingHorizontal: 14, paddingTop: 14, color: colors.foreground, fontFamily: fonts.regular, fontSize: 17, backgroundColor: colors.input }} />
          <Pressable onPress={() => void send()} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel="Send message"
            style={({ pressed }) => [{ width: TOUCH + 4, minHeight: TOUCH, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }, !text.trim() && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}>
            <Send size={22} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
