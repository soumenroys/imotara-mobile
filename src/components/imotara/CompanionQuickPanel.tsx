// src/components/imotara/CompanionQuickPanel.tsx
import React, { useRef, useState, useEffect } from "react";
import {
  Animated, Easing, Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, Switch, PanResponder, Dimensions, StyleSheet, Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, useTheme } from "../../theme/ThemeContext";
import { speakPreview, stopSpeaking } from "../../lib/tts/mobileTTS";
import { AVATAR_IMAGES, resolveAvatarImage } from "../../assets/avatarImages";
import type { ToneContextPayload } from "../../api/aiClient";

const PANEL_WIDTH = Math.min(Dimensions.get("window").width * 0.90, 420);

const AVATAR_AGES = [6, 16, 26, 36, 46, 56, 66, 76, 86, 96];
const AVATAR_AGE_LABEL: Record<number, string> = {
  6: "Under 13", 16: "13–17", 26: "18–34", 36: "35–44",
  46: "45–54", 56: "55–64", 66: "65–75", 76: "76–85", 86: "86–95", 96: "96+",
};
const AGE_TO_AVATAR: Record<string, number> = {
  prefer_not: 26, under_13: 6, "13_17": 16, "18_24": 26,
  "25_34": 26, "35_44": 36, "45_54": 46, "55_64": 56, "65_plus": 66,
};

const TTS_RATE_KEY      = "imotara.tts.rate.v1";
const TTS_PITCH_KEY     = "imotara.tts.pitch.v1";
const ARC_CADENCE_KEY   = "imotara.arc.cadenceDays.v1";
const LETTER_CADENCE_KEY = "imotara.letter.cadenceDays.v1";
const MEMORY_MAX_KEY    = "imotara.memory.maxItems.v1";

// ── Avatar strip ─────────────────────────────────────────────────────────────
function AvatarPicker({
  gender, ageValue, onChange, name, disabled,
}: { gender?: string; ageValue: number; onChange: (a: number) => void; name?: string; disabled?: boolean }) {
  const colors = useColors();
  const canShow = (gender === "male" || gender === "female") && !disabled;
  const idx = AVATAR_AGES.indexOf(ageValue);
  const safeIdx = idx === -1 ? 2 : idx;
  const safeAge = AVATAR_AGES[safeIdx];

  if (!canShow) {
    return (
      <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>
        Set Gender to{" "}
        <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Male</Text>
        {" "}or{" "}
        <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Female</Text>
        {" "}to choose an avatar.
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
      {/* Selected avatar */}
      <View style={{ alignItems: "center", gap: 4 }}>
        <View style={{ width: 60, height: 60, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft }}>
          <Image source={AVATAR_IMAGES[gender!]?.[safeAge]} style={{ width: 60, height: 60 }} resizeMode="cover" />
        </View>
        {name ? <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textSecondary, maxWidth: 60 }} numberOfLines={1}>{name}</Text> : null}
      </View>
      {/* Thumbnail strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
        {AVATAR_AGES.map((age, i) => {
          const active = i === safeIdx;
          return (
            <TouchableOpacity key={age} onPress={() => onChange(age)} style={{ alignItems: "center", gap: 2 }}>
              <View style={{ width: 42, height: 42, borderRadius: 10, overflow: "hidden", borderWidth: active ? 2 : 1, borderColor: active ? colors.primary : colors.border }}>
                <Image source={AVATAR_IMAGES[gender!]?.[age]} style={{ width: 42, height: 42 }} resizeMode="cover" />
              </View>
              <Text style={{ fontSize: 9, color: active ? colors.primary : colors.textSecondary, fontWeight: active ? "700" : "400" }}>
                {AVATAR_AGE_LABEL[age]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ label, active, onPress, disabled }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={{
      paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
      borderColor: active ? colors.primary : colors.border,
      backgroundColor: active ? colors.primaryTint : colors.surfaceSoft,
      marginRight: 7, marginBottom: 7, opacity: disabled ? 0.4 : 1,
    }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? colors.textPrimary : colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ backgroundColor: colors.surfaceSoft, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 14 }}>
      {children}
    </View>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 4 }}>{children}</Text>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 5, marginTop: 10 }}>{children}</Text>;
}

// ── Props ─────────────────────────────────────────────────────────────────────
export type Props = {
  visible: boolean;
  onClose: () => void;
  toneContext: ToneContextPayload | null | undefined;
  setToneContext: (ctx: ToneContextPayload) => void;
  accessToken?: string;
};

export function CompanionQuickPanel({ visible, onClose, toneContext, setToneContext, accessToken }: Props) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-PANEL_WIDTH)).current;

  const [companionNameDraft, setCompanionNameDraft] = useState(toneContext?.companion?.name ?? "");
  const [voicePreviewId, setVoicePreviewId] = useState<string | null>(null);
  const [ttsRate, setTtsRate]   = useState(0.95);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [arcDays, setArcDays]    = useState(30);
  const [letterDays, setLetterDays] = useState(30);
  const [memMax, setMemMax] = useState(12);

  useEffect(() => { setCompanionNameDraft(toneContext?.companion?.name ?? ""); }, [toneContext?.companion?.name]);

  useEffect(() => {
    AsyncStorage.multiGet([TTS_RATE_KEY, TTS_PITCH_KEY, ARC_CADENCE_KEY, LETTER_CADENCE_KEY, MEMORY_MAX_KEY])
      .then((pairs) => {
        for (const [k, v] of pairs) {
          if (!v) continue;
          if (k === TTS_RATE_KEY)      { const n = parseFloat(v); if (isFinite(n)) setTtsRate(n); }
          if (k === TTS_PITCH_KEY)     { const n = parseFloat(v); if (isFinite(n)) setTtsPitch(n); }
          if (k === ARC_CADENCE_KEY)   { const n = parseInt(v, 10); if (isFinite(n)) setArcDays(n); }
          if (k === LETTER_CADENCE_KEY){ const n = parseInt(v, 10); if (isFinite(n)) setLetterDays(n); }
          if (k === MEMORY_MAX_KEY)    { const n = parseInt(v, 10); if (isFinite(n)) setMemMax(n); }
        }
      }).catch(() => {});
  }, []);

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
        toValue: -PANEL_WIDTH, duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Swipe-left anywhere on the panel to close
  const closePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        gs.dx < -20 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.3,
      onPanResponderGrant: () => { onClose(); },
      onPanResponderMove: () => {},
      onPanResponderRelease: () => {},
    })
  ).current;

  const setUser = (p: Partial<NonNullable<ToneContextPayload["user"]>>) =>
    setToneContext({ ...(toneContext || {}), user: { ...(toneContext?.user || {}), ...p } });
  const setComp = (p: Partial<NonNullable<ToneContextPayload["companion"]>>) =>
    setToneContext({ ...(toneContext || {}), companion: { ...(toneContext?.companion || {}), ...p } });

  const enabled = !!toneContext?.companion?.enabled;
  const rel = toneContext?.companion?.relationship || "prefer_not";
  const agT = (toneContext?.companion?.ageTone ?? toneContext?.companion?.ageRange) || "prefer_not";
  const mismatch = enabled && agT === "under_13" && ["mentor","elder","parent_like","partner_like"].includes(rel);

  const rsPreviews: Record<string, string> = {
    comfort:  "“That sounds really hard. I’m here with you — take all the time you need.”",
    reflect:  "“What do you think that feeling is trying to tell you?”",
    motivate: "“You’re doing better than you think. One small step is all it takes today.”",
    advise:   "“Here’s what might help: start with the smallest task, just to build momentum.”",
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View
          style={[styles.panel, {
            width: PANEL_WIDTH,
            backgroundColor: colors.background,
            borderRightColor: colors.border,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            transform: [{ translateX: slideAnim }],
          }]}
          {...closePan.panHandlers}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>Your Companion</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
              <Text style={{ fontSize: 26, lineHeight: 28, color: colors.textSecondary }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* ══ PERSONAL INFO ══ */}
            <Card>
              <CardTitle>Personal info</CardTitle>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                Optional. Used to make wording feel more natural. Never shared.
              </Text>

              <FieldLabel>Your name (optional)</FieldLabel>
              <TextInput
                value={toneContext?.user?.name ?? ""}
                onChangeText={(t) => setUser({ name: t })}
                placeholder="e.g., Soumen"
                placeholderTextColor={colors.textSecondary}
                autoCorrect={false}
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
              />

              <FieldLabel>Age range</FieldLabel>
              <View style={styles.pills}>
                {(["prefer_not","13_17","18_24","25_34","35_44","45_54","55_64","65_plus"] as const).map((id) => (
                  <Pill key={id} label={id === "prefer_not" ? "Prefer not" : id.replace("_", "–")}
                    active={((toneContext?.user?.ageTone ?? toneContext?.user?.ageRange) || "prefer_not") === id}
                    onPress={() => setUser({ ageTone: id as any, ageRange: id as any, avatarAge: AGE_TO_AVATAR[id] ?? 26 })}
                  />
                ))}
              </View>

              <FieldLabel>Gender</FieldLabel>
              <View style={styles.pills}>
                {([["prefer_not","Prefer not"],["female","Female"],["male","Male"],["nonbinary","Non-binary"],["other","Other"]] as const).map(([id, label]) => (
                  <Pill key={id} label={label}
                    active={(toneContext?.user?.gender || "prefer_not") === id}
                    onPress={() => setUser({ gender: id as any })}
                  />
                ))}
              </View>

              <FieldLabel>Avatar appearance</FieldLabel>
              <AvatarPicker
                gender={toneContext?.user?.gender}
                ageValue={toneContext?.user?.avatarAge ?? 26}
                onChange={(age) => setUser({ avatarAge: age })}
                name={toneContext?.user?.name?.trim()}
              />

              <TouchableOpacity
                onPress={() => {
                  if (voicePreviewId === "u") { stopSpeaking(); setVoicePreviewId(null); }
                  else { setVoicePreviewId("u"); speakPreview(toneContext?.user?.gender, toneContext?.user?.preferredLang ?? "en", toneContext?.user?.name?.trim(), () => setVoicePreviewId(null), accessToken); }
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}
              >
                <Text style={{ fontSize: 12, color: colors.primary }}>{voicePreviewId === "u" ? "⏹ Stop preview" : "🔊 Preview your voice"}</Text>
              </TouchableOpacity>

              <FieldLabel>Preferred language</FieldLabel>
              <View style={styles.pills}>
                {([["en","English"],["hi","Hindi"],["bn","Bengali"],["ta","Tamil"],["te","Telugu"],["mr","Marathi"],["gu","Gujarati"],["kn","Kannada"],["ml","Malayalam"],["pa","Punjabi"],["or","Odia"],["ur","Urdu"],["ar","Arabic"],["zh","Chinese"],["fr","French"],["de","German"],["he","Hebrew"],["id","Indonesian"],["ja","Japanese"],["pt","Portuguese"],["ru","Russian"],["es","Spanish"]] as const).map(([id, label]) => (
                  <Pill key={id} label={label}
                    active={(toneContext?.user?.preferredLang || "en") === id}
                    onPress={() => setUser({ preferredLang: id as any })}
                  />
                ))}
              </View>
            </Card>

            {/* ══ COMPANION PERSONA ══ */}
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <CardTitle>Companion persona</CardTitle>
                <Switch value={enabled} onValueChange={(v) => setComp({ enabled: v })}
                  trackColor={{ false: isDark ? "#4b5563" : "#94a3b8", true: colors.primary }}
                  thumbColor="#f9fafb"
                />
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                Guides wording and warmth — won't pretend to be a real person.
              </Text>

              <FieldLabel>Companion name (optional)</FieldLabel>
              <TextInput
                value={companionNameDraft}
                onChangeText={setCompanionNameDraft}
                onBlur={() => setComp({ name: companionNameDraft })}
                placeholder="e.g. Imotara"
                placeholderTextColor={colors.textSecondary}
                editable={enabled}
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface, opacity: enabled ? 1 : 0.4 }]}
              />

              <FieldLabel>Relationship tone</FieldLabel>
              <View style={styles.pills}>
                {([["prefer_not","Prefer not"],["friend","Friend"],["mentor","Mentor"],["elder","Elder"],["coach","Coach"],["sibling","Sibling"],["junior_buddy","Junior buddy"],["parent_like","Parent-like"],["partner_like","Partner-like"]] as const).map(([id, label]) => (
                  <Pill key={id} label={label} disabled={!enabled}
                    active={(toneContext?.companion?.relationship || "prefer_not") === id}
                    onPress={() => setComp({ relationship: id })}
                  />
                ))}
              </View>

              <FieldLabel>Age tone</FieldLabel>
              <View style={styles.pills}>
                {([["prefer_not","Prefer not"],["under_13","Under 13"],["13_17","13–17"],["18_24","18–24"],["25_34","25–34"],["35_44","35–44"],["45_54","45–54"],["55_64","55–64"],["65_plus","65+"]] as const).map(([id, label]) => (
                  <Pill key={id} label={label} disabled={!enabled}
                    active={((toneContext?.companion?.ageTone ?? toneContext?.companion?.ageRange) || "prefer_not") === id}
                    onPress={() => setComp({ ageTone: id as any, ageRange: id as any, avatarAge: AGE_TO_AVATAR[id] ?? 26 })}
                  />
                ))}
              </View>

              {mismatch && (
                <View style={{ borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, borderColor: "rgba(251,191,36,0.55)", backgroundColor: "rgba(251,191,36,0.1)" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 }}>Heads up</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                    "Under 13" + this relationship makes replies feel awkward. Try "Junior buddy" or "Sibling".
                  </Text>
                  <TouchableOpacity onPress={() => setComp({ relationship: "junior_buddy" })}
                    style={{ marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primaryTint }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>Fix: Junior buddy</Text>
                  </TouchableOpacity>
                </View>
              )}

              <FieldLabel>Gender tone</FieldLabel>
              <View style={styles.pills}>
                {([["prefer_not","Prefer not"],["female","Female"],["male","Male"],["nonbinary","Non-binary"],["other","Other"]] as const).map(([id, label]) => (
                  <Pill key={id} label={label} disabled={!enabled}
                    active={(toneContext?.companion?.gender || "prefer_not") === id}
                    onPress={() => setComp({ gender: id as any })}
                  />
                ))}
              </View>

              <FieldLabel>Avatar appearance</FieldLabel>
              <AvatarPicker
                gender={toneContext?.companion?.gender}
                ageValue={toneContext?.companion?.avatarAge ?? 26}
                onChange={(age) => setComp({ avatarAge: age })}
                name={toneContext?.companion?.name?.trim()}
                disabled={!enabled}
              />

              <TouchableOpacity
                onPress={() => {
                  if (voicePreviewId === "c") { stopSpeaking(); setVoicePreviewId(null); }
                  else { setVoicePreviewId("c"); speakPreview(toneContext?.companion?.gender, toneContext?.user?.preferredLang ?? "en", toneContext?.companion?.name?.trim(), () => setVoicePreviewId(null), accessToken); }
                }}
                disabled={!enabled}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, opacity: enabled ? 1 : 0.4 }}
              >
                <Text style={{ fontSize: 12, color: colors.primary }}>{voicePreviewId === "c" ? "⏹ Stop preview" : "🔊 Preview companion voice"}</Text>
              </TouchableOpacity>

              <FieldLabel>Voice speed  {ttsRate.toFixed(2)}×</FieldLabel>
              <View style={styles.pills}>
                {([0.5, 0.75, 0.95, 1.1, 1.25, 1.5] as const).map((v) => (
                  <Pill key={v} label={`${v}×`} active={Math.abs(ttsRate - v) < 0.01}
                    onPress={async () => { setTtsRate(v); await AsyncStorage.setItem(TTS_RATE_KEY, String(v)).catch(() => {}); }}
                  />
                ))}
              </View>

              <FieldLabel>Voice pitch  {ttsPitch.toFixed(2)}</FieldLabel>
              <View style={styles.pills}>
                {([0.75, 0.9, 1.0, 1.1, 1.25] as const).map((v) => (
                  <Pill key={v} label={String(v)} active={Math.abs(ttsPitch - v) < 0.01}
                    onPress={async () => { setTtsPitch(v); await AsyncStorage.setItem(TTS_PITCH_KEY, String(v)).catch(() => {}); }}
                  />
                ))}
              </View>

              <FieldLabel>Companion responds</FieldLabel>
              <View style={styles.pills}>
                {([["auto","Let Imotara decide"],["comfort","Comfort me"],["reflect","Help me reflect"],["motivate","Motivate me"],["advise","Give advice"]] as const).map(([id, label]) => (
                  <Pill key={id} label={label} disabled={!enabled}
                    active={(toneContext?.user?.responseStyle ?? "auto") === id}
                    onPress={() => setUser({ responseStyle: id === "auto" ? undefined : (id as any) })}
                  />
                ))}
              </View>
              {toneContext?.user?.responseStyle && rsPreviews[toneContext.user.responseStyle] && (
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontStyle: "italic", lineHeight: 16, marginBottom: 4 }}>
                  {rsPreviews[toneContext.user.responseStyle]}
                </Text>
              )}
            </Card>

            {/* ══ ARC CADENCE ══ */}
            <Card>
              <CardTitle>Emotional arc cadence</CardTitle>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>How often your emotional journey narrative is generated</Text>
              <View style={styles.pills}>
                {([7,14,30,60] as const).map((d) => (
                  <Pill key={d} label={d===7?"1 week":d===14?"2 weeks":d===30?"Monthly":"2 months"} active={arcDays===d}
                    onPress={async () => { setArcDays(d); await AsyncStorage.setItem(ARC_CADENCE_KEY, String(d)).catch(() => {}); }}
                  />
                ))}
              </View>
            </Card>

            {/* ══ LETTER CADENCE ══ */}
            <Card>
              <CardTitle>Companion letter cadence</CardTitle>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>How often your companion writes you a personal letter</Text>
              <View style={styles.pills}>
                {([7,14,30,60] as const).map((d) => (
                  <Pill key={d} label={d===7?"1 week":d===14?"2 weeks":d===30?"Monthly":"2 months"} active={letterDays===d}
                    onPress={async () => { setLetterDays(d); await AsyncStorage.setItem(LETTER_CADENCE_KEY, String(d)).catch(() => {}); }}
                  />
                ))}
              </View>
            </Card>

            {/* ══ MEMORY LIMIT ══ */}
            <Card>
              <CardTitle>Memory limit</CardTitle>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>Maximum number of facts your companion remembers about you</Text>
              <View style={styles.pills}>
                {([6,12,20,30] as const).map((n) => (
                  <Pill key={n} label={String(n)} active={memMax===n}
                    onPress={async () => { setMemMax(n); await AsyncStorage.setItem(MEMORY_MAX_KEY, String(n)).catch(() => {}); }}
                  />
                ))}
              </View>
            </Card>

          </ScrollView>
        </Animated.View>

        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  panel: {
    borderRightWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 20,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1,
  },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginBottom: 4 },
  pills: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  backdrop: { flex: 1 },
});
