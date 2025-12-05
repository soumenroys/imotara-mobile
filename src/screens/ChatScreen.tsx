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
} from "react-native";
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
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [typingDots, setTypingDots] = useState(1);

    const { addToHistory } = useHistoryStore();
    const { emotionInsightsEnabled } = useSettings();

    const scrollViewRef = useRef<ScrollView | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        };
        addToHistory({
            id: userMessage.id,
            text: userMessage.text,
            from: "user",
            timestamp: userMessage.timestamp,
        });

        // Add user message immediately to on-screen chat
        setMessages((prev) => [...prev, userMessage]);
        setInput("");

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
            };

            addToHistory({
                id: botMessage.id,
                text: botMessage.text,
                from: "bot",
                timestamp: botMessage.timestamp,
            });

            setMessages((prev) => [...prev, botMessage]);
            setIsTyping(false);
        }, 800); // ~0.8s feels responsive but still "thoughtful"
    };

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

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Chat area */}
            <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    paddingBottom: 24,
                }}
                onContentSizeChange={() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }}
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
                        marginBottom: 16,
                    }}
                >
                    This is a local-only preview. No messages are sent to any server yet.
                </Text>

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
                            {pair.user && (
                                <View
                                    style={{
                                        alignSelf: "flex-end",
                                        backgroundColor: USER_BUBBLE_BG,
                                        paddingHorizontal: 14,
                                        paddingVertical: 10,
                                        borderRadius: 20,
                                        marginBottom: 6,
                                        maxWidth: "82%",
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
                                </View>
                            )}

                            {/* Bot bubble (if present) */}
                            {pair.bot && (
                                <View
                                    style={{
                                        alignSelf: "flex-start",
                                        backgroundColor: BOT_BUBBLE_BG,
                                        paddingHorizontal: 14,
                                        paddingVertical: 10,
                                        borderRadius: 20,
                                        maxWidth: "82%",
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
                                </View>
                            )}
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
                    }}
                />
                <TouchableOpacity
                    onPress={handleSend}
                    style={{
                        marginLeft: 8,
                        paddingHorizontal: 18,
                        paddingVertical: 8,
                        borderRadius: 999,
                        justifyContent: "center",
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: "#ffffff99",
                        backgroundColor: "transparent",
                    }}
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
                </TouchableOpacity>
            </View>
        </View>
    );
}
