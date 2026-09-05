// src/components/ui/Skeleton.tsx
// Placeholder blocks for content that has not arrived yet (UX-29).
//
// Mobile had 58 ActivityIndicators and no skeletons: every wait was a blank
// screen with a spinner in the middle of it. Measured on the emulator, the
// Connect companion list takes 0.9-2.6s to come back, so that blank screen is
// what someone looks at for up to two and a half seconds.
//
// A skeleton is not a prettier spinner. It says "a list of cards is coming and
// here is roughly where they will be", so the content arriving is a fill-in
// rather than a jump. That only holds if the placeholder matches the real
// layout, which is why the Connect skeleton below mirrors the actual card
// (56px avatar, same padding, same radius) instead of being generic bars.

import React, { useEffect, useRef } from "react";
import { Animated, View, type ViewStyle } from "react-native";
import { useTheme, useColors } from "../../theme/ThemeContext";
import { shouldLoopDecoration } from "../../lib/a11y/reduceMotion";

/** One placeholder block. */
export function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const { reduceMotion } = useTheme();
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    // The pulse is decoration. Someone who has asked the system to reduce
    // motion gets a still block — which still communicates the shape, because
    // the shape is the point, not the movement.
    if (!shouldLoopDecoration(reduceMotion)) {
      pulse.setValue(0.55);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      // A placeholder is not content. Announcing "blank blank blank" to a
      // screen reader while waiting is worse than saying nothing.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.border, opacity: pulse },
        style,
      ]}
    />
  );
}

/**
 * A stand-in for one companion card, shaped like the real one so the swap is a
 * fill-in rather than a jump.
 */
export function ConnectCardSkeleton() {
  const colors = useColors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        backgroundColor: colors.surfaceSoft,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
        flexDirection: "row",
        gap: 12,
      }}
    >
      <Skeleton width={56} height={56} radius={28} />
      <View style={{ flex: 1, gap: 8, paddingTop: 2 }}>
        <Skeleton width="60%" height={15} />
        <Skeleton width="40%" height={12} />
        <Skeleton width="85%" height={12} />
      </View>
    </View>
  );
}

/** The whole browse list while it loads. */
export function ConnectListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // One live-region announcement for the whole wait, rather than silence.
      accessible={false}
      style={{ paddingHorizontal: 16, paddingTop: 8 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <ConnectCardSkeleton key={i} />
      ))}
    </View>
  );
}
