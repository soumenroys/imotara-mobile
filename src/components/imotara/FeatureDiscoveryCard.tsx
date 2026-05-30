// src/components/imotara/FeatureDiscoveryCard.tsx
// One-hour rotating feature tip capsule shown in the Chat screen.

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
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
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
    <Animated.View style={{ opacity: fadeAnim, marginHorizontal: 12, marginBottom: 6 }}>
      <View style={{
        borderRadius: 16, borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.bg,
        paddingHorizontal: 14, paddingVertical: 10,
        flexDirection: "row", alignItems: "center", gap: 12,
      }}>
        {/* Emoji graphic */}
        <View style={{
          width: 48, height: 48, borderRadius: 14,
          backgroundColor: palette.badge,
          alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Text style={{ fontSize: 26 }}>{tip.emoji}</Text>
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <View style={{ backgroundColor: palette.badge, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: "700", color: palette.text, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Discover
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 }} numberOfLines={1}>
            {tip.title}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }} numberOfLines={2}>
            {tip.tip}
          </Text>
        </View>

        {/* Controls */}
        <View style={{ flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}>
            <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 2 }}>
            <TouchableOpacity onPress={goPrev} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Ionicons name="chevron-back" size={14} color={palette.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={goNext} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Ionicons name="chevron-forward" size={14} color={palette.text} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 8, color: colors.textSecondary }}>
            {index + 1}/{FEATURE_TIPS.length}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
