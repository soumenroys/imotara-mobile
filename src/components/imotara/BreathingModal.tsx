// src/components/imotara/BreathingModal.tsx
// Animated breathing exercise modal — 3 patterns, no external dependencies.

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Vibration,
  Pressable,
} from "react-native";
import { useColors } from "../../theme/ThemeContext";

type Pattern = {
  name: string;
  description: string;
  phases: { label: string; seconds: number; color: string }[];
};

const PATTERNS: Pattern[] = [
  {
    name: "Box Breathing",
    description: "Calm your nervous system",
    phases: [
      { label: "Inhale", seconds: 4, color: "rgba(56, 189, 248, 0.30)" },
      { label: "Hold", seconds: 4, color: "rgba(147, 51, 234, 0.25)" },
      { label: "Exhale", seconds: 4, color: "rgba(16, 185, 129, 0.25)" },
      { label: "Hold", seconds: 4, color: "rgba(147, 51, 234, 0.25)" },
    ],
  },
  {
    name: "4-7-8 Calm",
    description: "Reduce anxiety quickly",
    phases: [
      { label: "Inhale", seconds: 4, color: "rgba(56, 189, 248, 0.30)" },
      { label: "Hold", seconds: 7, color: "rgba(147, 51, 234, 0.25)" },
      { label: "Exhale", seconds: 8, color: "rgba(16, 185, 129, 0.25)" },
    ],
  },
  {
    name: "Simple Breath",
    description: "Gentle reset, anytime",
    phases: [
      { label: "Inhale", seconds: 4, color: "rgba(56, 189, 248, 0.30)" },
      { label: "Exhale", seconds: 6, color: "rgba(16, 185, 129, 0.25)" },
    ],
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function BreathingModal({ visible, onClose }: Props) {
  const colors = useColors();
  const [selectedPattern, setSelectedPattern] = useState(0);
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cycles, setCycles] = useState(0);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const pattern = PATTERNS[selectedPattern];

  const stopExercise = useCallback(() => {
    setRunning(false);
    setPhaseIndex(0);
    setSecondsLeft(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animRef.current) animRef.current.stop();
    scaleAnim.setValue(1);
    opacityAnim.setValue(0.6);
  }, [scaleAnim, opacityAnim]);

  const startPhase = useCallback(
    (pIdx: number) => {
      const phase = pattern.phases[pIdx];
      setPhaseIndex(pIdx);
      setSecondsLeft(phase.seconds);

      // Breathing animation
      if (animRef.current) animRef.current.stop();
      const isInhale = phase.label === "Inhale";
      const isExhale = phase.label === "Exhale";
      const toScale = isInhale ? 1.4 : isExhale ? 0.85 : 1.1;
      const toOpacity = isInhale ? 1 : isExhale ? 0.4 : 0.7;

      animRef.current = Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: toScale,
          duration: phase.seconds * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: toOpacity,
          duration: phase.seconds * 1000,
          useNativeDriver: true,
        }),
      ]);
      animRef.current.start();

      try { Vibration.vibrate(8); } catch {}
    },
    [pattern, scaleAnim, opacityAnim],
  );

  const startExercise = useCallback(() => {
    setRunning(true);
    setCycles(0);
    startPhase(0);
  }, [startPhase]);

  // Countdown timer
  useEffect(() => {
    if (!running) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Advance phase
          setPhaseIndex((curPhase) => {
            const nextPhase = (curPhase + 1) % pattern.phases.length;
            if (nextPhase === 0) setCycles((c) => c + 1);
            // Start next phase on next tick to avoid stale closure
            setTimeout(() => startPhase(nextPhase), 0);
            return nextPhase;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, pattern, startPhase]);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) stopExercise();
  }, [visible, stopExercise]);

  const currentPhase = pattern.phases[phaseIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => { stopExercise(); onClose(); }}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
        onPress={() => { stopExercise(); onClose(); }}
      >
        <Pressable
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.98)",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 36,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
              Breathing Exercise
            </Text>
            <TouchableOpacity
              onPress={() => { stopExercise(); onClose(); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ fontSize: 18, color: colors.textSecondary }}>x</Text>
            </TouchableOpacity>
          </View>

          {/* Pattern selector */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
            {PATTERNS.map((p, i) => (
              <TouchableOpacity
                key={p.name}
                onPress={() => { if (!running) setSelectedPattern(i); }}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: selectedPattern === i ? colors.primary : colors.border,
                  backgroundColor: selectedPattern === i
                    ? "rgba(56, 189, 248, 0.12)"
                    : "rgba(30, 41, 59, 0.5)",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: selectedPattern === i ? colors.primary : colors.textSecondary, textAlign: "center" }}>
                  {p.name}
                </Text>
                <Text style={{ fontSize: 9, color: colors.textSecondary, textAlign: "center", marginTop: 2 }}>
                  {p.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Breathing circle */}
          <View style={{ alignItems: "center", marginVertical: 20 }}>
            <Animated.View
              style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: running ? currentPhase.color : "rgba(148,163,184,0.15)",
                borderWidth: 2,
                borderColor: running ? colors.primary : colors.border,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              }}
            >
              <Text style={{ fontSize: 28, color: colors.textPrimary, fontWeight: "700" }}>
                {running ? secondsLeft || "" : ""}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 4, opacity: 0.8 }}>
                {running ? currentPhase.label : "Ready"}
              </Text>
            </Animated.View>

            {cycles > 0 && (
              <Text style={{ marginTop: 12, fontSize: 12, color: colors.textSecondary }}>
                {cycles} {cycles === 1 ? "cycle" : "cycles"} completed
              </Text>
            )}
          </View>

          {/* Phase guide */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 24 }}>
            {pattern.phases.map((ph, i) => (
              <View key={`${ph.label}-${i}`} style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: running && i === phaseIndex ? colors.primary : colors.border,
                    marginBottom: 4,
                  }}
                />
                <Text style={{ fontSize: 10, color: running && i === phaseIndex ? colors.textPrimary : colors.textSecondary }}>
                  {ph.label} {ph.seconds}s
                </Text>
              </View>
            ))}
          </View>

          {/* Control button */}
          <TouchableOpacity
            onPress={running ? stopExercise : startExercise}
            style={{
              backgroundColor: running ? "rgba(239, 68, 68, 0.18)" : "rgba(56, 189, 248, 0.18)",
              borderWidth: 1,
              borderColor: running ? "rgba(239, 68, 68, 0.5)" : colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: running ? "#fca5a5" : colors.primary }}>
              {running ? "Stop" : "Start Breathing"}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
