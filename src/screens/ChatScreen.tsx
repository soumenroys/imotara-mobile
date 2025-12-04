// src/screens/ChatScreen.tsx
import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { useHistoryStore } from "../state/HistoryContext";
import colors from "../theme/colors";

type ChatMessage = {
    from: "user" | "bot";
    text: string;
};

const USER_BUBBLE_BG = "rgba(56, 189, 248, 0.35)"; // soft aurora cyan
const BOT_BUBBLE_BG = colors.surfaceSoft;

export default function ChatScreen() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const { addToHistory } = useHistoryStore();

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed) return;

        const timestamp = Date.now();

        // 1) User message
        const userMessage: ChatMessage = { from: "user", text: trimmed };
        addToHistory({
            id: `u-${timestamp}`,
            text: trimmed,
            from: "user",
            timestamp,
        });

        // 2) Simple local Imotara reply
        const botReply =
            "I hear you. In the real Imotara app, I’ll respond with empathy and emotional insight. " +
            "For now, this is a local-only mobile preview.";

        const botMessage: ChatMessage = { from: "bot", text: botReply };
        addToHistory({
            id: `b-${timestamp}`,
            text: botReply,
            from: "bot",
            timestamp: timestamp + 1,
        });

        // Add to on-screen chat list
        setMessages((prev) => [...prev, userMessage, botMessage]);
        setInput("");
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Chat area */}
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    paddingBottom: 24,
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

                {messages.map((msg, index) => {
                    const isUser = msg.from === "user";

                    return (
                        <View
                            key={index}
                            style={{
                                alignSelf: isUser ? "flex-end" : "flex-start",
                                backgroundColor: isUser ? USER_BUBBLE_BG : BOT_BUBBLE_BG,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 20,
                                marginBottom: 10,
                                maxWidth: "82%",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: colors.textPrimary,
                                }}
                            >
                                {msg.text}
                            </Text>
                        </View>
                    );
                })}
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
