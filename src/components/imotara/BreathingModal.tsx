// src/components/imotara/BreathingModal.tsx
// Animated breathing exercise modal — 3 patterns, background music toggle.

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
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "../../theme/ThemeContext";

// ── Lotus mandala header ─────────────────────────────────────────────────────
function LotusHeader() {
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slow breathe-glow (4s cycle)
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
    // Very slow outer-ring rotation (30s full turn)
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 30000, useNativeDriver: true })
    ).start();
  }, []);

  const outerRotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const innerRotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const glowScale   = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });

  const OUTER_PETALS = 8;
  const INNER_PETALS = 8;
  const cx = 110; // center offset from left (half of 220 width)

  return (
    <LinearGradient
      colors={["rgba(30,14,60,1)", "rgba(15,23,42,1)"]}
      style={{ width: "100%", height: 170, overflow: "hidden", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
    >
      {/* Starfield */}
      {[
        [20,18],[50,40],[80,15],[140,30],[175,20],[195,45],[30,60],[160,55],
        [90,50],[120,10],[60,70],[200,70],[10,80],[170,80],[100,65],
      ].map(([x,y], i) => (
        <View key={i} style={{ position:"absolute", left:x, top:y,
          width: i%3===0?2:1.5, height: i%3===0?2:1.5, borderRadius:2,
          backgroundColor:`rgba(255,255,255,${0.3+0.4*(i%3)/3})` }} />
      ))}

      {/* Outer glow ring */}
      <Animated.View style={{
        position:"absolute", left:cx-60, top:85-60,
        width:120, height:120, borderRadius:60,
        backgroundColor:"rgba(167,139,250,0.08)",
        opacity: glowOpacity, transform:[{scale: glowScale}],
      }} />

      {/* Outer petals (rotating) */}
      <Animated.View style={{ position:"absolute", left:cx-45, top:85-45, width:90, height:90,
        alignItems:"center", justifyContent:"center", transform:[{rotate: outerRotate}] }}>
        {Array.from({length: OUTER_PETALS}, (_,i) => (
          <View key={i} style={{
            position:"absolute",
            width:18, height:40, borderRadius:9,
            backgroundColor:"rgba(167,139,250,0.18)",
            borderWidth:1, borderColor:"rgba(167,139,250,0.45)",
            transform:[{rotate:`${i*(360/OUTER_PETALS)}deg`},{translateY:-30}],
          }} />
        ))}
      </Animated.View>

      {/* Inner petals (counter-rotating) */}
      <Animated.View style={{ position:"absolute", left:cx-28, top:85-28, width:56, height:56,
        alignItems:"center", justifyContent:"center", transform:[{rotate: innerRotate}] }}>
        {Array.from({length: INNER_PETALS}, (_,i) => (
          <View key={i} style={{
            position:"absolute",
            width:10, height:22, borderRadius:5,
            backgroundColor:"rgba(56,189,248,0.20)",
            borderWidth:1, borderColor:"rgba(56,189,248,0.50)",
            transform:[{rotate:`${i*(360/INNER_PETALS)+22.5}deg`},{translateY:-17}],
          }} />
        ))}
      </Animated.View>

      {/* Centre jewel */}
      <Animated.View style={{
        position:"absolute", left:cx-10, top:85-10, width:20, height:20, borderRadius:10,
        backgroundColor:"rgba(251,191,36,0.30)", borderWidth:1.5,
        borderColor:"rgba(251,191,36,0.80)",
        opacity: glowOpacity,
        transform:[{scale: glowScale}],
      }} />

      {/* Label */}
      <View style={{ position:"absolute", bottom:14, width:"100%", alignItems:"center" }}>
        <Text style={{ fontSize:11, fontWeight:"600", color:"rgba(196,181,253,0.75)", letterSpacing:2 }}>
          BREATHE  &amp;  BE
        </Text>
      </View>
    </LinearGradient>
  );
}

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

type MusicTrack = "none" | "bowl" | "rain" | "ocean";

const MUSIC_OPTIONS: { id: MusicTrack; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { id: "none",  label: "Silent",     icon: "volume-mute-outline" },
  { id: "bowl",  label: "Bowl",       icon: "radio-button-on-outline" },
  { id: "rain",  label: "Rain",       icon: "rainy-outline" },
  { id: "ocean", label: "Ocean",      icon: "water-outline" },
];

const MUSIC_SOURCES: Record<Exclude<MusicTrack, "none">, any> = {
  bowl:  require("../../../assets/sounds/bowl.wav"),
  rain:  require("../../../assets/sounds/rain.wav"),
  ocean: require("../../../assets/sounds/ocean.wav"),
};

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

  // Music state
  const [musicTrack, setMusicTrack] = useState<MusicTrack>("bowl");
  const soundRef = useRef<Audio.Sound | null>(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const pattern = PATTERNS[selectedPattern];

  // ── Music helpers ────────────────────────────────────────────────────────────
  const stopMusic = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  }, []);

  const startMusic = useCallback(async (track: MusicTrack) => {
    await stopMusic();
    if (track === "none") return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        MUSIC_SOURCES[track],
        { isLooping: true, volume: 0.35, shouldPlay: true },
      );
      soundRef.current = sound;
    } catch (e) {
      console.warn("[BreathingModal] music load failed:", e);
    }
  }, [stopMusic]);

  // ── Breathing logic ──────────────────────────────────────────────────────────
  const stopExercise = useCallback(() => {
    setRunning(false);
    setPhaseIndex(0);
    setSecondsLeft(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animRef.current) animRef.current.stop();
    scaleAnim.setValue(1);
    opacityAnim.setValue(0.6);
    void stopMusic();
  }, [scaleAnim, opacityAnim, stopMusic]);

  const startPhase = useCallback(
    (pIdx: number) => {
      const phase = pattern.phases[pIdx];
      setPhaseIndex(pIdx);
      setSecondsLeft(phase.seconds);

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
    void startMusic(musicTrack);
  }, [startPhase, startMusic, musicTrack]);

  // Countdown timer
  useEffect(() => {
    if (!running) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setPhaseIndex((curPhase) => {
            const nextPhase = (curPhase + 1) % pattern.phases.length;
            if (nextPhase === 0) setCycles((c) => c + 1);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => { void stopMusic(); };
  }, [stopMusic]);

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
            paddingBottom: 36,
            overflow: "hidden",
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Lotus mandala header image */}
          <LotusHeader />

          {/* Close button overlaid on header */}
          <TouchableOpacity
            onPress={() => { stopExercise(); onClose(); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ position: "absolute", top: 16, right: 16, zIndex: 10,
              backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 20, padding: 6 }}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>

          {/* Rest of content */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>

          {/* Pattern selector */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
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

          {/* Music selector */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>
              BACKGROUND SOUND
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {MUSIC_OPTIONS.map((opt) => {
                const isSelected = musicTrack === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => {
                      setMusicTrack(opt.id);
                      // If already running, swap music immediately
                      if (running) void startMusic(opt.id);
                    }}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isSelected ? "rgba(167,139,250,0.6)" : colors.border,
                      backgroundColor: isSelected ? "rgba(167,139,250,0.12)" : "rgba(30,41,59,0.5)",
                      gap: 4,
                    }}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={isSelected ? "#c4b5fd" : colors.textSecondary}
                    />
                    <Text style={{ fontSize: 10, fontWeight: "600", color: isSelected ? "#c4b5fd" : colors.textSecondary }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Breathing circle */}
          <View style={{ alignItems: "center", marginVertical: 16 }}>
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
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 20 }}>
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
          </View>{/* end paddingHorizontal wrapper */}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
