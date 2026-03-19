// src/components/ui/Toast.tsx
// Lightweight, zero-dependency toast for non-intrusive error / info messages.
// Usage:
//   const toast = useRef<ToastHandle>(null);
//   <Toast ref={toast} />
//   toast.current?.show("Sync failed — check your connection.", "error");

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

export type ToastKind = "error" | "info" | "success";

export type ToastHandle = {
  show: (message: string, kind?: ToastKind) => void;
};

const COLORS: Record<ToastKind, { bg: string; border: string; text: string }> = {
  error:   { bg: "rgba(239,68,68,0.14)",  border: "rgba(239,68,68,0.55)",   text: "#fca5a5" },
  info:    { bg: "rgba(56,189,248,0.12)",  border: "rgba(56,189,248,0.45)",  text: "#7dd3fc" },
  success: { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.45)",   text: "#86efac" },
};

const ICONS: Record<ToastKind, string> = {
  error: "⚠",
  info: "ℹ",
  success: "✓",
};

export const Toast = forwardRef<ToastHandle>(function Toast(_, ref) {
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<ToastKind>("error");
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    show(msg: string, k: ToastKind = "error") {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      setKind(k);

      // Slide in
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();

      // Auto-dismiss after 3.5s
      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 12, duration: 280, useNativeDriver: true }),
        ]).start();
      }, 3500);
    },
  }));

  const c = COLORS[kind];

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: 90,
        left: 16,
        right: 16,
        opacity,
        transform: [{ translateY }],
        zIndex: 9999,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.bg,
        }}
      >
        <Text style={{ fontSize: 13, color: c.text }}>{ICONS[kind]}</Text>
        <Text style={{ fontSize: 13, color: c.text, flex: 1, lineHeight: 18 }}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
});
