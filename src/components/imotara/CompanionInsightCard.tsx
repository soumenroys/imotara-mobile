// src/components/imotara/CompanionInsightCard.tsx
// Shared card for P3 (Companion's Letter) and P5 (Emotional Arc Narrative).

import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ColorPalette } from "../../theme/colors";

export type InsightCardVariant = "letter" | "arc";

type Props = {
  variant: InsightCardVariant;
  title: string;
  body: string;
  colors: ColorPalette;
  onDismiss: () => void;
};

const CONFIG: Record<InsightCardVariant, {
  icon: string;
  label: string;
  borderColor: string;
  bgColor: string;
  accentColor: string;
}> = {
  letter: {
    icon: "mail-outline",
    label: "Monthly letter",
    borderColor: "rgba(99,102,241,0.3)",
    bgColor: "rgba(99,102,241,0.07)",
    accentColor: "#a5b4fc",
  },
  arc: {
    icon: "book-outline",
    label: "Your emotional arc",
    borderColor: "rgba(52,211,153,0.3)",
    bgColor: "rgba(52,211,153,0.07)",
    accentColor: "#6ee7b7",
  },
};

export function CompanionInsightCard({ variant, title, body, colors, onDismiss }: Props) {
  const cfg = CONFIG[variant];
  const paragraphs = body.split(/\n\n+/).filter(Boolean);

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: cfg.borderColor,
        backgroundColor: cfg.bgColor,
        paddingHorizontal: 14,
        paddingVertical: 14,
        maxHeight: 320,
      }}
    >
      {/* Badge row */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: cfg.borderColor, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(255,255,255,0.04)" }}>
          <Ionicons name={cfg.icon as any} size={11} color={cfg.accentColor} />
          <Text style={{ fontSize: 9, fontWeight: "700", color: cfg.accentColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {cfg.label}
          </Text>
        </View>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: "auto" }}>
          <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary, marginBottom: 8 }}>
        {title}
      </Text>

      {/* Body */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {paragraphs.map((para, i) => (
          <Text
            key={i}
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              lineHeight: 20,
              marginBottom: i < paragraphs.length - 1 ? 10 : 0,
            }}
          >
            {para}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}
