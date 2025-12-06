// src/screens/ChatScreen.tsx
import React, {
    useState,
    useRef,
    useMemo,
    useEffect,
} from "react";
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

type ChatMessage = {
    id: string;
    from: "user" | "bot";
    text: string;
    timestamp: number;
    // Optional local-only mood hint (shown under bot replies)
    moodHint?: string;
    // Mirror of HistoryItem.isSynced (for per-bubble status)
    isSynced?: boolean;
};

const USER_BUBBLE_BG = "rgba(56, 189, 248, 0.35)"; // soft aurora cyan
const BOT_BUBBLE_BG = colors.surfaceSoft;

/**
 * Very simple local-only mood classifier.
 * No network calls, purely keyword-based and gentle in tone.
 */
function getLocalMoodHint(text: string): string | undefined {
    const lower = text.toLowerCase();

    const sadWords = [
        "sad",
        "upset",
        "depressed",
        "down",
        "lonely",
        "cry",
        "tired",
        "anxious",
        "anxiety",
        "worried",
    ];
    const angryWords = [
        "angry",
        "furious",
        "irritated",
        "annoyed",
        "frustrated",
        "hate",
        "rage",
    ];
    const stressedWords = [
        "stress",
        "stressed",
        "overwhelmed",
        "pressure",
        "burnout",
        "burned out",
    ];
    const happyWords = [
        "happy",
        "excited",
        "joy",
        "grateful",
        "thankful",
        "good",
        "great",
        "awesome",
    ];

    const containsAny = (words: string[]) => words.some((w) => lower.includes(w));

    if (containsAny(sadWords)) {
        return "You seem a bit low. It’s okay to feel this way — I’m here with you 🫂";
    }
    if (containsAny(angryWords)) {
        return "I can sense some anger or frustration. It’s valid — we can unpack it slowly together 🌧️➡️🌤️";
    }
    if (containsAny(stressedWords)) {
        return "It sounds like you’re under a lot of pressure. Let’s take it one step at a time 🌱";
    }
    if (containsAny(happyWords)) {
        return "I’m glad you’re feeling something positive. Let’s hold onto this moment of light ✨";
    }

    // Neutral / unknown tone → no extra hint
    return undefined;
}

/**
 * Single place to decide how Imotara replies on mobile.
 * Right now it's purely local and deterministic.
 * Later, this can call a real AI/analysis engine without changing ChatScreen.
 */
function generateLocalBotResponse(
    userText: string,
    insightsEnabled: boolean
): {
    replyText: string;
    moodHint?: string;
} {
    const replyText =
        "I hear you. In the real Imotara app, I’ll respond with empathy and emotional insight. " +
        "For now, this is a local-only mobile preview.";

    if (!insightsEnabled) {
        return { replyText, moodHint: undefined };
    }

    const moodHint = getLocalMoodHint(userText);
    return { replyText, moodHint };
}

export default function ChatScreen() {
    const [input, setInput] = useState("");
    const [inputHeight, setInputHeight] = useState(40);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [typingDots, setTypingDots] = useState(1);

    const {
        addToHistory,
        history,
        deleteFromHistory,
    } = useHistoryStore();
    const { emotionInsightsEnabled, lastSyncAt, lastSyncStatus } = useSettings();

    const scrollViewRef = useRef<ScrollView | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showScrollButton, setShowScrollButton] = useState(false);

    // When some messages become synced, we briefly pulse their sync badges.
    const [recentlySyncedAt, setRecentlySyncedAt] = useState<number | null>(null);

    // For Imotara bottom sheet actions
    const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);

    const isSendDisabled = input.trim().length === 0;

    const closeActionSheet = () => setActionMessage(null);

    // Animation for "New messages ↓" button (soft slide + fade)
    const slideAnim = useRef<Animated.Value>(new Animated.Value(20)).current;
    const fadeAnim = useRef<Animated.Value>(new Animated.Value(0)).current;

    // Pull-to-refresh custom pulse dot
    const [refreshing, setRefreshing] = useState(false);
    const [pullOffset, setPullOffset] = useState(0);
    const pullAnim = useRef<Animated.Value>(new Animated.Value(0)).current;

    // Small animated "..." effect while Imotara is typing
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

    // Cleanup any pending bot reply timeout when unmounting
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    // Clear the sync pulse after a short time
    useEffect(() => {
        if (recentlySyncedAt == null) return;
        const t = setTimeout(() => setRecentlySyncedAt(null), 900);
        return () => clearTimeout(t);
    }, [recentlySyncedAt]);

    // Animate "New messages ↓" button when it appears
    useEffect(() => {
        if (showScrollButton) {
            slideAnim.setValue(20);
            fadeAnim.setValue(0);

            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 180,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 180,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Reset for next time
            slideAnim.setValue(20);
            fadeAnim.setValue(0);
        }
    }, [showScrollButton, slideAnim, fadeAnim]);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed) return;

        const timestamp = Date.now();

        // 1) User message — captured immediately
        const userMessage: ChatMessage = {
            id: `u-${timestamp}`,
            from: "user",
            text: trimmed,
            timestamp,
            isSynced: false,
        };
        addToHistory({
            id: userMessage.id,
            text: userMessage.text,
            from: "user",
            timestamp: userMessage.timestamp,
            isSynced: false,
        });

        // Add user message immediately to on-screen chat
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setInputHeight(40);

        // Show typing indicator for Imotara
        setIsTyping(true);

        // Clear any existing bot timer (safety)
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // 2) After a short delay, generate and show Imotara's reply
        typingTimeoutRef.current = setTimeout(() => {
            // This is the "brain" — easy to swap later for real AI
            const { replyText, moodHint } = generateLocalBotResponse(
                trimmed,
                emotionInsightsEnabled
            );

            const botTimestamp = Date.now();
            const botMessage: ChatMessage = {
                id: `b-${botTimestamp}`,
                from: "bot",
                text: replyText,
                timestamp: botTimestamp,
                moodHint,
                isSynced: false,
            };

            addToHistory({
                id: botMessage.id,
                text: botMessage.text,
                from: "bot",
                timestamp: botMessage.timestamp,
                isSynced: false,
            });

            setMessages((prev) => [...prev, botMessage]);
            setIsTyping(false);
        }, 800); // ~0.8s feels responsive but still "thoughtful"
    };

    // Hydrate chat view from persisted history on first load
    useEffect(() => {
        // If chat has no messages yet but history store does,
        // hydrate the chat UI from history so it feels continuous.
        if (messages.length === 0 && history.length > 0) {
            const sorted = [...history].sort(
                (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
            );

            const hydrated: ChatMessage[] = sorted.map((h) => ({
                id: h.id,
                from: h.from,
                text: h.text,
                timestamp: h.timestamp,
                isSynced: !!h.isSynced,
            }));

            setMessages(hydrated);
        }
    }, [history, messages]);

    // Keep messages' isSynced in sync with HistoryContext
    useEffect(() => {
        setMessages((prevMessages) => {
            if (prevMessages.length === 0 || history.length === 0) {
                return prevMessages;
            }

            const historyById = new Map(
                history.map((h) => [h.id, h] as const)
            );

            let anyNewlySynced = false;

            const updated = prevMessages.map((msg) => {
                const h = historyById.get(msg.id);
                if (!h) return msg;

                const nextIsSynced = !!h.isSynced;
                if (!msg.isSynced && nextIsSynced) {
                    anyNewlySynced = true;
                }
                if (msg.isSynced === nextIsSynced) {
                    return msg;
                }
                return { ...msg, isSynced: nextIsSynced };
            });

            if (anyNewlySynced) {
                setRecentlySyncedAt(Date.now());
            }

            return updated;
        });
    }, [history]);

    // Group messages into (user + bot) "conversation chunks"
    const messagePairs = useMemo(() => {
        const pairs: { user?: ChatMessage; bot?: ChatMessage }[] = [];

        for (let i = 0; i < messages.length; i += 2) {
            const first = messages[i];
            const second = messages[i + 1];

            if (!second) {
                // Odd leftover message (e.g., user message while bot is still typing)
                if (first.from === "user") {
                    pairs.push({ user: first });
                } else {
                    pairs.push({ bot: first });
                }
            } else {
                // Try to align as user → bot
                let user: ChatMessage | undefined;
                let bot: ChatMessage | undefined;

                if (first.from === "user") {
                    user = first;
                    bot = second;
                } else if (second.from === "user") {
                    user = second;
                    bot = first;
                } else {
                    // Both same side (rare) – just put them in order
                    user = first;
                    bot = second;
                }

                pairs.push({ user, bot });
            }
        }

        return pairs;
    }, [messages]);

    // Latest user message (for mini-summary)
    const latestUserMessage = useMemo(
        () => [...messages].reverse().find((m) => m.from === "user"),
        [messages]
    );

    const miniSummaryText = useMemo(() => {
        if (!emotionInsightsEnabled) return undefined;
        if (!latestUserMessage) return undefined;

        const hint = getLocalMoodHint(latestUserMessage.text);
        if (hint) return hint;

        return "I’m still learning how you’re feeling. Share a bit more, at your own pace 💫";
    }, [emotionInsightsEnabled, latestUserMessage]);

    // -------------------------------------------------------------------------
    // Sync-aware hint (same colour language as HistoryScreen)
    // -------------------------------------------------------------------------
    const unsyncedCount = useMemo(
        () => history.filter((h) => !h.isSynced).length,
        [history]
    );

    const hasSyncError = useMemo(() => {
        const lower = (lastSyncStatus || "").toLowerCase();
        return lower.includes("failed") || lower.includes("error");
    }, [lastSyncStatus]);

    const formattedLastSync = lastSyncAt
        ? new Date(lastSyncAt).toLocaleString()
        : null;

    const syncHintMeta = useMemo(() => {
        let label = "Sync status: not synced yet";
        let bg = "rgba(148, 163, 184, 0.20)"; // slate-ish
        let border = "#9ca3af";
        let textColor = colors.textSecondary;

        if (hasSyncError) {
            label = "Sync issue · history is only on this device";
            bg = "rgba(248, 113, 113, 0.16)"; // soft red
            border = "#fca5a5";
            textColor = "#fecaca";
        } else if (unsyncedCount > 0) {
            label = `Unsynced messages on this device: ${unsyncedCount}`;
            bg = "rgba(248, 113, 113, 0.14)";
            border = "#fca5a5";
            textColor = "#fecaca";
        } else if (lastSyncAt) {
            label = "Synced · recent history backed up";
            bg = "rgba(56, 189, 248, 0.16)"; // aurora cyan
            border = colors.primary;
            textColor = colors.textPrimary;
        }

        return { label, bg, border, textColor };
    }, [hasSyncError, unsyncedCount, lastSyncAt]);

    // -------------------------------------------------------------------------
    // Long-press actions: copy / delete (bottom sheet)
    // -------------------------------------------------------------------------
    const handleCopyCurrent = async () => {
        if (!actionMessage) return;
        try {
            await Clipboard.setStringAsync(actionMessage.text);
        } catch (err) {
            console.warn("Failed to copy to clipboard:", err);
        }
        closeActionSheet();
    };

    const handleDeleteCurrent = () => {
        if (!actionMessage) return;

        const idToDelete = actionMessage.id;

        // 1) Delete selected message + (optionally) its paired reply
        deleteFromHistory(idToDelete);

        setMessages((prev) => {
            let updated = prev.filter((m) => m.id !== idToDelete);

            // If user message → also remove its next bot reply from this conversation
            if (actionMessage.from === "user") {
                const idx = prev.findIndex((m) => m.id === idToDelete);
                const next = prev[idx + 1];

                if (next && next.from === "bot") {
                    deleteFromHistory(next.id);
                    updated = updated.filter((m) => m.id !== next.id);
                }
            }

            return updated;
        });

        // 2) Auto-scroll to bottom if user was already near bottom
        setTimeout(() => {
            if (isAtBottom) {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }
        }, 50);

        closeActionSheet();
    };

    const formattedActionTimestamp = actionMessage
        ? new Date(actionMessage.timestamp).toLocaleString()
        : "";

    // -------------------------------------------------------------------------
    // Custom pull-to-refresh (pulse dot)
    // -------------------------------------------------------------------------
    const PULL_THRESHOLD = 60;

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;

        const distanceFromBottom =
            contentSize.height -
            (contentOffset.y + layoutMeasurement.height);

        const atBottom = distanceFromBottom < 40;
        setIsAtBottom(atBottom);

        if (atBottom) {
            setShowScrollButton(false);
        } else if (!refreshing) {
            setShowScrollButton(true);
        }

        // Pull-to-refresh tracking (only when not refreshing)
        const offsetY = contentOffset.y;
        if (offsetY < 0 && !refreshing) {
            setPullOffset((-offsetY));
        } else if (!refreshing && pullOffset !== 0) {
            setPullOffset(0);
        }
    };

    const onScrollEndDrag = () => {
        if (refreshing) return;

        if (pullOffset > PULL_THRESHOLD) {
            // Trigger a small "refresh" animation (UI only)
            setRefreshing(true);
            setPullOffset(0);

            pullAnim.setValue(0);
            Animated.sequence([
                Animated.timing(pullAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(pullAnim, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setRefreshing(false);
            });
        } else if (pullOffset !== 0) {
            setPullOffset(0);
        }
    };

    // Pulse dot base style
    const baseDotStyle = {
        position: "absolute" as const,
        top: 4,
        alignSelf: "center" as const,
        width: 14,
        height: 14,
        borderRadius: 999,
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        elevation: 3,
    };

    const pullProgress = Math.max(0, Math.min(pullOffset / PULL_THRESHOLD, 1));

    const staticDotStyle = {
        opacity: 0.2 + pullProgress * 0.6,
        transform: [
            {
                scale: 0.8 + pullProgress * 0.4,
            },
        ],
    };

    const animatedDotStyle = {
        opacity: pullAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.7, 0.1],
        }),
        transform: [
            {
                scale: pullAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.6],
                }),
            },
        ],
    };

    const showPulseDot = pullOffset > 0 || refreshing;

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Custom pull-to-refresh pulse dot */}
            {showPulseDot && (
                <Animated.View
                    style={[
                        baseDotStyle,
                        refreshing ? animatedDotStyle : staticDotStyle,
                    ]}
                />
            )}

            {/* Chat area */}
            <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    paddingBottom: 24,
                }}
                onContentSizeChange={() => {
                    // Only auto-scroll if user is already near the bottom
                    if (isAtBottom) {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                    } else if (!refreshing) {
                        setShowScrollButton(true);
                    }
                }}
                onScroll={onScroll}
                onScrollEndDrag={onScrollEndDrag}
                scrollEventThrottle={50}
            >
                <Text
                    style={{
                        fontSize: 22,
                        fontWeight: "700",
                        marginBottom: 6,
                        color: colors.textPrimary,
                    }}
                >
                    Imotara Chat (Mobile)
                </Text>
                <Text
                    style={{
                        fontSize: 14,
                        color: colors.textSecondary,
                        marginBottom: 10,
                    }}
                >
                    By default your messages stay on this device. If you use the sync
                    options in Settings, parts of your history may be backed up to the
                    Imotara cloud (preview).
                </Text>

                {/* Sync hint strip (aligned with HistoryScreen theme) */}
                <View
                    style={{
                        alignSelf: "flex-start",
                        marginBottom: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: syncHintMeta.border,
                        backgroundColor: syncHintMeta.bg,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: syncHintMeta.textColor,
                        }}
                    >
                        {syncHintMeta.label}
                    </Text>
                    {formattedLastSync && (
                        <Text
                            style={{
                                marginTop: 2,
                                fontSize: 10,
                                color: syncHintMeta.textColor,
                            }}
                        >
                            Last sync: {formattedLastSync}
                        </Text>
                    )}
                </View>

                {messagePairs.map((pair, index) => {
                    const key =
                        pair.user?.id ??
                        pair.bot?.id ??
                        `pair-${index.toString()}`;

                    return (
                        <View
                            key={key}
                            style={{
                                marginBottom: 16,
                            }}
                        >
                            {/* User bubble (if present) */}
                            {pair.user && (() => {
                                const isSynced = !!pair.user!.isSynced;
                                const statusLabel = isSynced
                                    ? "Synced to cloud"
                                    : hasSyncError
                                        ? "Sync issue · on this device only"
                                        : "On this device only";

                                const statusBg = isSynced
                                    ? "rgba(56, 189, 248, 0.18)"
                                    : hasSyncError
                                        ? "rgba(248, 113, 113, 0.18)"
                                        : "rgba(148, 163, 184, 0.20)";

                                const statusTextColor = isSynced
                                    ? colors.textPrimary
                                    : hasSyncError
                                        ? "#fecaca"
                                        : colors.textSecondary;

                                const pulse = !!recentlySyncedAt && isSynced;

                                return (
                                    <Pressable
                                        onLongPress={() => setActionMessage(pair.user!)}
                                        delayLongPress={250}
                                        style={({ pressed }) => [
                                            {
                                                alignSelf: "flex-end",
                                                backgroundColor: USER_BUBBLE_BG,
                                                paddingHorizontal: 14,
                                                paddingVertical: 10,
                                                borderRadius: 20,
                                                marginBottom: 6,
                                                maxWidth: "82%",
                                            },
                                            pressed && {
                                                shadowColor:
                                                    "rgba(56, 189, 248, 0.9)",
                                                shadowOpacity: 0.6,
                                                shadowRadius: 8,
                                                shadowOffset: {
                                                    width: 0,
                                                    height: 0,
                                                },
                                                elevation: 5,
                                                borderWidth: 1,
                                                borderColor: colors.primary,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                fontWeight: "600",
                                                color: colors.textSecondary,
                                                marginBottom: 2,
                                            }}
                                        >
                                            You
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                color: colors.textPrimary,
                                            }}
                                        >
                                            {pair.user.text}
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                color: colors.textSecondary,
                                                marginTop: 4,
                                            }}
                                        >
                                            {new Date(
                                                pair.user.timestamp
                                            ).toLocaleTimeString()}
                                        </Text>

                                        {/* Sync badge for user bubble */}
                                        <View
                                            style={{
                                                alignSelf: "flex-end",
                                                marginTop: 4,
                                                paddingHorizontal: 10,
                                                paddingVertical: 4,
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor: pulse
                                                    ? colors.primary
                                                    : "rgba(148, 163, 184, 0.4)",
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
                                    </Pressable>
                                );
                            })()}

                            {/* Bot bubble (if present) */}
                            {pair.bot && (() => {
                                const isSynced = !!pair.bot!.isSynced;
                                const statusLabel = isSynced
                                    ? "Synced to cloud"
                                    : hasSyncError
                                        ? "Sync issue · on this device only"
                                        : "On this device only";

                                const statusBg = isSynced
                                    ? "rgba(56, 189, 248, 0.18)"
                                    : hasSyncError
                                        ? "rgba(248, 113, 113, 0.18)"
                                        : "rgba(148, 163, 184, 0.20)";

                                const statusTextColor = isSynced
                                    ? colors.textPrimary
                                    : hasSyncError
                                        ? "#fecaca"
                                        : colors.textSecondary;

                                const pulse = !!recentlySyncedAt && isSynced;

                                return (
                                    <Pressable
                                        onLongPress={() => setActionMessage(pair.bot!)}
                                        delayLongPress={250}
                                        style={({ pressed }) => [
                                            {
                                                alignSelf: "flex-start",
                                                backgroundColor: BOT_BUBBLE_BG,
                                                paddingHorizontal: 14,
                                                paddingVertical: 10,
                                                borderRadius: 20,
                                                maxWidth: "82%",
                                            },
                                            pressed && {
                                                shadowColor:
                                                    "rgba(56, 189, 248, 0.9)",
                                                shadowOpacity: 0.6,
                                                shadowRadius: 8,
                                                shadowOffset: {
                                                    width: 0,
                                                    height: 0,
                                                },
                                                elevation: 5,
                                                borderWidth: 1,
                                                borderColor: colors.primary,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                fontWeight: "600",
                                                color: colors.textSecondary,
                                                marginBottom: 2,
                                            }}
                                        >
                                            Imotara
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                color: colors.textPrimary,
                                            }}
                                        >
                                            {pair.bot.text}
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                color: colors.textSecondary,
                                                marginTop: 4,
                                            }}
                                        >
                                            {new Date(
                                                pair.bot.timestamp
                                            ).toLocaleTimeString()}
                                        </Text>

                                        {/* Local-only mood hint (under bot reply) */}
                                        {emotionInsightsEnabled &&
                                            pair.bot.moodHint && (
                                                <Text
                                                    style={{
                                                        marginTop: 6,
                                                        fontSize: 12,
                                                        color: colors.textSecondary,
                                                    }}
                                                >
                                                    {pair.bot.moodHint}
                                                </Text>
                                            )}

                                        {/* Sync badge for bot bubble */}
                                        <View
                                            style={{
                                                alignSelf: "flex-start",
                                                marginTop: 4,
                                                paddingHorizontal: 10,
                                                paddingVertical: 4,
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor: pulse
                                                    ? colors.primary
                                                    : "rgba(148, 163, 184, 0.4)",
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
                                    </Pressable>
                                );
                            })()}
                        </View>
                    );
                })}

                {/* Typing indicator */}
                {isTyping && (
                    <View
                        style={{
                            alignSelf: "flex-start",
                            backgroundColor: BOT_BUBBLE_BG,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 20,
                            maxWidth: "60%",
                            marginBottom: 12,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: "600",
                                color: colors.textSecondary,
                                marginBottom: 2,
                            }}
                        >
                            Imotara
                        </Text>
                        <Text
                            style={{
                                fontSize: 20,
                                letterSpacing: 2,
                                color: colors.textSecondary,
                            }}
                        >
                            {".".repeat(typingDots)}
                        </Text>
                    </View>
                )}

                {/* Mini Mood Summary Card */}
                {miniSummaryText && (
                    <View
                        style={{
                            marginTop: 8,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: colors.primarySoft,
                            backgroundColor: colors.surfaceSoft,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: colors.textSecondary,
                                marginBottom: 4,
                            }}
                        >
                            Mini Mood Glimpse
                        </Text>
                        <Text
                            style={{
                                fontSize: 13,
                                color: colors.textPrimary,
                            }}
                        >
                            {miniSummaryText}
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Floating "New messages" button (bottom-right) with soft slide + fade */}
            {showScrollButton && (
                <Animated.View
                    style={{
                        position: "absolute",
                        right: 16,
                        bottom: 72,
                        transform: [{ translateY: slideAnim }],
                        opacity: fadeAnim,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => {
                            scrollViewRef.current?.scrollToEnd({ animated: true });
                            setIsAtBottom(true);
                            setShowScrollButton(false);
                        }}
                        style={{
                            backgroundColor: colors.primary,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 999,
                            shadowColor: colors.primary,
                            shadowOpacity: 0.35,
                            shadowRadius: 10,
                            shadowOffset: { width: 0, height: 0 },
                            elevation: 4,
                        }}
                    >
                        <Text
                            style={{
                                color: "#ffffff",
                                fontSize: 12,
                                fontWeight: "600",
                            }}
                        >
                            New messages ↓
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Input area */}
            <View
                style={{
                    flexDirection: "row",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    backgroundColor: colors.background,
                }}
            >
                <TextInput
                    placeholder="Type how you’re feeling..."
                    placeholderTextColor={colors.textSecondary}
                    value={input}
                    onChangeText={setInput}
                    multiline
                    onContentSizeChange={(e) => {
                        const h = e.nativeEvent.contentSize?.height ?? 40;
                        const clamped = Math.max(40, Math.min(120, h));
                        setInputHeight(clamped);
                    }}
                    style={{
                        flex: 1,
                        backgroundColor: "#ffffff",
                        color: "#111827",
                        borderWidth: 1,
                        borderColor: colors.primarySoft,
                        borderRadius: 999,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        fontSize: 14,
                        minHeight: 40,
                        maxHeight: 120,
                        height: inputHeight,
                        textAlignVertical: "top",
                    }}
                />

                {/* Send button with scale + cyan glow on press */}
                <Pressable
                    onPress={handleSend}
                    disabled={isSendDisabled}
                    style={({ pressed }) => [
                        {
                            marginLeft: 8,
                            paddingHorizontal: 18,
                            paddingVertical: 8,
                            borderRadius: 999,
                            justifyContent: "center",
                            alignItems: "center",
                            borderWidth: 1,
                            borderColor: isSendDisabled
                                ? colors.border
                                : "#ffffff99",
                            backgroundColor: "transparent",
                            opacity: isSendDisabled ? 0.5 : 1,
                        },
                        pressed && !isSendDisabled && {
                            transform: [{ scale: 0.92 }],
                            shadowColor: "rgba(56, 189, 248, 0.9)",
                            shadowOpacity: 0.7,
                            shadowRadius: 8,
                            shadowOffset: { width: 0, height: 0 },
                            elevation: 5,
                            borderColor: colors.primary,
                        },
                    ]}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: "#ffffff",
                        }}
                    >
                        Send
                    </Text>
                </Pressable>
            </View>

            {/* Imotara bottom sheet for message actions */}
            {actionMessage && (
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        justifyContent: "flex-end",
                        backgroundColor: "rgba(15, 23, 42, 0.55)", // slate overlay
                    }}
                >
                    {/* Tap on dimmed backdrop to close */}
                    <Pressable
                        style={{ flex: 1 }}
                        onPress={closeActionSheet}
                    />

                    <View
                        style={{
                            backgroundColor: colors.surfaceSoft,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingHorizontal: 18,
                            paddingTop: 14,
                            paddingBottom: 24,
                            borderTopWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <View
                            style={{
                                alignItems: "center",
                                marginBottom: 10,
                            }}
                        >
                            <View
                                style={{
                                    width: 40,
                                    height: 4,
                                    borderRadius: 999,
                                    backgroundColor: "rgba(148,163,184,0.7)",
                                }}
                            />
                        </View>

                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: colors.textPrimary,
                                marginBottom: 4,
                            }}
                        >
                            Message options
                        </Text>
                        <Text
                            style={{
                                fontSize: 11,
                                color: colors.textSecondary,
                                marginBottom: 12,
                            }}
                            numberOfLines={2}
                        >
                            {formattedActionTimestamp} ·{" "}
                            {actionMessage.from === "user" ? "You" : "Imotara"}
                        </Text>

                        {/* Copy */}
                        <TouchableOpacity
                            onPress={handleCopyCurrent}
                            style={{
                                paddingVertical: 10,
                                borderRadius: 12,
                                backgroundColor: "rgba(56,189,248,0.16)",
                                marginBottom: 8,
                            }}
                        >
                            <Text
                                style={{
                                    textAlign: "center",
                                    fontSize: 14,
                                    fontWeight: "600",
                                    color: colors.textPrimary,
                                }}
                            >
                                Copy message
                            </Text>
                        </TouchableOpacity>

                        {/* Delete locally */}
                        <TouchableOpacity
                            onPress={handleDeleteCurrent}
                            style={{
                                paddingVertical: 10,
                                borderRadius: 12,
                                backgroundColor: "rgba(248,113,113,0.16)",
                                marginBottom: 8,
                            }}
                        >
                            <Text
                                style={{
                                    textAlign: "center",
                                    fontSize: 14,
                                    fontWeight: "600",
                                    color: "#fecaca",
                                }}
                            >
                                Delete from this device
                            </Text>
                        </TouchableOpacity>

                        {/* Cancel */}
                        <TouchableOpacity
                            onPress={closeActionSheet}
                            style={{
                                paddingVertical: 10,
                                borderRadius: 12,
                                backgroundColor: "transparent",
                            }}
                        >
                            <Text
                                style={{
                                    textAlign: "center",
                                    fontSize: 14,
                                    fontWeight: "500",
                                    color: colors.textSecondary,
                                }}
                            >
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}
