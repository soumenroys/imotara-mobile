// src/components/chat/DiscoveryCard.tsx
// Non-intrusive feature discovery card shown above the input bar after the
// user's first conversation (3+ turns). One card per app session, each
// dismissed permanently. Cards cycle in order until all are dismissed.

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ColorPalette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";

export type DiscoveryCardId = "trends" | "companion" | "offline" | "unsent_letter";

type Props = {
  cardId: DiscoveryCardId;
  colors: ColorPalette;
  onDismiss: () => void;
  onAction: () => void;
};

const CARD_CONTENT: Record<DiscoveryCardId, { icon: string; message: string; action: string }> = {
  trends: {
    icon: "bar-chart-outline",
    message: "Your mood over time",
    action: "See Trends →",
  },
  companion: {
    icon: "person-circle-outline",
    message: "Personalize your companion's name and tone",
    action: "Open Settings →",
  },
  offline: {
    icon: "cloud-offline-outline",
    message: "Imotara replies even without internet — local mode is always on",
    action: "Got it",
  },
  unsent_letter: {
    icon: "mail-open-outline",
    message: "Write to someone you can't reach — the Unsent Letter space is here for you",
    action: "Try it →",
  },
};

export function DiscoveryCard({ cardId, colors, onDismiss, onAction }: Props) {
  const { isDark } = useTheme();
  const { icon, message, action } = CARD_CONTENT[cardId];

  const textColor   = isDark ? "rgba(196,207,255,0.85)" : "#3730a3";
  const actionColor = isDark ? "rgba(165,180,252,1)"    : "#4338ca";
  const iconColor   = isDark ? "rgba(165,180,252,0.85)" : "#4338ca";
  const bg          = isDark ? "rgba(99,102,241,0.10)"  : "rgba(99,102,241,0.08)";
  const border      = isDark ? "rgba(99,102,241,0.25)"  : "rgba(99,102,241,0.35)";

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Ionicons name={icon as any} size={16} color={iconColor} />
      <Text style={{ flex: 1, fontSize: 11.5, color: textColor, lineHeight: 16 }}>
        {message}
      </Text>
      <TouchableOpacity onPress={onAction} accessibilityRole="button">
        <Text style={{ fontSize: 11, color: actionColor, fontWeight: "700" }}>
          {action}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDismiss}
        accessibilityLabel="Dismiss tip"
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

// ── Storage helpers ──────────────────────────────────────────────────────────

export const DISCOVERY_CARDS_KEY = "imotara.onboarding.discovery.v1";
export const CARD_ORDER: DiscoveryCardId[] = ["trends", "companion", "offline", "unsent_letter"];

export function getNextCard(dismissed: DiscoveryCardId[]): DiscoveryCardId | null {
  return CARD_ORDER.find((id) => !dismissed.includes(id)) ?? null;
}
