// src/components/imotara/UnsentLetterModal.tsx
// P4 — Unsent Letter / Shadow Voice: user writes a letter to someone they
// can't or won't send to; Imotara responds in that recipient's voice.

import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ColorPalette } from "../../theme/colors";

export type UnsentLetterSetup = {
  recipientName: string;
  relationship: string;
  context: string;
};

type Props = {
  visible: boolean;
  colors: ColorPalette;
  onStart: (setup: UnsentLetterSetup) => void;
  onCancel: () => void;
};

const RELATIONSHIP_OPTIONS = [
  "parent", "sibling", "partner", "ex-partner", "friend",
  "colleague", "child", "past self", "future self", "other",
];

export function UnsentLetterModal({ visible, colors, onStart, onCancel }: Props) {
  const [recipientName, setRecipientName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [context, setContext] = useState("");

  function handleStart() {
    if (!recipientName.trim()) return;
    onStart({
      recipientName: recipientName.trim(),
      relationship: relationship || "someone close",
      context: context.trim(),
    });
    setRecipientName("");
    setRelationship("");
    setContext("");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.99)",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 36,
            }}
          >
            {/* Handle */}
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 20 }} />

            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Ionicons name="pencil-outline" size={18} color="#a78bfa" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary, flex: 1 }}>
                Write an unsent letter
              </Text>
              <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 20, lineHeight: 17 }}>
              Write to someone you can't or won't send to. Imotara will respond in their voice.{"\n"}
              Stored locally — never synced unless you choose to.
            </Text>

            {/* Recipient name */}
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Who is this letter to?
            </Text>
            <TextInput
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="e.g. Mom, my younger self, Alex..."
              placeholderTextColor="rgba(148,163,184,0.5)"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.textPrimary,
                fontSize: 14,
                backgroundColor: "rgba(255,255,255,0.04)",
                marginBottom: 16,
              }}
            />

            {/* Relationship chips */}
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Relationship
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {RELATIONSHIP_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRelationship(r)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: relationship === r ? "rgba(167,139,250,0.6)" : colors.border,
                      backgroundColor: relationship === r ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <Text style={{ fontSize: 12, color: relationship === r ? "#a78bfa" : colors.textSecondary }}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Optional context */}
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Any context? (optional)
            </Text>
            <TextInput
              value={context}
              onChangeText={setContext}
              placeholder="e.g. They passed away last year. We never got to say goodbye."
              placeholderTextColor="rgba(148,163,184,0.5)"
              multiline
              numberOfLines={2}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.textPrimary,
                fontSize: 14,
                backgroundColor: "rgba(255,255,255,0.04)",
                marginBottom: 20,
                minHeight: 60,
                textAlignVertical: "top",
              }}
            />

            {/* Start button */}
            <TouchableOpacity
              onPress={handleStart}
              disabled={!recipientName.trim()}
              style={{
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: recipientName.trim() ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: recipientName.trim() ? "rgba(167,139,250,0.5)" : colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: recipientName.trim() ? "#a78bfa" : colors.textSecondary }}>
                Begin writing
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Prompt builder ────────────────────────────────────────────────────────────

export function buildUnsentLetterSystemPrompt(setup: UnsentLetterSetup): string {
  return [
    `You are now responding AS ${setup.recipientName}, the user's ${setup.relationship}.`,
    setup.context ? `Context about this person and their relationship: ${setup.context}` : "",
    `The user has written you a letter. Respond in first person as ${setup.recipientName}.`,
    `Draw on everything the user has shared in their message about your relationship.`,
    `Be emotionally honest, warm, and human. Do NOT break character or refer to yourself as an AI.`,
    `Your response is what ${setup.recipientName} might truly have said — with the love, pain, regret, or pride they carried.`,
    `Keep your response to 2–4 paragraphs. No greetings like "Dear..." — just speak directly.`,
  ].filter(Boolean).join(" ");
}
