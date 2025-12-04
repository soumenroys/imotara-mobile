// src/screens/HistoryScreen.tsx
import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useHistoryStore } from "../state/HistoryContext";
import { fetchRemoteHistory } from "../api/historyClient";
import colors from "../theme/colors";

const USER_BUBBLE_BG = "rgba(56, 189, 248, 0.35)";
const BOT_BUBBLE_BG = colors.surfaceSoft;

export default function HistoryScreen() {
    const { history, clearHistory, addToHistory } = useHistoryStore();

    // Debug-only: load remote history from backend and show it
    const handleLoadRemote = async () => {
        const remote = await fetchRemoteHistory();

        if (!Array.isArray(remote)) {
            Alert.alert("Remote fetch", "Unexpected response format.");
            return;
        }

        // Replace local history with remote preview
        clearHistory();
        remote.forEach((item) => addToHistory(item));

        Alert.alert(
            "Remote history loaded",
            `Loaded ${remote.length} item(s) into the preview.`,
            [{ text: "OK" }]
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
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
                        marginBottom: 8,
                        color: colors.textPrimary,
                    }}
                >
                    Emotion History (Mobile)
                </Text>

                {/* Debug: Load Remote History */}
                <TouchableOpacity
                    onPress={handleLoadRemote}
                    style={{
                        alignSelf: "flex-start",
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        borderRadius: 12,
                        borderWidth: 1,
                        marginBottom: 16,
                        borderColor: colors.primary,
                        backgroundColor: "rgba(56, 189, 248, 0.16)",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: colors.textPrimary,
                        }}
                    >
                        Load Remote History (debug)
                    </Text>
                </TouchableOpacity>

                {history.length === 0 && (
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textSecondary,
                            marginTop: 8,
                        }}
                    >
                        No history yet. Send a message in Chat to begin.
                    </Text>
                )}

                {history.map((item) => (
                    <View
                        key={item.id}
                        style={{
                            backgroundColor:
                                item.from === "user" ? USER_BUBBLE_BG : BOT_BUBBLE_BG,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 12,
                            marginBottom: 10,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: "500",
                                color: colors.textPrimary,
                            }}
                        >
                            {item.from === "user" ? "You:" : "Imotara:"}
                        </Text>

                        <Text
                            style={{
                                fontSize: 14,
                                color: colors.textPrimary,
                                marginTop: 2,
                            }}
                        >
                            {item.text}
                        </Text>

                        <Text
                            style={{
                                fontSize: 12,
                                color: colors.textSecondary,
                                marginTop: 4,
                            }}
                        >
                            {new Date(item.timestamp).toLocaleString()}
                        </Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}
