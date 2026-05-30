// src/components/imotara/FeatureDiscoveryCard.tsx
// Hourly rotating feature tip capsule shown in the Trends screen.

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../theme/ThemeContext";
import {
  getCurrentTip,
  advanceTip,
  prevTip,
  CATEGORY_COLORS,
  FEATURE_TIPS,
  type FeatureTip,
} from "../../data/featureTips";

type Props = {
  onDismiss: () => void;
};

export default function FeatureDiscoveryCard({ onDismiss }: Props) {
  const colors = useColors();
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

  const palette = CATEGORY_COLORS[tip.category];

  return (
    <Animated.View style={{ opacity: fadeAnim, marginHorizontal: 16, marginBottom: 16 }}>
      <View style={{
        borderRadius: 20, borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.bg,
        padding: 18,
      }}>
        {/* Header row: badge + counter + close */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <View style={{ backgroundColor: palette.badge, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: palette.text, textTransform: "uppercase", letterSpacing: 0.6 }}>
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
          {/* Emoji graphic */}
          <View style={{
            width: 64, height: 64, borderRadius: 18,
            backgroundColor: palette.badge,
            alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Text style={{ fontSize: 34 }}>{tip.emoji}</Text>
          </View>

          {/* Text */}
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 }}>
              {tip.title}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
              {tip.tip}
            </Text>
          </View>
        </View>

        {/* Navigation row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 14 }}>
          <TouchableOpacity
            onPress={goPrev}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: palette.border }}
          >
            <Ionicons name="chevron-back" size={14} color={palette.text} />
            <Text style={{ fontSize: 12, color: palette.text, fontWeight: "600" }}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goNext}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: palette.badge }}
          >
            <Text style={{ fontSize: 12, color: palette.text, fontWeight: "600" }}>Next tip</Text>
            <Ionicons name="chevron-forward" size={14} color={palette.text} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
