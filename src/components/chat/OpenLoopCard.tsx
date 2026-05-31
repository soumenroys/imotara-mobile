// src/components/chat/OpenLoopCard.tsx
// P1 — Emotional Open Loops: banner shown above input bar when a recurring
// unresolved theme is detected across 3+ conversation threads.

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ColorPalette } from "../../theme/colors";
import type { OpenLoop } from "../../lib/imotara/openLoops";

type Props = {
  loop: OpenLoop;
  colors: ColorPalette;
  onExplore: () => void;
  onDefer: () => void;
  onDismiss: () => void;
};

export function OpenLoopCard({ loop, colors, onExplore, onDefer, onDismiss }: Props) {
  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(251, 191, 36, 0.3)",
        backgroundColor: "rgba(251, 191, 36, 0.07)",
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <Ionicons name="infinite-outline" size={14} color="#fbbf24" style={{ marginRight: 6 }} />
        <Text style={{ fontSize: 10, fontWeight: "700", color: "#fbbf24", letterSpacing: 0.5, textTransform: "uppercase", flex: 1 }}>
          Open loop · {loop.themeName}
        </Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Prompt text */}
      <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 18, marginBottom: 8 }}>
        I've noticed <Text style={{ fontWeight: "600" }}>{loop.themeName}</Text> has come up across{" "}
        {loop.threadCount} conversations. Want to sit with it together?
      </Text>

      {/* Action buttons */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          onPress={onExplore}
          style={{
            flex: 1,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: "rgba(251,191,36,0.18)",
            borderWidth: 1,
            borderColor: "rgba(251,191,36,0.4)",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#fbbf24" }}>
            Open a thread for this
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDefer}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSoft,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
