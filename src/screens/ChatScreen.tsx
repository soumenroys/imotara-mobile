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
import { callImotaraAI } from "../api/aiClient";

type ChatMessage = {
    id: string;
    from: "user" | "bot";
    text: string;
    timestamp: number;
    // Optional local-only mood hint (preview)
    moodHint?: string;
    // Lite sync flag (mirrors HistoryItem)
    isSynced?: boolean;
};

// Local mood hint helper (same spirit as web app, but ultra-lightweight)
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

    const containsAny = (words: string[]) => words.some((w) => lower.includes(w));

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

    return {
        replyText,
        moodHint,
    };
}

// Decide bubble colors based on Aurora Calm theme
const USER_BUBBLE_BG = "rgba(56, 189, 248, 0.35)";
const BOT_BUBBLE_BG = colors.surfaceSoft;

// If gap between messages > 45 minutes → new session
const SESSION_GAP_MS = 45 * 60 * 1000;

type TypingStatus = "idle" | "thinking";

// On-screen Imotara message actions
type MessageAction = "copy" | "delete";

export default function ChatScreen() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [inputHeight, setInputHeight] = useState(40);
    const [isTyping, setIsTyping] = useState(false);
    const [typingDots, setTypingDots] = useState(1);

    // For subtle "recently synced" pulse in the header
    const [recentlySyncedAt, setRecentlySyncedAt] = useState<number | null>(
        null
    );

    // For Imotara bottom sheet actions
    const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);

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

    const [typingStatus, setTypingStatus] = useState<TypingStatus>("idle");

    // When some messages become synced, we briefly pulse
    const hasUnsynced = useMemo(
        () => history.some((h) => !h.isSynced),
        [history]
    );

    // Short "recently synced" chip
    const showRecentlySyncedPulse = useMemo(() => {
        if (recentlySyncedAt == null) return false;
        const diff = Date.now() - recentlySyncedAt;
        return diff < 8000; // ~8 seconds
    }, [recentlySyncedAt]);

    // Keep messages' isSynced flags aligned with history store
    useEffect(() => {
        if (history.length === 0) return;

        let anyNewlySynced = false;

        setMessages((prev) => {
            const updated = prev.map((m) => {
                const h = history.find((h) => h.id === m.id);
                if (!h) return m;
                if (m.isSynced === h.isSynced) return m;
                if (h.isSynced) anyNewlySynced = true;
                return {
                    ...m,
                    isSynced: h.isSynced,
                };
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

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (msg.from === "user") {
                const next = messages[i + 1];
                if (next && next.from === "bot") {
                    pairs.push({ user: msg, bot: next });
                    i++; // skip the next one
                } else {
                    pairs.push({ user: msg });
                }
            } else {
                // Orphaned bot message (rare, but possible after history hydration)
                pairs.push({ bot: msg });
            }
        }

        return pairs;
    }, [messages]);

    // Compute sync hint text
    const syncHint = useMemo(() => {
        if (!lastSyncAt) return "History is currently only on this device.";

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

    const [typingLabel, setTypingLabel] = useState<string>("");

    // Update typing dots animation
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

    // Animations for "New messages ↓" button
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

    // Pull-to-refresh custom pulse dot
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
        if (refreshing) return;
        setRefreshing(true);

        // Placeholder: we just show a small pulse and then stop.
        setTimeout(() => {
            setRefreshing(false);
        }, 800);
    };

    const scrollToBottom = () => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    };

    const [actionType, setActionType] = useState<MessageAction | null>(null);

    const isSendDisabled = input.trim().length === 0;

    const closeActionSheet = () => {
        setActionMessage(null);
        setActionType(null);
    };

    const handleDeleteMessage = (id: string) => {
        // Paired delete: remove both user and its immediate bot reply
        setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === id);
            if (idx === -1) return prev;

            const msg = prev[idx];

            // If user message, also try to delete the bot right after it
            if (msg.from === "user") {
                const next = prev[idx + 1];
                const idsToDelete = [msg.id];
                if (next && next.from === "bot") {
                    idsToDelete.push(next.id);
                }

                idsToDelete.forEach((deleteId) => deleteFromHistory(deleteId));

                return prev.filter((m) => !idsToDelete.includes(m.id));
            }

            // If bot bubble, just delete that one
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

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;

        const distanceFromBottom =
            contentSize.height - (contentOffset.y + layoutMeasurement.height);

        const atBottom = distanceFromBottom < 24;
        setIsAtBottom(atBottom);

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
        setTypingStatus("thinking");
        setTypingLabel("Imotara is thinking about your feelings…");

        // Clear any existing bot timer (safety)
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // 2) After a short delay, ask Imotara for a reply.
        //    We first try the remote AI; if that fails, we fall back
        //    to the existing local preview brain, so behaviour remains
        //    100% backward compatible.
        typingTimeoutRef.current = setTimeout(() => {
            (async () => {
                try {
                    // Try real Imotara backend first
                    const remote = await callImotaraAI(trimmed);

                    let replyText: string;
                    let moodHint: string | undefined;

                    if (remote.ok && remote.replyText.trim().length > 0) {
                        replyText = remote.replyText;
                        // We still compute a local mood hint (from the user text)
                        // so the mini mood glimpse + hint remain present.
                        if (emotionInsightsEnabled) {
                            moodHint = getLocalMoodHint(trimmed);
                        }
                    } else {
                        // Fallback to the exact same local behaviour as before
                        const local = generateLocalBotResponse(
                            trimmed,
                            emotionInsightsEnabled
                        );
                        replyText = local.replyText;
                        moodHint = local.moodHint;
                    }

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
                } catch (error) {
                    console.warn("Imotara mobile AI error:", error);
                    const local = generateLocalBotResponse(
                        trimmed,
                        emotionInsightsEnabled
                    );
                    const botTimestamp = Date.now();
                    const botMessage: ChatMessage = {
                        id: `b-${botTimestamp}`,
                        from: "bot",
                        text: local.replyText,
                        timestamp: botTimestamp,
                        moodHint: local.moodHint,
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
                } finally {
                    setIsTyping(false);
                    setTypingStatus("idle");
                    setTypingLabel("");
                }
            })();
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
                isSynced: h.isSynced,
            }));

            setMessages(hydrated);
            scrollToBottom();
        }
    }, [history, messages.length]);

    const handleInputChange = (text: string) => {
        setInput(text);
    };

    const handleInputLayout = (e: any) => {
        const { height } = e.nativeEvent.layout;
        const minHeight = 40;
        const maxHeight = 120;
        const nextHeight = Math.min(Math.max(height, minHeight), maxHeight);
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
                <Text
                    style={{
                        fontSize: 11,
                        color: colors.textSecondary,
                    }}
                >
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

        // Check sync status for this bubble
        let bubbleBorderColor: string;
        let statusLabel: string;
        let statusBg: string;
        let statusTextColor: string;
        const bubbleBackground = isUser ? USER_BUBBLE_BG : BOT_BUBBLE_BG;

        if (message.isSynced) {
            bubbleBorderColor = colors.primary;
            statusLabel = "Synced to cloud";
            statusBg = "rgba(56, 189, 248, 0.18)";
            statusTextColor = colors.textPrimary;
        } else {
            const lower = (lastSyncStatus || "").toLowerCase();
            const hasSyncError =
                lower.includes("failed") || lower.includes("error");

            if (hasSyncError) {
                bubbleBorderColor = "#f97373";
                statusLabel = "Sync issue · on this device only";
                statusBg = "rgba(248, 113, 113, 0.24)";
                statusTextColor = "#fecaca";
            } else {
                bubbleBorderColor = "#fca5a5";
                statusLabel = "On this device only";
                statusBg = "rgba(248, 113, 113, 0.18)";
                statusTextColor = "#fecaca";
            }
        }

        // For session divider, look at previous message (ignoring date group)
        const prev = messages[index - 1];

        return (
            <View key={message.id}>
                {renderSessionDivider(message, prev)}
                <Pressable
                    onLongPress={() => {
                        setActionMessage(message);
                        setActionType("copy");
                    }}
                    delayLongPress={250}
                    style={{
                        alignSelf: isUser ? "flex-end" : "flex-start",
                        maxWidth: "80%",
                        backgroundColor: bubbleBackground,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 16,
                        marginBottom: 10,
                        borderWidth:
                            bubbleBorderColor === "transparent" ? 0 : 1,
                        borderColor: bubbleBorderColor,
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
                        {isUser ? "You" : "Imotara"}
                    </Text>

                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                        }}
                    >
                        {message.text}
                    </Text>

                    {message.moodHint && (
                        <Text
                            style={{
                                fontSize: 11,
                                color: colors.textSecondary,
                                marginTop: 4,
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
                        }}
                    >
                        {new Date(message.timestamp).toLocaleTimeString()}
                    </Text>

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
                </Pressable>
            </View>
        );
    };

    const renderActionSheet = () => {
        if (!actionMessage || !actionType) return null;

        return (
            <View
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    paddingBottom: 20,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                <View
                    style={{
                        alignItems: "center",
                        marginBottom: 8,
                    }}
                >
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
                    Imotara message actions
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
                    <Text
                        style={{
                            fontSize: 12,
                            color: colors.textPrimary,
                        }}
                    >
                        {actionMessage.text}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => handleCopyMessage(actionMessage.text)}
                    style={{
                        paddingVertical: 10,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                        }}
                    >
                        Copy text
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => handleDeleteMessage(actionMessage.id)}
                    style={{
                        paddingVertical: 10,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            color: "#fecaca",
                        }}
                    >
                        Delete from history
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={closeActionSheet}
                    style={{
                        paddingVertical: 10,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textSecondary,
                        }}
                    >
                        Cancel
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    const formattedTypingDots = ".".repeat(typingDots);

    // Mini mood glimpse card near the top (based on last user message)
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

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: colors.background,
            }}
        >
            {/* Header area with sync + teen safe context */}
            <View
                style={{
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: "rgba(15, 23, 42, 0.96)",
                }}
            >
                <Text
                    style={{
                        fontSize: 20,
                        fontWeight: "700",
                        color: colors.textPrimary,
                        marginBottom: 4,
                    }}
                >
                    Imotara (Mobile Preview)
                </Text>
                <Text
                    style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                        marginBottom: 6,
                    }}
                >
                    A gentle space to talk about your feelings. This early version keeps
                    messages on this device, with an optional cloud backup preview.
                </Text>

                {/* Sync hint pill */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 2,
                    }}
                >
                    <View
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            marginRight: 6,
                            backgroundColor: hasUnsynced
                                ? "#f97373"
                                : syncHintAccent,
                        }}
                    />
                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.textSecondary,
                        }}
                    >
                        {syncHint}
                    </Text>
                </View>

                {showRecentlySyncedPulse && (
                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.textSecondary,
                            marginTop: 2,
                        }}
                    >
                        ✅ All changes synced · Imotara cloud copy updated.
                    </Text>
                )}
            </View>

            {/* Chat area */}
            <View style={{ flex: 1 }}>
                {/* Pull-to-refresh overlay pulse */}
                {refreshing && (
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
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: 80,
                    }}
                    onScroll={handleScroll}
                    scrollEventThrottle={50}
                    onScrollEndDrag={() => {
                        if (pullOffset < -60) {
                            handleRefresh();
                        }
                    }}
                >
                    {/* Intro text when no messages */}
                    {messages.length === 0 && (
                        <View
                            style={{
                                paddingTop: 24,
                                paddingBottom: 16,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 15,
                                    color: colors.textSecondary,
                                    marginBottom: 6,
                                }}
                            >
                                Welcome to Imotara.
                            </Text>
                            <Text
                                style={{
                                    fontSize: 13,
                                    color: colors.textSecondary,
                                }}
                            >
                                You can start by sharing how your day feels, something that
                                bothered you, or something you’re looking forward to. Imotara
                                listens without judgment.
                            </Text>
                        </View>
                    )}

                    {/* Mini mood glimpse (preview) */}
                    {latestMoodHint && (
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
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: colors.textSecondary,
                                }}
                            >
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

                    {/* All bubbles */}
                    {messages.map((message, index) =>
                        renderBubble(message, index)
                    )}

                    {/* Typing indicator */}
                    {isTyping && (
                        <View
                            style={{
                                alignSelf: "flex-start",
                                marginTop: 4,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 999,
                                backgroundColor: "rgba(15, 23, 42, 0.9)",
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: colors.textSecondary,
                                }}
                            >
                                {typingStatusText || "Imotara is typing…"}
                            </Text>
                        </View>
                    )}
                </ScrollView>

                {/* Floating "New messages ↓" button */}
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
                            <Text
                                style={{
                                    color: "#fff",
                                    fontWeight: "700",
                                    fontSize: 12,
                                }}
                            >
                                New messages ↓
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </View>

            {/* Input area */}
            <View
                style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: "rgba(15, 23, 42, 0.98)",
                }}
            >
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "flex-end",
                    }}
                >
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
                        }}
                    >
                        <TextInput
                            value={input}
                            onChangeText={handleInputChange}
                            multiline
                            onLayout={handleInputLayout}
                            placeholder="Type something you feel..."
                            placeholderTextColor="rgba(148, 163, 184, 0.9)"
                            style={{
                                color: colors.textPrimary,
                                fontSize: 14,
                                maxHeight: 120,
                                minHeight: 32,
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
                        <Text
                            style={{
                                color: "#fff",
                                fontWeight: "700",
                            }}
                        >
                            Send
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Action sheet overlay */}
            {renderActionSheet()}
        </View>
    );
}
