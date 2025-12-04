// src/screens/HistoryScreen.tsx
import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useHistoryStore } from "../state/HistoryContext";
import { fetchRemoteHistory } from "../api/historyClient";
import colors from "../theme/colors";

const USER_BUBBLE_BG = "rgba(56, 189, 248, 0.35)";
const BOT_BUBBLE_BG = colors.surfaceSoft;

export default function HistoryScreen() {
    const { history, addToHistory } = useHistoryStore();

    // Debug-only: load remote history from backend and merge it into local history
    const handleLoadRemote = async () => {
        try {
            const remote = await fetchRemoteHistory();

            if (!Array.isArray(remote)) {
                Alert.alert("Remote fetch", "Unexpected response format.");
                return;
            }

            if (remote.length === 0) {
                Alert.alert(
                    "Remote history",
                    "No items found on the backend yet.",
                    [{ text: "OK" }]
                );
                return;
            }

            // Merge without duplicates (by id)
            const existingIds = new Set(history.map((h) => h.id));
            let addedCount = 0;

            remote.forEach((item) => {
                if (!existingIds.has(item.id)) {
                    addToHistory(item);
                    existingIds.add(item.id);
                    addedCount += 1;
                }
            });

            Alert.alert(
                "Remote history loaded",
                addedCount === 0
                    ? `No new items. Local history already contains all ${remote.length} remote item(s).`
                    : `Merged ${addedCount} new remote item(s) into local history.`,
                [{ text: "OK" }]
            );
        } catch (error) {
            console.warn("handleLoadRemote error:", error);
            Alert.alert(
                "Remote history error",
                "Could not load remote history right now. Please try again later.",
                [{ text: "OK" }]
            );
        }
    };

    // Always show history in chronological order (oldest first)
    const sortedHistory = React.useMemo(
        () =>
            [...history].sort(
                (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
            ),
        [history]
    );

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

                {sortedHistory.length === 0 && (
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

                {sortedHistory.map((item) => (
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
