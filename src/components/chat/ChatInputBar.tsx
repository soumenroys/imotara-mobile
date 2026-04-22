// src/components/chat/ChatInputBar.tsx
// Bottom input area for ChatScreen — text field, mic button, send button.

import React from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ColorPalette } from "../../theme/colors";

export type VoiceInputState = "idle" | "recording" | "transcribing";

type Props = {
  input: string;
  inputHeight: number;
  isSendDisabled: boolean;
  voiceState: VoiceInputState;
  voiceDurationMs: number;
  colors: ColorPalette;
  onChangeText: (text: string) => void;
  onContentSizeChange: (e: any) => void;
  onSend: () => void;
  onMicPress: () => void;
  firstTimeTip?: string | null;
};

export function ChatInputBar({
  input,
  inputHeight,
  isSendDisabled,
  voiceState,
  voiceDurationMs,
  colors,
  onChangeText,
  onContentSizeChange,
  onSend,
  onMicPress,
  firstTimeTip,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
        backgroundColor: "rgba(15, 23, 42, 0.98)",
      }}
    >
      {firstTimeTip ? (
        <Text
          style={{
            fontSize: 11,
            color: "rgba(148, 163, 184, 0.75)",
            textAlign: "center",
            marginBottom: 6,
            fontStyle: "italic",
          }}
        >
          {firstTimeTip}
        </Text>
      ) : null}
      {input.length > 800 && (
        <Text
          style={{
            fontSize: 10,
            textAlign: "right",
            marginBottom: 4,
            fontWeight: "600",
            color: input.length > 1800 ? "#f87171" : "#fbbf24",
          }}
        >
          {input.length} / 2000{input.length > 1800 ? " — approaching limit" : ""}
        </Text>
      )}

      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {/* Text field */}
        <View
          style={{
            flex: 1,
            marginRight: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "rgba(15, 23, 42, 1)",
            paddingHorizontal: 12,
            paddingVertical: 6,
            minHeight: 40,
            justifyContent: "center",
          }}
        >
          <TextInput
            value={input}
            onChangeText={onChangeText}
            multiline
            onContentSizeChange={onContentSizeChange}
            placeholder={
              voiceState === "recording"
                ? `Recording… ${Math.round(voiceDurationMs / 1000)}s`
                : voiceState === "transcribing"
                ? "Transcribing voice…"
                : firstTimeTip
                ? "Try: 'I've been feeling anxious about work lately'"
                : "Type something you feel…"
            }
            editable={voiceState === "idle"}
            placeholderTextColor={
              voiceState === "recording"
                ? "rgba(239,68,68,0.9)"
                : "rgba(148, 163, 184, 0.9)"
            }
            accessibilityLabel="Type your message"
            accessibilityHint="Send a message to Imotara"
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              maxHeight: 120,
              minHeight: inputHeight,
            }}
          />
        </View>

        {/* Mic button */}
        <TouchableOpacity
          onPress={onMicPress}
          disabled={voiceState === "transcribing"}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor:
              voiceState === "recording"
                ? "rgba(239,68,68,0.2)"
                : colors.surfaceSoft,
            borderWidth: 1,
            borderColor:
              voiceState === "recording"
                ? "rgba(239,68,68,0.6)"
                : colors.border,
            marginRight: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityLabel={
            voiceState === "recording" ? "Stop recording" : "Start voice input"
          }
          accessibilityRole="button"
          accessibilityHint={voiceState === "recording" ? "Tap to stop and transcribe" : "Tap to record your message"}
        >
          {voiceState === "transcribing" ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Ionicons
              name={voiceState === "recording" ? "stop-circle-outline" : "mic-outline"}
              size={18}
              color={voiceState === "recording" ? "rgba(239,68,68,0.9)" : colors.textPrimary}
            />
          )}
        </TouchableOpacity>

        {/* Send button */}
        <TouchableOpacity
          onPress={onSend}
          disabled={isSendDisabled}
          accessibilityLabel="Send message"
          accessibilityRole="button"
          style={{
            opacity: isSendDisabled ? 0.4 : 1,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
