// src/components/imotara/OnboardingModal.tsx
// 2-step first-launch onboarding — sets name and companion relationship.

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../../theme/ThemeContext";
import type { ColorPalette } from "../../theme/colors";

type Relationship =
  | "prefer_not"
  | "friend"
  | "mentor"
  | "elder"
  | "coach"
  | "sibling"
  | "junior_buddy"
  | "parent_like"
  | "partner_like";

export type OnboardingResult = {
  name: string;
  relationship: Relationship;
  analysisMode: "cloud";
};

const RELATIONSHIPS: { value: Relationship; label: string; description: string }[] = [
  { value: "friend", label: "Friend", description: "Warm, casual, checks in on you" },
  { value: "mentor", label: "Mentor", description: "Wise, thoughtful guidance" },
  { value: "elder", label: "Elder", description: "Gentle, experienced perspective" },
  { value: "coach", label: "Coach", description: "Focused, helps you take action" },
  { value: "sibling", label: "Sibling", description: "Playful, honest, got your back" },
  { value: "parent_like", label: "Parent-like", description: "Nurturing, caring, protective" },
  { value: "partner_like", label: "Partner-like", description: "Close, deeply attuned" },
  { value: "prefer_not", label: "Just Imotara", description: "Neutral companion style" },
];


type Props = {
  visible: boolean;
  onComplete: (result: OnboardingResult) => void;
};

export function OnboardingModal({ visible, onComplete }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<Relationship>("friend");

  const totalSteps = 2;

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      // Default to cloud — user can switch to local in Settings at any time.
      onComplete({ name: name.trim(), relationship, analysisMode: "cloud" });
    }
  };

  const stepContent = [
    // Step 0 — Name
    <View key="name" style={{ flex: 1 }}>
      <Text style={styles.stepLabel}>Step 1 of 2</Text>
      <Text style={styles.heading}>{"What\u2019s your name?"}</Text>
      <Text style={styles.subheading}>
        Imotara will use this to greet you. You can change it anytime in Settings.
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name (optional)"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        autoFocus
        returnKeyType="next"
        onSubmitEditing={handleNext}
      />
    </View>,

    // Step 1 — Companion relationship
    <View key="relationship" style={{ flex: 1 }}>
      <Text style={styles.stepLabel}>Step 2 of 2</Text>
      <Text style={styles.heading}>Who should Imotara be to you?</Text>
      <Text style={styles.subheading}>
        This shapes how Imotara responds — tone, warmth, and style.
      </Text>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {RELATIONSHIPS.map((r) => (
          <TouchableOpacity
            key={r.value}
            onPress={() => setRelationship(r.value)}
            style={[
              styles.optionRow,
              relationship === r.value && styles.optionRowSelected,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, relationship === r.value && { color: colors.primary }]}>
                {r.label}
              </Text>
              <Text style={styles.optionDesc}>{r.description}</Text>
            </View>
            {relationship === r.value && (
              <Text style={{ fontSize: 16, color: colors.primary }}>{"✓"}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>,

  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {/* onboarding is required — back button does nothing */}}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View style={[styles.container, { paddingTop: Math.max(insets.top + 20, 60), paddingBottom: Math.max(insets.bottom + 16, 20) }]}>
          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive]}
              />
            ))}
          </View>

          {/* Step content */}
          <View style={{ flex: 1 }}>
            {stepContent[step]}
          </View>

          {/* CTA */}
          <TouchableOpacity onPress={handleNext} style={styles.button}>
            <Text style={styles.buttonText}>
              {step < totalSteps - 1 ? "Continue" : "Start with Imotara"}
            </Text>
          </TouchableOpacity>

          {step === 0 && (
            <TouchableOpacity
              onPress={() => onComplete({ name: "", relationship: "prefer_not", analysisMode: "cloud" })}
              style={{ alignItems: "center", paddingVertical: 14 }}
            >
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Skip setup
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) {
  return {
    container: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 20,
      ...(Platform.OS === "ios" && Platform.isPad ? { maxWidth: 600, alignSelf: "center" as const, width: "100%" as const } : {}),
    } as const,
    dotsRow: {
      flexDirection: "row" as const,
      gap: 8,
      marginBottom: 32,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.primary,
      width: 24,
    },
    stepLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
    },
    heading: {
      fontSize: 22,
      fontWeight: "700" as const,
      color: colors.textPrimary,
      marginBottom: 10,
      lineHeight: 30,
    },
    subheading: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    input: {
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.textPrimary,
    },
    optionRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
      marginBottom: 10,
    },
    optionRowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.emotionHopeful,
    },
    optionLabel: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    optionDesc: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center" as const,
      marginBottom: 12,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: "#0f172a",
    },
  };
}
