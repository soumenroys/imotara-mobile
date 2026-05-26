// src/components/imotara/PlanSupportQuickPanel.tsx
import React, { useRef, useEffect, useState } from "react";
import {
  Animated, Easing, Modal, View, Text, TouchableOpacity,
  ScrollView, Switch, PanResponder, Dimensions, Alert, Linking, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, useTheme } from "../../theme/ThemeContext";
import IOSTipJar from "./IOSTipJar";
import UpgradeSheet from "./UpgradeSheet";
import { DONATION_PRESETS } from "../../payments/donations";
import type { LicenseTier } from "../../licensing/featureGates";

type DonationItem = { id: string; label: string; amount: number };
const DONATE_PRESETS = DONATION_PRESETS as readonly DonationItem[];

const PANEL_WIDTH = Math.min(Dimensions.get("window").width * 0.90, 420);

function getApiBaseUrl(): string {
  const v =
    process.env.EXPO_PUBLIC_IMOTARA_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    "";
  return v.endsWith("/") ? v.slice(0, -1) : v;
}

function prettyTier(tier: LicenseTier | string | undefined | null): string {
  const t = String(tier ?? "FREE").toUpperCase();
  if (t === "FREE") return "Free";
  if (t === "PREMIUM") return "Premium";
  if (t === "FAMILY") return "Family";
  if (t === "EDU") return "Education";
  if (t === "ENTERPRISE") return "Enterprise";
  return t.charAt(0) + t.slice(1).toLowerCase();
}

type Props = {
  visible: boolean;
  onClose: () => void;
  licenseTier: LicenseTier | string | null | undefined;
  licenseExpiresAt: string | null | undefined;
  emotionInsightsEnabled: boolean;
  setEmotionInsightsEnabled: (v: boolean) => void;
  refreshLicense: () => Promise<void>;
};

// ── small layout helpers ──────────────────────────────────────────────────────
function SectionTitle({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary,
      textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
      {label}
    </Text>
  );
}

function Card({ children, colors, style }: { children: React.ReactNode; colors: any; style?: any }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 12 }, style]}>
      {children}
    </View>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export function PlanSupportQuickPanel({
  visible, onClose,
  licenseTier, licenseExpiresAt,
  emotionInsightsEnabled, setEmotionInsightsEnabled,
  refreshLicense,
}: Props) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [donating, setDonating] = useState(false);

  // Snappy animation — 100 ms in, 120 ms out
  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0, duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: PANEL_WIDTH, duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Swipe-right anywhere on the panel to close
  const closePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        gs.dx > 20 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.3,
      onPanResponderGrant: () => { onClose(); },
      onPanResponderMove: () => {},
      onPanResponderRelease: () => {},
    })
  ).current;

  const handleDonate = async (preset: DonationItem) => {
    if (donating) return;
    setDonating(true);
    try {
      const base = getApiBaseUrl();
      await Linking.openURL(`${base}/donate`);
    } catch {
      Alert.alert("Error", "Could not open donation page. Please try again.");
    } finally {
      setDonating(false);
    }
  };

  const tierLabel = prettyTier(licenseTier);
  const isFree = String(licenseTier ?? "FREE").toUpperCase() === "FREE";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.38)" }}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Panel — slides in from right */}
      <Animated.View
        style={{
          position: "absolute", top: 0, bottom: 0, right: 0,
          width: PANEL_WIDTH,
          backgroundColor: colors.background,
          borderLeftWidth: 1,
          borderLeftColor: colors.border,
          transform: [{ translateX: slideAnim }],
          shadowColor: "#000",
          shadowOffset: { width: -4, height: 0 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 10,
        }}
        {...closePan.panHandlers}
      >
        {/* Header */}
        <View style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 18,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>
            Plan & Support
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontSize: 22, color: colors.textSecondary, lineHeight: 26 }}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Your Plan ── */}
          <SectionTitle label="Your plan" colors={colors} />
          <Card colors={colors}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 2 }}>
              Current plan
            </Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 }}>
              {tierLabel}
            </Text>

            {licenseExpiresAt ? (
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {new Date(licenseExpiresAt).getTime() > Date.now()
                  ? `Renews ${new Date(licenseExpiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
                  : `Expired ${new Date(licenseExpiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`}
              </Text>
            ) : isFree ? (
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Upgrade to unlock unlimited chat, 90-day history, and all companion tones.
              </Text>
            ) : null}
          </Card>

          {/* ── Upgrade ── */}
          <SectionTitle label="Upgrade" colors={colors} />
          <Card colors={colors}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 4 }}>
              Upgrade your plan
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
              Unlock unlimited replies, 90-day history, all companion tones, and more.
            </Text>
            <TouchableOpacity
              onPress={() => setShowUpgrade(true)}
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 16, paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: "rgba(99,102,241,0.2)",
                borderWidth: 1, borderColor: "rgba(99,102,241,0.4)",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                View plans →
              </Text>
            </TouchableOpacity>
          </Card>

          {/* ── Emotion Insights ── */}
          <SectionTitle label="Insights" colors={colors} />
          <Card colors={colors}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textPrimary }}>
                Emotion Insights
              </Text>
              <Switch
                value={emotionInsightsEnabled}
                onValueChange={setEmotionInsightsEnabled}
                trackColor={{ false: isDark ? "#4b5563" : "#94a3b8", true: colors.primary }}
                thumbColor="#f9fafb"
              />
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Imotara gives deeper emotional reflections and gentle prompts when enabled.
            </Text>
          </Card>

          {/* ── Support ── */}
          <SectionTitle label="Support Imotara" colors={colors} />
          <Card colors={colors}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textPrimary, marginBottom: 6 }}>
              Support Imotara 🇮🇳
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
              Privacy-first, built in India. Leave a tip to support development — all features stay free.
            </Text>

            {Platform.OS === "ios" ? (
              <IOSTipJar />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {DONATE_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handleDonate(p)}
                    disabled={donating}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1, borderColor: colors.primary,
                      backgroundColor: "rgba(56,189,248,0.12)",
                      marginRight: 8, marginBottom: 8,
                      opacity: donating ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>
        </ScrollView>

        {/* Upgrade sheet — layered on top of the panel */}
        {showUpgrade && (
          <UpgradeSheet
            visible
            onClose={() => setShowUpgrade(false)}
            currentTier={licenseTier ?? null}
            onPurchaseComplete={async () => {
              setShowUpgrade(false);
              await refreshLicense().catch(() => {});
            }}
          />
        )}
      </Animated.View>
    </Modal>
  );
}
