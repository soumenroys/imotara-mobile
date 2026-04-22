// src/components/imotara/HowItWorksModal.tsx
// "How to use Imotara" — 4-step illustrated guide, opened from Settings.

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../theme/ThemeContext";

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: "chatbubble-ellipses",
    iconColor: "rgba(129,140,248,1)",
    title: "Just talk",
    body: "Share what's on your mind — worries, stress, frustration, or simply how your day went. There is no right way to start. Imotara listens without judgment and responds with care.",
  },
  {
    icon: "cloud-outline",
    iconColor: "rgba(56,189,248,1)",
    title: "Works everywhere",
    body: "When online, Imotara uses AI to craft thoughtful replies. Even without internet, local mode keeps your conversations going — no interruptions, no blank screens.",
  },
  {
    icon: "person-circle-outline",
    iconColor: "rgba(251,191,36,1)",
    title: "Make it yours",
    body: "Choose your companion's name, tone, and relationship style — close friend, calm companion, coach, or mentor. Adjust language and age tone in Settings anytime.",
  },
  {
    icon: "shield-checkmark-outline",
    iconColor: "rgba(52,211,153,1)",
    title: "Your data, your control",
    body: "Everything you share stays on your device unless you choose to sync. Nothing is sold. You can export or delete your history anytime from Settings.",
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function HowItWorksModal({ visible, onClose }: Props) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>
            How to use Imotara
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              lineHeight: 21,
              marginBottom: 24,
            }}
          >
            Imotara is a quiet, private space for your emotions. Here is everything you need to get started.
          </Text>

          {/* Steps */}
          {STEPS.map((step, i) => (
            <View
              key={step.title}
              style={{
                flexDirection: "row",
                marginBottom: 24,
                gap: 14,
              }}
            >
              {/* Step number + icon */}
              <View style={{ alignItems: "center", width: 44 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: "rgba(99,102,241,0.10)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(99,102,241,0.18)",
                  }}
                >
                  <Ionicons name={step.icon} size={22} color={step.iconColor} />
                </View>
                {i < STEPS.length - 1 && (
                  <View
                    style={{
                      width: 1,
                      flex: 1,
                      marginTop: 6,
                      backgroundColor: "rgba(99,102,241,0.15)",
                    }}
                  />
                )}
              </View>

              {/* Text */}
              <View style={{ flex: 1, paddingTop: 4 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: colors.textPrimary,
                    marginBottom: 5,
                  }}
                >
                  {step.title}
                </Text>
                <Text
                  style={{
                    fontSize: 13.5,
                    color: colors.textSecondary,
                    lineHeight: 20,
                  }}
                >
                  {step.body}
                </Text>
              </View>
            </View>
          ))}

          {/* Footer tip */}
          <View
            style={{
              marginTop: 8,
              borderRadius: 12,
              backgroundColor: "rgba(99,102,241,0.08)",
              borderWidth: 1,
              borderColor: "rgba(99,102,241,0.18)",
              padding: 14,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: "rgba(165,180,252,0.9)",
                lineHeight: 19,
                textAlign: "center",
              }}
            >
              You do not have to know what to say.{"\n"}Just start — Imotara meets you where you are.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
