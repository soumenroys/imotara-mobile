// src/screens/ChatScreen.tsx
import React, { useState, useRef, useMemo, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Pressable,
    Animated,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useHistoryStore } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";
import colors from "../theme/colors";
import { callImotaraAI } from "../api/aiClient";
import { LinearGradient } from "expo-linear-gradient";
import { DEBUG_UI_ENABLED } from "../config/debug";

// NEW: lifecycle hook (additive)
import { useAppLifecycle } from "../hooks/useAppLifecycle";
import { getReflectionSeedCard } from "../lib/reflectionSeedContract";
import type { ReflectionSeed } from "../lib/reflectionSeedContract";
type ChatMessageSource = "cloud" | "local";

// Typing animation states for Imotara mobile chat
type TypingStatus = "idle" | "thinking" | "responding";

type ChatMessage = {
    id: string;
    from: "user" | "bot";
    text: string;
    timestamp: number;
    moodHint?: string;
    isSynced?: boolean;
    source?: ChatMessageSource;
    isPending?: boolean; // for “Syncing…” state

    // ✅ NEW: parity metadata (from /api/respond)
    reflectionSeed?: ReflectionSeed;
    followUp?: string;

    // ✅ Debug/diagnostics metadata (optional; report-only)
    meta?: {
        compatibility?: any;
    };
};

/** ---------- Color helpers (robust with hex/rgb/rgba) ---------- */
function clamp01(n: number) {
    return Math.max(0, Math.min(1, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const cleaned = hex.replace("#", "").trim();
    if (![3, 6].includes(cleaned.length)) return null;

    const full =
        cleaned.length === 3
            ? cleaned
                .split("")
                .map((c) => c + c)
                .join("")
            : cleaned;

    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return null;

    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
    };
}

function toRgba(color: string, alpha: number): string {
    const a = clamp01(alpha);
    const c = (color || "").trim();

    // rgba()
    if (c.startsWith("rgba(")) {
        const inside = c.slice(5, -1); // "r,g,b,a"
        const parts = inside.split(",").map((p) => p.trim());
        if (parts.length >= 3) {
            const r = parts[0];
            const g = parts[1];
            const b = parts[2];
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        return c;
    }

    // rgb()
    if (c.startsWith("rgb(")) {
        const inside = c.slice(4, -1); // "r,g,b"
        return `rgba(${inside}, ${a})`;
    }

    // hex
    if (c.startsWith("#")) {
        const rgb = hexToRgb(c);
        if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
        return `rgba(148, 163, 184, ${a})`;
    }

    if (c === "transparent") return "transparent";
    return `rgba(148, 163, 184, ${a})`;
}

// Create a medium-intensity gradient from the mood tint
function getMoodGradient(baseColor: string) {
    return {
        start: toRgba(baseColor, 0.55),
        end: toRgba(baseColor, 0.95),
    };
}

// Local mood hint → emoji
function getMoodEmojiForHint(hint?: string): string {
    if (!hint) return "";
    const text = hint.toLowerCase();

    if (text.includes("low")) return " 💙";
    if (text.includes("tense") || text.includes("worried")) return " 💛";
    if (text.includes("upset") || text.includes("frustrated")) return " ❤️";
    if (text.includes("stuck") || text.includes("unsure")) return " 🟣";
    if (text.includes("light") || text.includes("hope")) return " 💚";

    return " ⚪️";
}

// moodHint → bubbleTint mapping
function getMoodTintForHint(hint?: string): string {
    if (!hint) return colors.emotionNeutral;
    const text = hint.toLowerCase();

    if (text.includes("low")) return colors.emotionSad;
    if (text.includes("tense") || text.includes("worried"))
        return colors.emotionAnxious;
    if (text.includes("upset") || text.includes("frustrated"))
        return colors.emotionAngry;
    if (text.includes("stuck") || text.includes("unsure"))
        return colors.emotionConfused;
    if (text.includes("light") || text.includes("hope"))
        return colors.emotionHopeful;

    return colors.emotionNeutral;
}

function getLocalMoodHint(text: string): string {
    const lower = text.toLowerCase();

    const sadWords = [
        "sad",
        "down",
        "lonely",
        "tired",
        "upset",
        "hurt",
        "empty",
        "depressed",
        "blue",
        "cry",
        "crying",
    ];
    const anxiousWords = [
        "worry",
        "worried",
        "anxious",
        "scared",
        "panic",
        "nervous",
        "stressed",
        "overwhelmed",
        "afraid",
        "fear",
    ];
    const angryWords = [
        "angry",
        "mad",
        "frustrated",
        "annoyed",
        "irritated",
        "furious",
        "rage",
        "hate",
    ];
    const hopefulWords = [
        "hope",
        "hopeful",
        "excited",
        "looking forward",
        "grateful",
        "thankful",
        "relieved",
        "better",
        "good mood",
        "feeling good",
        "happy",
        "joyful",
        "cheerful",
    ];
    const stuckWords = [
        "stuck",
        "lost",
        "confused",
        "don’t know",
        "dont know",
        "no idea",
        "numb",
    ];

    const containsAny = (arr: string[]) => arr.some((w) => lower.includes(w));

    if (containsAny(sadWords)) {
        return "You seem a bit low. It’s okay to feel this way — Imotara is here with you.";
    }
    if (containsAny(anxiousWords)) {
        return "It sounds like something is making you feel tense or worried.";
    }
    if (containsAny(angryWords)) {
        return "It sounds like something has really upset or frustrated you.";
    }
    if (containsAny(stuckWords)) {
        return "You sound a bit stuck or unsure. It’s okay to take time to untangle things.";
    }
    if (containsAny(hopefulWords)) {
        return "I can sense a little bit of light or hope in what you’re saying.";
    }

    return "I’m listening closely. However you’re feeling, it matters here.";
}

// Local-only response generator
function generateLocalBotResponse(
    userText: string,
    insightsEnabled: boolean
): { replyText: string; moodHint?: string } {
    const replyText =
        "I hear you. In the real Imotara app, I’ll respond with empathy and emotional insight. " +
        "For now, this is a local-only mobile preview.";

    if (!insightsEnabled) return { replyText };

    return {
        replyText,
        moodHint: getLocalMoodHint(userText),
    };
}

const USER_BUBBLE_BG = "rgba(56, 189, 248, 0.35)";
const SESSION_GAP_MS = 45 * 60 * 1000;

function smoothScrollToBottom(ref: React.RefObject<ScrollView | null>) {
    setTimeout(() => {
        ref.current?.scrollToEnd({ animated: true });
    }, 30);
}

/**
 * ✅ Hook-safe helper:
 * Return true if this bot message is the first bot reply of a session.
 */
function isFirstBotReplyOfSession(
    message: ChatMessage,
    index: number,
    messages: ChatMessage[]
): boolean {
    if (message.from !== "bot") return false;

    const prev = messages[index - 1];
    if (!prev || prev.from !== "user") return false;

    if (index - 1 === 0) return true;

    const beforeUser = messages[index - 2];
    if (!beforeUser) return true;

    const gap = prev.timestamp - (beforeUser.timestamp ?? 0);
    return gap > SESSION_GAP_MS;
}

export default function ChatScreen() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [inputHeight, setInputHeight] = useState(40);
    const [isTyping, setIsTyping] = useState(false);
    const [typingDots, setTypingDots] = useState(1);

    const [recentlySyncedAt, setRecentlySyncedAt] = useState<number | null>(null);

    // ✅ Action sheet state
    const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);

    // ✅ Read store once, but allow optional newer helpers safely (no behavior loss)
    const store = useHistoryStore() as any;
    const {
        addToHistory,
        history,
        deleteFromHistory,
        isSyncing,
        pushHistoryToRemote,
        runSync,
        syncNow,
    } = store;

    const {
        emotionInsightsEnabled,
        lastSyncAt,
        lastSyncStatus,
        analysisMode,
        toneContext,
    } = useSettings();

    const scrollViewRef = useRef<ScrollView | null>(null);

    // ✅ RN-safe typing (fixes TS issues in many RN setups)
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ✅ 80/20: prevent double-send / overlapping async flows
    const isSendingRef = useRef(false);

    // ✅ 80/20: avoid setState on unmounted
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // NEW: lifecycle safety refs (additive)
    const typingStartedAtRef = useRef<number>(0);
    const sendStartedAtRef = useRef<number>(0);
    const lastLifecycleResetAtRef = useRef<number>(0);

    const resetTypingState = (reason: string) => {
        // Avoid repeated rapid resets on noisy AppState transitions
        const now = Date.now();
        if (now - lastLifecycleResetAtRef.current < 250) return;
        lastLifecycleResetAtRef.current = now;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        // Release send lock as well (prevents stuck send disabled)
        isSendingRef.current = false;

        if (!mountedRef.current) return;

        // Only update state if needed
        setIsTyping(false);
        setTypingStatus("idle");
        setTypingDots(1);

        // (kept for future debugging; no UI impact)
        void reason;
    };

    // NEW: app lifecycle handling (prevents stuck typing on background/foreground)
    useAppLifecycle({
        debounceMs: 350,
        onBackground: () => {
            // If the app goes background mid "typing", clear timers and unlock
            if (isTyping || isSendingRef.current) {
                resetTypingState("background");
            }
        },
        onForeground: () => {
            // If we come back and a typing cycle has been hanging too long, reset.
            const now = Date.now();
            const typingAge = typingStartedAtRef.current
                ? now - typingStartedAtRef.current
                : 0;
            const sendAge = sendStartedAtRef.current
                ? now - sendStartedAtRef.current
                : 0;

            // Conservative: only reset if it looks stuck (e.g., OS paused timers)
            if (isTyping && typingAge > 20_000) {
                resetTypingState("foreground-stale-typing");
                return;
            }
            if (isSendingRef.current && sendAge > 25_000) {
                resetTypingState("foreground-stale-sendlock");
            }
        },
    });

    const [showScrollButton, setShowScrollButton] = useState(false);

    const [typingStatus, setTypingStatus] = useState<TypingStatus>("idle");
    const [typingGlow] = useState(new Animated.Value(0));

    const hasUnsynced = useMemo(() => history.some((h: any) => !h.isSynced), [history]);

    const showRecentlySyncedPulse = useMemo(() => {
        if (recentlySyncedAt == null) return false;
        const diff = Date.now() - recentlySyncedAt;
        return diff < 8000;
    }, [recentlySyncedAt]);

    // Align message isSynced with history store
    useEffect(() => {
        if (history.length === 0) return;

        let anyNewlySynced = false;

        setMessages((prev) => {
            const updated = prev.map((m) => {
                const h = history.find((hh: any) => hh.id === m.id);
                if (!h) return m;
                if (m.isSynced === h.isSynced) return m;
                if (h.isSynced) anyNewlySynced = true;
                return {
                    ...m,
                    isSynced: h.isSynced,
                    isPending: h.isSynced ? false : m.isPending,
                };
            });

            if (anyNewlySynced) setRecentlySyncedAt(Date.now());
            return updated;
        });
    }, [history]);

    const syncHint = useMemo(() => {
        if (!lastSyncAt) return "Some messages are stored locally until cloud sync is enabled.";

        const lower = (lastSyncStatus || "").toLowerCase();
        if (lower.includes("failed") || lower.includes("error")) {
            return "Sync issue · your latest messages are only on this device.";
        }

        if (
            lower.includes("pushed") ||
            lower.includes("merged") ||
            lower.includes("synced")
        ) {
            return "Recent messages are safely backed up to Imotara cloud.";
        }

        return "Sync checked recently · some messages may still be local-only.";
    }, [lastSyncAt, lastSyncStatus]);

    const syncHintAccent = useMemo(() => {
        if (!lastSyncAt) return "#9ca3af";

        const lower = (lastSyncStatus || "").toLowerCase();
        if (lower.includes("failed") || lower.includes("error")) {
            return "#fca5a5";
        }

        if (
            lower.includes("pushed") ||
            lower.includes("merged") ||
            lower.includes("synced")
        ) {
            return colors.primary;
        }

        return "#9ca3af";
    }, [lastSyncAt, lastSyncStatus]);

    useEffect(() => {
        if (!isTyping) {
            setTypingDots(1);
            return;
        }

        const interval = setInterval(() => {
            setTypingDots((prev) => (prev % 3) + 1);
        }, 400);

        return () => clearInterval(interval);
    }, [isTyping]);

    useEffect(() => {
        if (!isTyping) {
            typingGlow.setValue(0);
            return;
        }

        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(typingGlow, {
                    toValue: 1,
                    duration: 650,
                    useNativeDriver: true,
                }),
                Animated.timing(typingGlow, {
                    toValue: 0,
                    duration: 650,
                    useNativeDriver: true,
                }),
            ])
        );

        loop.start();
        return () => loop.stop();
    }, [isTyping, typingGlow]);

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (recentlySyncedAt == null) return;
        const t = setTimeout(() => setRecentlySyncedAt(null), 900);
        return () => clearTimeout(t);
    }, [recentlySyncedAt]);

    const slideAnim = useRef<Animated.Value>(new Animated.Value(20)).current;
    const fadeAnim = useRef<Animated.Value>(new Animated.Value(0)).current;

    useEffect(() => {
        if (showScrollButton) {
            slideAnim.setValue(20);
            fadeAnim.setValue(0);
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 20,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [showScrollButton, slideAnim, fadeAnim]);

    // NOTE: Hooks remain (hook-safe), but debug-only UI/trigger is gated via DEBUG_UI_ENABLED
    const [refreshing, setRefreshing] = useState(false);
    const [pullOffset, setPullOffset] = useState(0);
    const [pullAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        if (!refreshing) return;

        Animated.sequence([
            Animated.timing(pullAnim, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(pullAnim, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start();
    }, [refreshing, pullAnim]);

    const handleRefresh = () => {
        if (!DEBUG_UI_ENABLED) return; // gated (no behavior change in dev)
        if (refreshing) return;
        setRefreshing(true);

        setTimeout(() => {
            if (!mountedRef.current) return;
            setRefreshing(false);
        }, 800);
    };

    const scrollToBottom = () => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    };

    const closeActionSheet = () => {
        setActionMessage(null);
    };

    const handleDeleteMessage = (id: string) => {
        setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === id);
            if (idx === -1) return prev;

            const msg = prev[idx];

            // If deleting a user message, delete paired next bot reply (existing behavior)
            if (msg.from === "user") {
                const next = prev[idx + 1];
                const idsToDelete = [msg.id];
                if (next && next.from === "bot") idsToDelete.push(next.id);

                idsToDelete.forEach((deleteId) => deleteFromHistory(deleteId));
                return prev.filter((m) => !idsToDelete.includes(m.id));
            }

            deleteFromHistory(msg.id);
            return prev.filter((m) => m.id !== msg.id);
        });

        setActionMessage(null);
    };

    const handleCopyMessage = async (text: string) => {
        try {
            await Clipboard.setStringAsync(text);
            Alert.alert("Copied", "Message text copied to clipboard.");
        } catch {
            Alert.alert("Copy failed", "Could not copy message text.");
        } finally {
            setActionMessage(null);
        }
    };

    const handleShowTimestamp = (msg: ChatMessage) => {
        Alert.alert("Message timestamp", new Date(msg.timestamp).toLocaleString());
        setActionMessage(null);
    };

    // ✅ Explicit “sync now” action (uses deduped sync trigger when available)
    const handleSyncNowForMessage = async (msg: ChatMessage) => {
        try {
            setMessages((prev) =>
                prev.map((m) => (m.id === msg.id ? { ...m, isPending: true } : m))
            );

            const syncFn =
                typeof syncNow === "function"
                    ? syncNow
                    : typeof runSync === "function"
                        ? runSync
                        : pushHistoryToRemote;

            const result = await syncFn({ reason: "ChatScreen: message sync now" });

            setMessages((prev) =>
                prev.map((m) =>
                    m.id === msg.id
                        ? {
                            ...m,
                            isPending: false,
                            // This UI flag mirrors what HistoryContext will mark after a successful push.
                            isSynced: result.ok ? true : m.isSynced,
                        }
                        : m
                )
            );

            if (!result.ok) {
                Alert.alert(
                    "Sync issue",
                    result.errorMessage ||
                    "Could not sync right now. Your message is safe on this device."
                );
            }
        } catch (err) {
            console.warn("Sync now failed:", err);
            Alert.alert(
                "Sync error",
                "Could not sync right now. Your message is safe on this device."
            );
            setMessages((prev) =>
                prev.map((m) => (m.id === msg.id ? { ...m, isPending: false } : m))
            );
        } finally {
            setActionMessage(null);
        }
    };

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;

        const distanceFromBottom =
            contentSize.height - (contentOffset.y + layoutMeasurement.height);

        const atBottom = distanceFromBottom < 24;
        setShowScrollButton(!atBottom && distanceFromBottom > 80);
    };

    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset } = e.nativeEvent;
        setPullOffset(contentOffset.y);
        onScroll(e);
    };

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed) return;

        // ✅ 80/20: block double taps / overlapping send cycles
        if (isTyping || isSendingRef.current) return;
        isSendingRef.current = true;
        sendStartedAtRef.current = Date.now();

        const timestamp = Date.now();

        const userMessage: ChatMessage = {
            id: `u-${timestamp}`,
            from: "user",
            text: trimmed,
            timestamp,
            isSynced: false,
        };

        // IMPORTANT: Do NOT add extra properties to HistoryItem (keeps existing types stable)
        addToHistory({
            id: userMessage.id,
            text: userMessage.text,
            from: "user",
            timestamp: userMessage.timestamp,
            isSynced: false,
        });

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setInputHeight(40);

        setIsTyping(true);
        typingStartedAtRef.current = Date.now();
        setTypingStatus("thinking");

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        const networkNote =
            "\n\n(I'm replying from your device because the network is a little slow.)";

        typingTimeoutRef.current = setTimeout(() => {
            (async () => {
                try {
                    const wantsCloud = analysisMode !== "local";
                    const wantsInsights = emotionInsightsEnabled;

                    // 1) Try cloud if allowed by Analysis Mode
                    const remote: any = wantsCloud
                        ? await callImotaraAI(trimmed, {
                            // ✅ always send toneContext if present (server can decide what to use)
                            toneContext: toneContext ?? undefined,

                            analysisMode: analysisMode,
                            emotionInsightsEnabled: wantsInsights,

                            // ✅ persona hints: prefer companion settings when enabled, else fall back to user settings
                            settings: {
                                relationshipTone:
                                    (toneContext?.companion?.enabled
                                        ? toneContext?.companion?.relationship
                                        : undefined) ?? toneContext?.user?.relationship,

                                ageTone:
                                    (toneContext?.companion?.enabled
                                        ? toneContext?.companion?.ageRange
                                        : undefined) ?? toneContext?.user?.ageRange,

                                genderTone:
                                    (toneContext?.companion?.enabled
                                        ? toneContext?.companion?.gender
                                        : undefined) ?? toneContext?.user?.gender,
                            },

                            recentMessages: messages.slice(-6).map((m) => ({
                                role: m.from === "user" ? "user" : "assistant",
                                content: m.text,
                            })),
                        })
                        : { ok: false, replyText: "" };

                    console.log("[imotara] remote:", {
                        ok: remote?.ok,
                        replyText: remote?.replyText,
                        followUp: remote?.followUp,
                        reflectionSeed: remote?.reflectionSeed,
                    });

                    let replyText: string;
                    let moodHint: string | undefined;
                    let source: ChatMessageSource = "local";

                    // ✅ NEW: parity metadata (optional; safe if aiClient doesn't return it yet)
                    let reflectionSeed: ReflectionSeed | undefined;
                    let followUp: string | undefined;
                    let compatibility: any | undefined;

                    // 2) If cloud succeeded, respect it
                    if (remote.ok && String(remote.replyText || "").trim().length > 0) {
                        replyText = String(remote.replyText);
                        source = "cloud";

                        reflectionSeed = remote.reflectionSeed;
                        followUp = typeof remote.followUp === "string" ? remote.followUp : undefined;

                        compatibility = remote?.meta?.compatibility ?? remote?.response?.meta?.compatibility;

                        // Only show mood/insight hint if Emotion Insights is enabled
                        moodHint = wantsInsights ? getLocalMoodHint(trimmed) : undefined;
                    } else {
                        // 3) Otherwise fallback to local
                        const local = generateLocalBotResponse(trimmed, wantsInsights);
                        replyText = local.replyText + (wantsCloud ? networkNote : "");
                        moodHint = wantsInsights ? local.moodHint : undefined;
                        source = "local";
                    }

                    const botTimestamp = Date.now();
                    const botMessage: ChatMessage = {
                        id: `b-${botTimestamp}`,
                        from: "bot",
                        text: replyText,
                        timestamp: botTimestamp,
                        moodHint,
                        isSynced: false,
                        source,

                        // ✅ NEW parity metadata
                        reflectionSeed,
                        followUp,

                        // Debug-only: attach compatibility meta if present
                        ...(compatibility ? { meta: { compatibility } } : {}),
                    };

                    addToHistory({
                        id: botMessage.id,
                        text: botMessage.text,
                        from: "bot",
                        timestamp: botMessage.timestamp,
                        isSynced: false,
                        source: botMessage.source,
                    });

                    if (!mountedRef.current) return;

                    setTypingStatus("responding");
                    setMessages((prev) => [...prev, botMessage]);
                    smoothScrollToBottom(scrollViewRef);
                } catch (error) {
                    console.warn("Imotara mobile AI error:", error);

                    const wantsCloud = analysisMode !== "local";
                    const wantsInsights = emotionInsightsEnabled;

                    const local = generateLocalBotResponse(trimmed, wantsInsights);

                    const replyWithNote = wantsCloud
                        ? local.replyText + networkNote
                        : local.replyText;

                    const botTimestamp = Date.now();
                    const botMessage: ChatMessage = {
                        id: `b-${botTimestamp}`,
                        from: "bot",
                        text: replyWithNote,
                        timestamp: botTimestamp,
                        moodHint: wantsInsights ? local.moodHint : undefined,
                        isSynced: false,
                        source: "local",
                    };

                    addToHistory({
                        id: botMessage.id,
                        text: botMessage.text,
                        from: "bot",
                        timestamp: botMessage.timestamp,
                        isSynced: false,
                        source: botMessage.source,
                    });

                    if (!mountedRef.current) return;

                    setTypingStatus("responding");
                    setMessages((prev) => [...prev, botMessage]);
                    smoothScrollToBottom(scrollViewRef);
                }
                finally {
                    if (!mountedRef.current) return;

                    setIsTyping(false);
                    setTypingStatus("idle");

                    // ✅ release send-lock after full cycle ends
                    isSendingRef.current = false;
                }
            })();
        }, 800);
    };

    // Hydrate from persisted history on first load
    useEffect(() => {
        if (messages.length === 0 && history.length > 0) {
            const sorted = [...history].sort(
                (a: any, b: any) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
            );

            const hydrated: ChatMessage[] = sorted.map((h: any) => ({
                id: h.id,
                from: h.from,
                text: h.text,
                timestamp: h.timestamp,
                isSynced: h.isSynced,
                source: h.source,
            }));

            setMessages(hydrated);
            smoothScrollToBottom(scrollViewRef);
        }
    }, [history, messages.length]);

    const handleInputChange = (text: string) => {
        setInput(text);
    };

    // ✅ Better multiline resize than onLayout (keeps your behavior, but actually works as text grows)
    const handleContentSizeChange = (e: any) => {
        const height = e?.nativeEvent?.contentSize?.height ?? 40;
        const minHeight = 40;
        const maxHeight = 120;
        const nextHeight = Math.min(Math.max(height + 14, minHeight), maxHeight);
        setInputHeight(nextHeight);
    };

    const renderSessionDivider = (current: ChatMessage, prev?: ChatMessage) => {
        if (!prev) return null;

        const gap = current.timestamp - (prev.timestamp ?? 0);
        if (gap <= SESSION_GAP_MS) return null;

        return (
            <View
                style={{
                    alignSelf: "center",
                    marginVertical: 6,
                    flexDirection: "row",
                    alignItems: "center",
                }}
            >
                <View
                    style={{
                        flex: 1,
                        height: 1,
                        backgroundColor: colors.border,
                        opacity: 0.5,
                        marginRight: 8,
                    }}
                />
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    New session
                </Text>
                <View
                    style={{
                        flex: 1,
                        height: 1,
                        backgroundColor: colors.border,
                        opacity: 0.5,
                        marginLeft: 8,
                    }}
                />
            </View>
        );
    };

    const renderBubble = (message: ChatMessage, index: number) => {
        const isUser = message.from === "user";

        // ✅ Step 7 continuity note (hook-safe)
        const showContinuityNote = isFirstBotReplyOfSession(message, index, messages);

        let bubbleBorderColor: string;
        let statusLabel: string;
        let statusBg: string;
        let statusTextColor: string;

        const bubbleBackground = USER_BUBBLE_BG;
        let gradientStart: string | null = null;
        let gradientEnd: string | null = null;

        if (!isUser) {
            const tintSource = message.moodHint || message.text;
            const tint = getMoodTintForHint(tintSource);
            const gradient = getMoodGradient(tint);
            gradientStart = gradient.start;
            gradientEnd = gradient.end;
        }

        if (message.isPending) {
            bubbleBorderColor = "rgba(148, 163, 184, 0.55)";
            statusLabel = "Syncing…";
            statusBg = "rgba(148, 163, 184, 0.18)";
            statusTextColor = colors.textSecondary;
        } else if (message.isSynced) {
            bubbleBorderColor = colors.primary;
            statusLabel = "Synced to cloud";
            statusBg = "rgba(56, 189, 248, 0.18)";
            statusTextColor = colors.textPrimary;
        } else {
            const lower = (lastSyncStatus || "").toLowerCase();
            const hasSyncError = lower.includes("failed") || lower.includes("error");
            const isCloudGenerated = message.source === "cloud";

            if (hasSyncError) {
                bubbleBorderColor = "#f97373";
                statusLabel = isCloudGenerated
                    ? "Sync issue · cloud reply (not saved)"
                    : "Sync issue · on this device only";
                statusBg = "rgba(248, 113, 113, 0.24)";
                statusTextColor = "#fecaca";
            } else {
                // Not yet synced: show a truthful label based on where the reply came from
                if (isCloudGenerated) {
                    bubbleBorderColor = "rgba(56, 189, 248, 0.55)";
                    statusLabel = "Imotara Cloud (not saved)";
                    statusBg = "rgba(56, 189, 248, 0.14)";
                    statusTextColor = colors.textPrimary;
                } else {
                    bubbleBorderColor = "#fca5a5";
                    statusLabel = "On this device only";
                    statusBg = "rgba(248, 113, 113, 0.18)";
                    statusTextColor = "#fecaca";
                }
            }
        }

        const prev = messages[index - 1];

        let sourceIcon = "";
        if (!isUser) {
            if (message.source === "local") sourceIcon = " 🌙";
            else if (message.source === "cloud") sourceIcon = " ☁️";
        }

        const content = (
            <>
                <Text
                    style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: colors.textPrimary,
                        opacity: 0.75,
                        marginBottom: 2,
                    }}
                >
                    {isUser
                        ? "You"
                        : `Imotara${sourceIcon}${getMoodEmojiForHint(message.moodHint)}`}
                </Text>

                {!isUser ? (() => {
                    const seed = getReflectionSeedCard({
                        message: message.text,
                        reflectionSeed: message.reflectionSeed,
                    } as any);

                    if (!seed) return null;

                    return (
                        <View
                            style={{
                                marginBottom: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.12)",
                                backgroundColor: "rgba(0,0,0,0.22)",
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                }}
                            >
                                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>
                                    {seed.title}
                                </Text>
                                <View
                                    style={{
                                        paddingHorizontal: 8,
                                        paddingVertical: 2,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.12)",
                                        backgroundColor: "rgba(255,255,255,0.06)",
                                    }}
                                >
                                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                                        {seed.label}
                                    </Text>
                                </View>
                            </View>

                            <Text style={{ marginTop: 4, fontSize: 12, color: colors.textPrimary, opacity: 0.92 }}>
                                {seed.prompt}
                            </Text>
                        </View>
                    );
                })() : null}

                <Text style={{ fontSize: 14, color: colors.textPrimary }}>
                    {message.text}
                </Text>

                {/* ✅ NEW: render follow-up question (bot only) */}
                {!isUser && typeof message.followUp === "string" && message.followUp.trim() ? (
                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.textPrimary,
                            marginTop: 8,
                            opacity: 0.92,
                        }}
                    >
                        {message.followUp.trim()}
                    </Text>
                ) : null}

                {message.moodHint && (
                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.textPrimary,
                            marginTop: 4,
                            opacity: 0.9,
                        }}
                    >
                        {message.moodHint}
                    </Text>
                )}

                <Text
                    style={{
                        fontSize: 11,
                        color: colors.textSecondary,
                        marginTop: 4,
                        opacity: 0.85,
                    }}
                >
                    {new Date(message.timestamp).toLocaleTimeString()}
                </Text>

                {/* Compatibility badge (DEBUG only) */}
                {DEBUG_UI_ENABLED && message.meta?.compatibility && (
                    <View
                        style={{
                            alignSelf: "flex-start",
                            marginTop: 4,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor:
                                message.meta.compatibility.ok === true
                                    ? "rgba(34,197,94,0.6)"
                                    : "rgba(248,113,113,0.6)",
                            backgroundColor:
                                message.meta.compatibility.ok === true
                                    ? "rgba(34,197,94,0.15)"
                                    : "rgba(248,113,113,0.15)",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: "500",
                                color: colors.textPrimary,
                            }}
                        >
                            {typeof message.meta.compatibility.summary === "string"
                                ? message.meta.compatibility.summary
                                : message.meta.compatibility.ok === true
                                    ? "OK"
                                    : "Issues"}
                        </Text>
                    </View>
                )}

                <View
                    style={{
                        alignSelf: isUser ? "flex-end" : "flex-start",
                        marginTop: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor:
                            bubbleBorderColor === "transparent"
                                ? "rgba(148, 163, 184, 0.4)"
                                : bubbleBorderColor,
                        backgroundColor: statusBg,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 10,
                            fontWeight: "500",
                            color: statusTextColor,
                        }}
                    >
                        {statusLabel}
                    </Text>
                </View>

                {/* ✅ continuity note */}
                {!isUser && showContinuityNote && (
                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.textSecondary,
                            marginTop: 6,
                            opacity: 0.9,
                        }}
                    >
                        This conversation is now part of your Emotion History.
                    </Text>
                )}
            </>
        );

        const extraTopSpace =
            isUser && index > 0 && messages[index - 1].from === "user"
                ? { marginTop: 4 }
                : {};

        const onLongPress = message.isPending
            ? undefined
            : () => setActionMessage(message);

        return (
            <View key={message.id} style={extraTopSpace}>
                {renderSessionDivider(message, prev)}
                <Pressable
                    onLongPress={onLongPress}
                    delayLongPress={250}
                    style={{
                        alignSelf: isUser ? "flex-end" : "flex-start",
                        maxWidth: "82%",
                        marginBottom: 10,
                        paddingHorizontal: 1,
                    }}
                >
                    {isUser ? (
                        <View
                            style={{
                                backgroundColor: bubbleBackground,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 16,
                                borderWidth:
                                    bubbleBorderColor === "transparent" ? 0 : 1,
                                borderColor: bubbleBorderColor,
                            }}
                        >
                            {content}
                        </View>
                    ) : (
                        <LinearGradient
                            colors={[
                                gradientStart || "rgba(148, 163, 184, 0.25)",
                                gradientEnd || "rgba(148, 163, 184, 0.45)",
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={{
                                borderRadius: 16,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderWidth:
                                    bubbleBorderColor === "transparent" ? 0 : 1,
                                borderColor:
                                    bubbleBorderColor === "transparent"
                                        ? "rgba(148, 163, 184, 0.4)"
                                        : bubbleBorderColor,
                            }}
                        >
                            {content}
                        </LinearGradient>
                    )}
                </Pressable>
            </View>
        );
    };

    const renderActionSheet = () => {
        if (!actionMessage) return null;

        const canSyncNow =
            !actionMessage.isSynced &&
            !actionMessage.isPending &&
            !isSyncing;

        const deleteLabel =
            actionMessage.from === "user"
                ? "Delete (and delete paired reply)"
                : "Delete message";

        return (
            <>
                <Pressable
                    onPress={closeActionSheet}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.25)",
                    }}
                />
                <View
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(15, 23, 42, 0.92)",
                        paddingHorizontal: 16,
                        paddingTop: 10,
                        paddingBottom: 20,
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                    }}
                >
                    <View style={{ alignItems: "center", marginBottom: 8 }}>
                        <View
                            style={{
                                width: 40,
                                height: 4,
                                borderRadius: 999,
                                backgroundColor: "rgba(148, 163, 184, 0.9)",
                            }}
                        />
                    </View>

                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.textSecondary,
                            marginBottom: 10,
                        }}
                    >
                        Message actions
                    </Text>

                    <View
                        style={{
                            backgroundColor: colors.surfaceSoft,
                            borderRadius: 12,
                            padding: 10,
                            marginBottom: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <Text style={{ fontSize: 12, color: colors.textPrimary }}>
                            {actionMessage.text}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => handleCopyMessage(actionMessage.text)}
                        style={{ paddingVertical: 10 }}
                    >
                        <Text style={{ fontSize: 14, color: colors.textPrimary }}>
                            Copy text
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleShowTimestamp(actionMessage)}
                        style={{ paddingVertical: 10 }}
                    >
                        <Text style={{ fontSize: 14, color: colors.textPrimary }}>
                            Show timestamp
                        </Text>
                    </TouchableOpacity>

                    {canSyncNow && (
                        <TouchableOpacity
                            onPress={() => handleSyncNowForMessage(actionMessage)}
                            style={{ paddingVertical: 10 }}
                        >
                            <Text style={{ fontSize: 14, color: colors.textPrimary }}>
                                Sync now (try cloud)
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={() => {
                            Alert.alert(
                                "Delete message",
                                actionMessage.from === "user"
                                    ? "Delete this message and its paired reply?"
                                    : "Delete this message?",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Delete",
                                        style: "destructive",
                                        onPress: () =>
                                            handleDeleteMessage(actionMessage.id),
                                    },
                                ]
                            );
                        }}
                        style={{ paddingVertical: 10 }}
                    >
                        <Text style={{ fontSize: 14, color: "#fecaca" }}>
                            {deleteLabel}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={closeActionSheet}
                        style={{ paddingVertical: 10 }}
                    >
                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
                </View>
            </>
        );
    };

    const formattedTypingDots = ".".repeat(typingDots);

    const latestUserMessage = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].from === "user") return messages[i];
        }
        return null;
    }, [messages]);

    const latestMoodHint = useMemo(() => {
        if (!latestUserMessage) return null;
        if (!emotionInsightsEnabled) return null;
        return getLocalMoodHint(latestUserMessage.text);
    }, [emotionInsightsEnabled, latestUserMessage]);

    const typingStatusText = useMemo(() => {
        if (!isTyping) return "";
        if (typingStatus === "thinking") {
            return `Imotara is thinking about your feelings${formattedTypingDots}`;
        }
        return `Imotara is typing${formattedTypingDots}`;
    }, [isTyping, typingStatus, formattedTypingDots]);

    const typingBubbleBg = useMemo(() => {
        if (!isTyping) return "rgba(15, 23, 42, 0.9)";
        if (latestMoodHint) return getMoodTintForHint(latestMoodHint);
        return "rgba(15, 23, 42, 0.9)";
    }, [isTyping, latestMoodHint]);

    // ✅ 80/20: disable Send while typing or in-flight
    const isSendDisabled = input.trim().length === 0 || isTyping || isSendingRef.current;

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View
                style={{
                    paddingHorizontal: 16,
                    paddingTop: 2,
                    paddingBottom: 2,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                    backgroundColor: "rgba(15, 23, 42, 0.96)",
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            marginRight: 6,
                            backgroundColor: hasUnsynced
                                ? "#fbbf24"
                                : (lastSyncStatus || "").toLowerCase().includes("failed")
                                    ? "#f87171"
                                    : colors.primary,
                        }}
                    />

                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "700",
                            color: colors.textPrimary,
                        }}
                    >
                        Imotara
                    </Text>

                    <Text
                        style={{ marginLeft: 6, fontSize: 11, color: colors.textSecondary }}
                    >
                        (mobile preview)
                    </Text>
                </View>

                <Text
                    style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        marginTop: 2,
                        marginBottom: 4,
                    }}
                >
                    A calm space to talk about your feelings.
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                    <View
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            marginRight: 6,
                            backgroundColor: hasUnsynced ? "#f97373" : syncHintAccent,
                        }}
                    />
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {syncHint}
                    </Text>
                </View>

                {isSyncing && (
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        Syncing your latest messages…
                    </Text>
                )}

                {showRecentlySyncedPulse && (
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        ✅ All changes synced · Imotara cloud copy updated.
                    </Text>
                )}
            </View>

            {/* Chat area */}
            <View style={{ flex: 1 }}>
                {DEBUG_UI_ENABLED && refreshing && (
                    <Animated.View
                        style={{
                            position: "absolute",
                            top: 10,
                            left: 0,
                            right: 0,
                            alignItems: "center",
                            zIndex: 20,
                            opacity: pullAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.2, 1],
                            }),
                            transform: [
                                {
                                    scale: pullAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.9, 1.05],
                                    }),
                                },
                            ],
                        }}
                    >
                        <View
                            style={{
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                backgroundColor: "rgba(56, 189, 248, 0.8)",
                            }}
                        />
                    </Animated.View>
                )}

                <ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={{
                        paddingHorizontal: 14,
                        paddingTop: 4,
                        paddingBottom: 80,
                    }}
                    onScroll={handleScroll}
                    scrollEventThrottle={50}
                    onScrollEndDrag={() => {
                        if (!DEBUG_UI_ENABLED) return;
                        if (pullOffset < -60) handleRefresh();
                    }}
                >
                    {messages.length === 0 && (
                        <View style={{ paddingTop: 24, paddingBottom: 16 }}>
                            <Text
                                style={{
                                    fontSize: 15,
                                    color: colors.textSecondary,
                                    marginBottom: 6,
                                }}
                            >
                                Welcome to Imotara.
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                                You can start by sharing how your day feels, something that
                                bothered you, or something you’re looking forward to. Imotara
                                listens without judgment.
                            </Text>
                        </View>
                    )}

                    {DEBUG_UI_ENABLED && latestMoodHint && (
                        <View
                            style={{
                                marginBottom: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 12,
                                backgroundColor: "rgba(15, 23, 42, 0.9)",
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                                Mood glimpse (preview)
                            </Text>
                            <Text
                                style={{
                                    fontSize: 13,
                                    color: colors.textPrimary,
                                    marginTop: 2,
                                }}
                            >
                                {latestMoodHint}
                            </Text>
                        </View>
                    )}

                    {/* Compatibility Gate (report-only) */}
                    {DEBUG_UI_ENABLED && (() => {
                        // Find the most recent message (typically bot) that carries compatibility meta
                        let compat: any = null;

                        for (let i = messages.length - 1; i >= 0; i--) {
                            const c = messages[i]?.meta?.compatibility;
                            if (c) {
                                compat = c;
                                break;
                            }
                        }

                        if (!compat) return null;

                        const summary =
                            typeof compat.summary === "string"
                                ? compat.summary
                                : compat.ok === true
                                    ? "OK"
                                    : "NOT OK";

                        return (
                            <View
                                style={{
                                    marginBottom: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    borderRadius: 12,
                                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            >
                                <View
                                    style={{
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: "600",
                                            color: colors.textSecondary,
                                        }}
                                    >
                                        Compatibility Gate
                                    </Text>

                                    <Text
                                        style={{
                                            fontSize: 11,
                                            color: colors.textPrimary,
                                        }}
                                    >
                                        {summary}
                                    </Text>
                                </View>

                                <Text
                                    style={{
                                        marginTop: 8,
                                        fontSize: 11,
                                        color: colors.textSecondary,
                                    }}
                                >
                                    {JSON.stringify(compat, null, 2)}
                                </Text>
                            </View>
                        );
                    })()}

                    {messages.map((message, index) => renderBubble(message, index))}

                    {isTyping && (
                        <Animated.View
                            style={{
                                opacity: typingGlow.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.5, 1],
                                }),
                                transform: [
                                    {
                                        scale: typingGlow.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.98, 1.03],
                                        }),
                                    },
                                ],
                            }}
                        >
                            <View
                                style={{
                                    alignSelf: "flex-start",
                                    marginTop: 4,
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 999,
                                    backgroundColor: typingBubbleBg,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            >
                                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                                    {typingStatusText || "Imotara is typing…"}
                                </Text>
                            </View>
                        </Animated.View>
                    )}
                </ScrollView>

                {showScrollButton && (
                    <Animated.View
                        style={{
                            position: "absolute",
                            bottom: 80,
                            right: 16,
                            transform: [{ translateY: slideAnim }],
                            opacity: fadeAnim,
                        }}
                    >
                        <TouchableOpacity
                            onPress={scrollToBottom}
                            style={{
                                backgroundColor: colors.primary,
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 999,
                                shadowColor: "#000",
                                shadowOpacity: 0.25,
                                shadowOffset: { width: 0, height: 2 },
                                shadowRadius: 4,
                                elevation: 4,
                            }}
                        >
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
                                New messages ↓
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </View>

            {/* Input */}
            <View
                style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: "rgba(15, 23, 42, 0.98)",
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                    <View
                        style={{
                            flex: 1,
                            marginRight: 8,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: "rgba(15, 23, 42, 1)",
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            minHeight: 40,
                            justifyContent: "center",
                        }}
                    >
                        <TextInput
                            value={input}
                            onChangeText={setInput}
                            multiline
                            onContentSizeChange={(e) => {
                                const height = e?.nativeEvent?.contentSize?.height ?? 40;
                                const minHeight = 40;
                                const maxHeight = 120;
                                const nextHeight = Math.min(
                                    Math.max(height + 14, minHeight),
                                    maxHeight
                                );
                                setInputHeight(nextHeight);
                            }}
                            placeholder="Type something you feel..."
                            placeholderTextColor="rgba(148, 163, 184, 0.9)"
                            style={{
                                color: colors.textPrimary,
                                fontSize: 14,
                                maxHeight: 120,
                                minHeight: inputHeight,
                            }}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={isSendDisabled}
                        style={{
                            opacity: isSendDisabled ? 0.4 : 1,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 999,
                            backgroundColor: colors.primary,
                        }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "700" }}>Send</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {renderActionSheet()}
        </View>
    );
}
