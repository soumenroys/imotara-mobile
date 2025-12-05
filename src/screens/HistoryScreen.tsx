// src/screens/HistoryScreen.tsx
import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useHistoryStore } from "../state/HistoryContext";
import type { HistoryItem as HistoryRecord } from "../state/HistoryContext";
import { fetchRemoteHistory } from "../api/historyClient";
import colors from "../theme/colors";

const USER_BUBBLE_BG = "rgba(56, 189, 248, 0.35)";
const BOT_BUBBLE_BG = colors.surfaceSoft;

/**
 * Normalize any incoming remote object to a strict HistoryItem shape.
 * This prevents UI issues (e.g., all messages same color) when the backend
 * uses slightly different field names like `role`, `author`, `createdAt`, etc.
 */
function normalizeRemoteItem(raw: any): HistoryRecord | null {
    if (!raw) return null;

    // Extract text
    const text: string =
        typeof raw.text === "string"
            ? raw.text
            : typeof raw.message === "string"
                ? raw.message
                : typeof raw.content === "string"
                    ? raw.content
                    : "";

    if (!text.trim()) {
        // Ignore empty rows
        return null;
    }

    // Determine "from" (user vs bot), based on common backend fields
    const roleLike: string =
        (raw.from as string) ||
        (raw.role as string) ||
        (raw.author as string) ||
        (raw.speaker as string) ||
        "";

    let from: "user" | "bot" = "bot";
    const roleLower = roleLike.toLowerCase();

    if (roleLower === "user" || roleLower === "human" || roleLower === "you") {
        from = "user";
    } else if (
        roleLower === "assistant" ||
        roleLower === "bot" ||
        roleLower === "imotara" ||
        roleLower === "ai"
    ) {
        from = "bot";
    } else {
        // Fallback: if nothing is clear but raw.isUser flag exists, respect it
        if (raw.isUser === true) {
            from = "user";
        }
    }

    // Determine timestamp (number)
    let timestamp: number;

    if (typeof raw.timestamp === "number") {
        timestamp = raw.timestamp;
    } else if (typeof raw.createdAt === "number") {
        timestamp = raw.createdAt;
    } else if (typeof raw.createdAt === "string") {
        const parsed = Date.parse(raw.createdAt);
        timestamp = Number.isNaN(parsed) ? Date.now() : parsed;
    } else {
        timestamp = Date.now();
    }

    // Determine id, ensure it's a string
    const baseId =
        (raw.id as string) ||
        (raw._id as string) ||
        `${from}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;

    const id = String(baseId);

    return {
        id,
        text,
        from,
        timestamp,
    };
}

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

            // Normalize all remote items to our local HistoryItem shape
            const normalized = remote
                .map((item) => normalizeRemoteItem(item))
                .filter(Boolean) as HistoryRecord[];

            if (normalized.length === 0) {
                Alert.alert(
                    "Remote history",
                    "No valid items found on the backend yet.",
                    [{ text: "OK" }]
                );
                return;
            }

            // Merge without duplicates (by id)
            const existingIds = new Set(history.map((h) => h.id));
            let addedCount = 0;

            normalized.forEach((item) => {
                if (!existingIds.has(item.id)) {
                    addToHistory(item);
                    existingIds.add(item.id);
                    addedCount += 1;
                }
            });

            Alert.alert(
                "Remote history loaded",
                addedCount === 0
                    ? `No new items. Local history already contains all ${normalized.length} remote item(s).`
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

                {sortedHistory.map((item) => {
                    const isUser = item.from === "user";

                    return (
                        <View
                            key={item.id}
                            style={{
                                alignSelf: isUser
                                    ? "flex-end"
                                    : "flex-start",
                                maxWidth: "80%",
                                backgroundColor: isUser
                                    ? USER_BUBBLE_BG
                                    : BOT_BUBBLE_BG,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 16,
                                marginBottom: 10,
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
                                {item.text}
                            </Text>

                            <Text
                                style={{
                                    fontSize: 11,
                                    color: colors.textSecondary,
                                    marginTop: 4,
                                }}
                            >
                                {new Date(item.timestamp).toLocaleString()}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}
