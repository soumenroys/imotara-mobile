// src/components/chat/ChatInputBar.tsx
// Bottom input area for ChatScreen — text field, mic button, send button.

import React from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const paddingBottom = 8;
  const isPad = Platform.OS === "ios" && Platform.isPad;
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {/* iPad: center content in a max-width column so input doesn't span the full iPad width */}
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom,
          ...(isPad ? { maxWidth: 700, alignSelf: "center", width: "100%" } : {}),
        }}
      >
      {firstTimeTip ? (
        <Text
          style={{
            fontSize: 11,
            color: colors.textSecondary,
            textAlign: "center",
            marginBottom: 10,
            marginTop: 2,
            fontStyle: "italic",
            lineHeight: 16,
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
            flexShrink: 1,
            minWidth: 0,
            marginRight: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSoft,
            paddingHorizontal: 12,
            paddingVertical: 4,
            minHeight: 40,
            justifyContent: "center",
            overflow: "hidden",
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
            marginBottom: 0,
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
      </View>{/* end iPad centering wrapper */}
    </View>
  );
}
