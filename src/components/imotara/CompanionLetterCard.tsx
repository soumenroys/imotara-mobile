// src/components/imotara/CompanionLetterCard.tsx
// Shows a single companion letter with TTS, emoji reaction, and reply capability.

import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Alert, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ColorPalette } from "../../theme/colors";
import type { CompanionLetter } from "../../lib/imotara/companionLetter";
import { updateLetterInteraction } from "../../lib/imotara/companionLetter";
import { speakMessage, stopSpeaking } from "../../lib/tts/mobileTTS";
import { useAuth } from "../../auth/AuthContext";

const EMOJI_REACTIONS = ["❤️", "🥰", "💕", "💜", "💛", "🌟", "✨", "🫂", "🙏", "🕊️"];

type Props = {
  letter: CompanionLetter;
  colors: ColorPalette;
  companionGender?: string;
  lang?: string;
  onUpdate?: (updated: CompanionLetter) => void;
  defaultExpanded?: boolean;
};

export default function CompanionLetterCard({
  letter,
  colors,
  companionGender,
  lang = "en",
  onUpdate,
  defaultExpanded = false,
}: Props) {
  const { accessToken } = useAuth();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [speaking, setSpeaking] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [reaction, setReaction] = useState<string | undefined>(letter.reaction);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState(letter.reply ?? "");
  const [replySaved, setReplySaved] = useState(!!letter.reply);
  const [savingReply, setSavingReply] = useState(false);

  const dateLabel = new Date(letter.generatedAt).toLocaleDateString(undefined, {
    day: "numeric", month: "long", year: "numeric",
  });

  const handleTTS = useCallback(async () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    try {
      await speakMessage(
        `letter-${letter.id}`,
        letter.body,
        companionGender,
        lang,
        () => setSpeaking(false),
        1.0,
        1.0,
        accessToken ?? undefined,
      );
    } catch {
      setSpeaking(false);
      Alert.alert("Audio unavailable", "Could not play the letter. Please try again.");
    }
  }, [speaking, letter, companionGender, lang, accessToken]);

  const handleReact = useCallback(async (emoji: string) => {
    const next = reaction === emoji ? undefined : emoji;
    setReaction(next);
    setShowReactions(false);
    await updateLetterInteraction(letter.id, { reaction: next ?? null });
    onUpdate?.({ ...letter, reaction: next });
  }, [reaction, letter, onUpdate]);

  const handleSaveReply = useCallback(async () => {
    if (!replyText.trim()) return;
    setSavingReply(true);
    try {
      const now = Date.now();
      await updateLetterInteraction(letter.id, { reply: replyText.trim(), replyAt: now });
      onUpdate?.({ ...letter, reply: replyText.trim(), replyAt: now });
      setReplySaved(true);
      setReplyOpen(false);
    } catch {
      Alert.alert("Could not save reply. Please try again.");
    } finally {
      setSavingReply(false);
    }
  }, [replyText, letter, onUpdate]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: "rgba(167,139,250,0.25)" }]}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Text style={{ fontSize: 18 }}>💌</Text>
          <View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
              From {letter.companionName}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
              {dateLabel}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {reaction && <Text style={{ fontSize: 16 }}>{reaction}</Text>}
          {replySaved && <Ionicons name="return-down-back" size={14} color={colors.primary} style={{ marginLeft: 4 }} />}
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
            style={{ marginLeft: 6 }}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View>
          {/* Letter body */}
          <ScrollView
            style={[styles.body, { borderColor: colors.border }]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 22 }}>
              {letter.body}
            </Text>
          </ScrollView>

          {/* Action row */}
          <View style={styles.actions}>
            {/* TTS */}
            <TouchableOpacity
              onPress={handleTTS}
              style={[styles.actionBtn, { backgroundColor: speaking ? "rgba(99,102,241,0.2)" : colors.surfaceSoft, borderColor: speaking ? colors.primary : colors.border }]}
            >
              <Ionicons
                name={speaking ? "stop-circle" : "volume-high-outline"}
                size={16}
                color={speaking ? colors.primary : colors.textSecondary}
              />
              <Text style={{ fontSize: 11, color: speaking ? colors.primary : colors.textSecondary, marginLeft: 4 }}>
                {speaking ? "Stop" : "Listen"}
              </Text>
            </TouchableOpacity>

            {/* Reaction */}
            <TouchableOpacity
              onPress={() => setShowReactions((v) => !v)}
              style={[styles.actionBtn, { backgroundColor: colors.surfaceSoft, borderColor: colors.border }]}
            >
              <Text style={{ fontSize: 15 }}>{reaction ?? "🤍"}</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 4 }}>React</Text>
            </TouchableOpacity>

            {/* Reply */}
            <TouchableOpacity
              onPress={() => setReplyOpen((v) => !v)}
              style={[styles.actionBtn, { backgroundColor: replyOpen ? "rgba(99,102,241,0.15)" : colors.surfaceSoft, borderColor: replyOpen ? colors.primary : colors.border }]}
            >
              <Ionicons name="return-down-back" size={15} color={replyOpen ? colors.primary : colors.textSecondary} />
              <Text style={{ fontSize: 11, color: replyOpen ? colors.primary : colors.textSecondary, marginLeft: 4 }}>
                {replySaved ? "Edit reply" : "Write reply"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Emoji reaction picker */}
          {showReactions && (
            <View style={[styles.reactionPicker, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {EMOJI_REACTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => handleReact(emoji)}
                    style={[
                      styles.reactionEmoji,
                      reaction === emoji && { backgroundColor: "rgba(99,102,241,0.2)", borderColor: colors.primary, borderWidth: 1 },
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Reply input */}
          {replyOpen && (
            <View style={[styles.replyBox, { borderColor: colors.border }]}>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                Your reply to {letter.companionName}:
              </Text>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder={`Write back to ${letter.companionName}…`}
                placeholderTextColor={colors.textSecondary}
                multiline
                style={[styles.replyInput, { color: colors.textPrimary, borderColor: colors.border }]}
                textAlignVertical="top"
              />
              <TouchableOpacity
                onPress={handleSaveReply}
                disabled={savingReply || !replyText.trim()}
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: replyText.trim() ? 1 : 0.4 }]}
              >
                {savingReply
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Save reply</Text>
                }
              </TouchableOpacity>
              {replySaved && (
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>
                  ✓ Reply saved · {letter.replyAt ? new Date(letter.replyAt).toLocaleDateString() : ""}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: "hidden",
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerRight: { flexDirection: "row", alignItems: "center" },
  body: {
    maxHeight: 280, paddingHorizontal: 16, paddingBottom: 12,
    borderTopWidth: 0.5,
  },
  actions: {
    flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 0.5, borderColor: "rgba(255,255,255,0.08)",
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  reactionPicker: {
    marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1,
  },
  reactionEmoji: {
    padding: 4, borderRadius: 8,
  },
  replyBox: {
    marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 12, borderWidth: 1,
  },
  replyInput: {
    minHeight: 80, padding: 10, borderRadius: 10, borderWidth: 1,
    fontSize: 13, lineHeight: 20, marginBottom: 10,
  },
  saveBtn: {
    paddingVertical: 10, borderRadius: 10, alignItems: "center",
  },
});
