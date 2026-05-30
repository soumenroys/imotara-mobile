// src/components/imotara/FeatureDiscoveryCard.tsx
// Hourly rotating feature tip capsule shown in the Trends screen.

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";
import {
  getCurrentTip,
  advanceTip,
  prevTip,
  FEATURE_TIPS,
  type FeatureTip,
  type TipCategory,
} from "../../data/featureTips";

type Props = {
  onDismiss: () => void;
};

// Theme-aware color sets — light mode uses dark text for readability
type Palette = { bg: string; border: string; text: string; badge: string };

function getPalette(category: TipCategory, isDark: boolean): Palette {
  const dark: Record<TipCategory, Palette> = {
    chat:      { bg: "rgba(139,92,246,0.14)", border: "rgba(139,92,246,0.32)", text: "#c4b5fd", badge: "rgba(139,92,246,0.28)" },
    voice:     { bg: "rgba(14,165,233,0.13)",  border: "rgba(14,165,233,0.30)",  text: "#7dd3fc", badge: "rgba(14,165,233,0.24)" },
    growth:    { bg: "rgba(16,185,129,0.13)",  border: "rgba(16,185,129,0.30)",  text: "#6ee7b7", badge: "rgba(16,185,129,0.24)" },
    companion: { bg: "rgba(236,72,153,0.13)",  border: "rgba(236,72,153,0.30)",  text: "#f9a8d4", badge: "rgba(236,72,153,0.24)" },
    privacy:   { bg: "rgba(99,102,241,0.13)",  border: "rgba(99,102,241,0.30)",  text: "#a5b4fc", badge: "rgba(99,102,241,0.24)" },
    settings:  { bg: "rgba(100,116,139,0.13)", border: "rgba(100,116,139,0.30)", text: "#cbd5e1", badge: "rgba(100,116,139,0.24)" },
  };
  const light: Record<TipCategory, Palette> = {
    chat:      { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.25)", text: "#6d28d9", badge: "rgba(139,92,246,0.14)" },
    voice:     { bg: "rgba(14,165,233,0.08)",  border: "rgba(14,165,233,0.25)",  text: "#0369a1", badge: "rgba(14,165,233,0.14)" },
    growth:    { bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)",  text: "#047857", badge: "rgba(16,185,129,0.14)" },
    companion: { bg: "rgba(236,72,153,0.08)",  border: "rgba(236,72,153,0.25)",  text: "#be185d", badge: "rgba(236,72,153,0.14)" },
    privacy:   { bg: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.25)",  text: "#4338ca", badge: "rgba(99,102,241,0.14)" },
    settings:  { bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.25)", text: "#334155", badge: "rgba(100,116,139,0.14)" },
  };
  return isDark ? dark[category] : light[category];
}

export default function FeatureDiscoveryCard({ onDismiss }: Props) {
  const { colors, isDark } = useTheme();
  const [tip, setTip] = useState<FeatureTip | null>(null);
  const [index, setIndex] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const fadeIn = useCallback(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    getCurrentTip().then(({ tip: t, index: i }) => {
      setTip(t);
      setIndex(i);
      fadeIn();
    });
  }, [fadeIn]);

  const goNext = useCallback(async () => {
    const { tip: t, index: i } = await advanceTip(index);
    setTip(t);
    setIndex(i);
    fadeIn();
  }, [index, fadeIn]);

  const goPrev = useCallback(async () => {
    const { tip: t, index: i } = await prevTip(index);
    setTip(t);
    setIndex(i);
    fadeIn();
  }, [index, fadeIn]);

  if (!tip) return null;

  const p = getPalette(tip.category, isDark);

  return (
    <Animated.View style={{ opacity: fadeAnim, marginHorizontal: 16, marginBottom: 16 }}>
      <View style={{
        borderRadius: 20, borderWidth: 1,
        borderColor: p.border,
        backgroundColor: p.bg,
        padding: 18,
      }}>
        {/* Header: badge + counter + close */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <View style={{ backgroundColor: p.badge, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: p.text, textTransform: "uppercase", letterSpacing: 0.6 }}>
              ✦ Discover Imotara
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
              {index + 1} / {FEATURE_TIPS.length}
            </Text>
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Body: emoji + text */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 18,
            backgroundColor: p.badge,
            alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Text style={{ fontSize: 34 }}>{tip.emoji}</Text>
          </View>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 }}>
              {tip.title}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
              {tip.tip}
            </Text>
          </View>
        </View>

        {/* Navigation */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <TouchableOpacity
            onPress={goPrev}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              paddingHorizontal: 14, paddingVertical: 7,
              borderRadius: 99, borderWidth: 1, borderColor: p.border,
            }}
          >
            <Ionicons name="chevron-back" size={14} color={p.text} />
            <Text style={{ fontSize: 13, color: p.text, fontWeight: "600" }}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goNext}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              paddingHorizontal: 14, paddingVertical: 7,
              borderRadius: 99, backgroundColor: p.badge,
            }}
          >
            <Text style={{ fontSize: 13, color: p.text, fontWeight: "600" }}>Next tip</Text>
            <Ionicons name="chevron-forward" size={14} color={p.text} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
