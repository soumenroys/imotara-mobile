// src/screens/HistoryScreen.tsx
import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useHistoryStore } from "../state/HistoryContext";
import type { HistoryItem as HistoryRecord } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";
import { fetchRemoteHistory } from "../api/historyClient";
import colors from "../theme/colors";

const USER_BUBBLE_BG = "rgba(56, 189, 248, 0.35)";
const BOT_BUBBLE_BG = colors.surfaceSoft;

// If gap between messages > 45 minutes → consider it a "new session"
const SESSION_GAP_MS = 45 * 60 * 1000;

function getMoodEmojiForText(text: string): string {
    const lower = text.toLowerCase();

    const sad = ["sad", "down", "lonely", "hurt", "depressed", "blue"];
    const anxious = ["worry", "worried", "anxious", "stressed", "panic"];
    const angry = ["angry", "mad", "frustrated", "irritated", "furious"];
    const hopeful = ["hope", "hopeful", "better", "relieved", "excited"];
    const stuck = ["stuck", "lost", "confused", "unsure"];

    const match = (arr: string[]) => arr.some((w) => lower.includes(w));

    if (match(sad)) return "💙";      // sad-ish
    if (match(anxious)) return "💛";  // worried
    if (match(angry)) return "❤️";    // upset
    if (match(stuck)) return "🟣";     // confused/stuck
    if (match(hopeful)) return "💚";   // hopeful

    return "⚪️"; // neutral
}

function getEmotionSectionLabel(emoji: string): string {
    switch (emoji) {
        case "💙":
            return "Low / Sad moments";
        case "💛":
            return "Worried / Anxious moments";
        case "❤️":
            return "Upset / Angry moments";
        case "🟣":
            return "Stuck / Confused moments";
        case "💚":
            return "Hopeful moments";
        case "⚪️":
        default:
            return "Neutral / Mixed moments";
    }
}

/**
 * Normalize any incoming remote object to a strict HistoryItem shape.
 * This prevents UI issues when the backend uses slightly different
 * field names like `role`, `author`, `createdAt`, etc.
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
        isSynced: true,
    };
}

function formatDateLabel(timestamp: number): string {
    const d = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    if (sameDay(d, today)) return "Today";
    if (sameDay(d, yesterday)) return "Yesterday";

    return d.toLocaleDateString();
}

export default function HistoryScreen() {
    const { history, addToHistory } = useHistoryStore();
    const { lastSyncAt, lastSyncStatus } = useSettings();

    // For floating "scroll to latest" button
    const [showScrollButton, setShowScrollButton] = React.useState(false);
    const scrollRef = React.useRef<ScrollView>(null);

    const hasSyncError = React.useMemo(() => {
        const lower = (lastSyncStatus || "").toLowerCase();
        return lower.includes("failed") || lower.includes("error");
    }, [lastSyncStatus]);

    const formattedLastSync = lastSyncAt
        ? new Date(lastSyncAt).toLocaleString()
        : null;

    // how many messages are still local-only (not synced)
    const unsyncedCount = React.useMemo(
        () => history.filter((h) => !h.isSynced).length,
        [history]
    );

    // Compute a compact sync-status chip (top of screen)
    const syncChipMeta = React.useMemo(() => {
        // Defaults: never synced
        let label = "Sync status: never synced";
        let bg = "rgba(148, 163, 184, 0.20)"; // slate-400-ish
        let border = "#9ca3af";
        let textColor = colors.textSecondary;

        if (!lastSyncAt) {
            return { label, bg, border, textColor };
        }

        const lower = (lastSyncStatus || "").toLowerCase();

        if (lower.includes("failed") || lower.includes("error")) {
            label = "Sync issue · history is only on this device";
            bg = "rgba(248, 113, 113, 0.16)"; // soft red
            border = "#fca5a5";
            textColor = "#fecaca";
        } else if (
            lower.includes("pushed") ||
            lower.includes("merged") ||
            lower.includes("synced")
        ) {
            label = "Synced · recent history backed up";
            bg = "rgba(56, 189, 248, 0.16)"; // aurora cyan
            border = colors.primary;
            textColor = colors.textPrimary;
        } else {
            label = "Sync checked recently";
            bg = "rgba(148, 163, 184, 0.20)";
            border = "#9ca3af";
            textColor = colors.textSecondary;
        }

        return { label, bg, border, textColor };
    }, [lastSyncAt, lastSyncStatus]);

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
        () => [...history].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)),
        [history]
    );

    // Group by date for nicer visual structure
    const groupedHistory = React.useMemo(() => {
        const groups: {
            label: string;
            items: HistoryRecord[];
        }[] = [];

        let currentLabel: string | null = null;
        let currentItems: HistoryRecord[] = [];

        sortedHistory.forEach((item) => {
            const label = formatDateLabel(item.timestamp);

            if (label !== currentLabel) {
                if (currentItems.length > 0 && currentLabel) {
                    groups.push({ label: currentLabel, items: currentItems });
                }
                currentLabel = label;
                currentItems = [item];
            } else {
                currentItems.push(item);
            }
        });

        if (currentItems.length > 0 && currentLabel) {
            groups.push({ label: currentLabel, items: currentItems });
        }

        return groups;
    }, [sortedHistory]);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    paddingBottom: 80, // leave space for floating button
                }}
                onScroll={(e) => {
                    const { contentOffset, contentSize, layoutMeasurement } =
                        e.nativeEvent;

                    const distanceFromBottom =
                        contentSize.height -
                        (contentOffset.y + layoutMeasurement.height);

                    setShowScrollButton(distanceFromBottom > 120);
                }}
                scrollEventThrottle={50}
            >
                <Text
                    style={{
                        fontSize: 22,
                        fontWeight: "700",
                        marginBottom: 4,
                        color: colors.textPrimary,
                    }}
                >
                    Emotion History (Mobile)
                </Text>
                <Text
                    style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                        marginBottom: 4,
                    }}
                >
                    A simple preview of your recent conversations with Imotara on this
                    device.
                </Text>

                {/* Sync status chip (top, subtle but visible) */}
                <View
                    style={{
                        alignSelf: "flex-start",
                        marginTop: 4,
                        marginBottom: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: syncChipMeta.border,
                        backgroundColor: syncChipMeta.bg,
                        shadowColor: syncChipMeta.bg,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.7,
                        shadowRadius: 6,
                        elevation: 2,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: syncChipMeta.textColor,
                        }}
                    >
                        {syncChipMeta.label}
                    </Text>
                </View>

                {formattedLastSync && (
                    <Text
                        style={{
                            fontSize: 12,
                            color: colors.textSecondary,
                            marginBottom: 4,
                        }}
                    >
                        Last sync: {formattedLastSync}
                    </Text>
                )}

                {/* Unsynced summary with helper text */}
                {unsyncedCount > 0 && (
                    <View
                        style={{
                            marginBottom: 8,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 11,
                                color: hasSyncError ? "#fecaca" : colors.textSecondary,
                                fontWeight: hasSyncError ? "600" : "400",
                            }}
                        >
                            Unsynced messages on this device: {unsyncedCount}
                        </Text>
                        <Text
                            style={{
                                marginTop: 2,
                                fontSize: 11,
                                color: hasSyncError ? "#fecaca" : colors.textSecondary,
                            }}
                        >
                            {hasSyncError
                                ? "Imotara will try again when sync recovers."
                                : "They’ll be backed up automatically on the next successful sync."}
                        </Text>
                    </View>
                )}

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
                        borderColor: "#4ade80",
                        backgroundColor: "rgba(74, 222, 128, 0.16)", // greenish debug button
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

                {groupedHistory.map((group) => (
                    <View key={group.label} style={{ marginBottom: 18 }}>
                        {/* Date label */}
                        <Text
                            style={{
                                alignSelf: "center",
                                marginBottom: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 4,
                                borderRadius: 999,
                                fontSize: 12,
                                color: colors.textSecondary,
                                backgroundColor: colors.surfaceSoft,
                            }}
                        >
                            {group.label}
                        </Text>

                        {group.items.map((item, index) => {
                            const isUser = item.from === "user";

                            // Emotion-based section header (per date, per emotion)
                            let emotionHeader: string | null = null;
                            if (!isUser) {
                                const emoji = getMoodEmojiForText(item.text);
                                const label = getEmotionSectionLabel(emoji);

                                // Check if we already showed this emotion earlier in this date group
                                const hasPrevious = group.items
                                    .slice(0, index)
                                    .some(
                                        (prev) =>
                                            prev.from === "bot" &&
                                            getMoodEmojiForText(prev.text) === emoji
                                    );

                                if (!hasPrevious) {
                                    emotionHeader = `${emoji} ${label}`;
                                }
                            }

                            // Determine if this message starts a "new session"
                            let showSessionDivider = false;
                            if (index > 0) {
                                const prev = group.items[index - 1];
                                const gap = item.timestamp - (prev.timestamp ?? 0);
                                if (gap > SESSION_GAP_MS) {
                                    showSessionDivider = true;
                                }
                            }

                            // Bubble-level sync styling (bluish background, reddish borders for unsynced)
                            let bubbleBorderColor: string;
                            let statusLabel: string;
                            let statusBg: string;
                            let statusTextColor: string;
                            const bubbleBackground = isUser
                                ? USER_BUBBLE_BG
                                : BOT_BUBBLE_BG;

                            if (item.isSynced) {
                                // Synced: aurora cyan accent
                                bubbleBorderColor = colors.primary;
                                statusLabel = "Synced to cloud";
                                statusBg = "rgba(56, 189, 248, 0.18)";
                                statusTextColor = colors.textPrimary;
                            } else {
                                // Unsynced: red border + red-ish status chip, but keep blue bubble bg
                                if (hasSyncError) {
                                    bubbleBorderColor = "#f97373"; // stronger red
                                    statusLabel =
                                        "Sync issue · on this device only";
                                    statusBg = "rgba(248, 113, 113, 0.24)";
                                    statusTextColor = "#fecaca";
                                } else {
                                    bubbleBorderColor = "#fca5a5"; // softer red
                                    statusLabel = "On this device only";
                                    statusBg = "rgba(248, 113, 113, 0.18)";
                                    statusTextColor = "#fecaca";
                                }
                            }

                            return (
                                <View key={item.id}>
                                    {showSessionDivider && (
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
                                    )}

                                    {emotionHeader && (
                                        <Text
                                            style={{
                                                marginTop: 4,
                                                marginBottom: 2,
                                                fontSize: 11,
                                                color: colors.textSecondary,
                                                alignSelf: "flex-start",
                                            }}
                                        >
                                            {emotionHeader}
                                        </Text>
                                    )}

                                    {/* Bubble + sync info (long-press for full time) */}
                                    <TouchableOpacity
                                        activeOpacity={0.9}
                                        onLongPress={() =>
                                            Alert.alert(
                                                "Message timestamp",
                                                new Date(
                                                    item.timestamp
                                                ).toLocaleString()
                                            )
                                        }
                                        delayLongPress={250}
                                        style={{
                                            alignSelf: isUser
                                                ? "flex-end"
                                                : "flex-start",
                                            maxWidth: "80%",
                                            backgroundColor: bubbleBackground,
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 16,
                                            marginBottom: 10,
                                            borderWidth:
                                                bubbleBorderColor === "transparent"
                                                    ? 0
                                                    : 1,
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
                                            {isUser ? "You" : `Imotara ${getMoodEmojiForText(item.text)}`}
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
                                            {new Date(
                                                item.timestamp
                                            ).toLocaleTimeString()}
                                        </Text>

                                        {/* Sync badge for this bubble */}
                                        <View
                                            style={{
                                                alignSelf: isUser
                                                    ? "flex-end"
                                                    : "flex-start",
                                                marginTop: 4,
                                                paddingHorizontal: 10,
                                                paddingVertical: 4,
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor:
                                                    bubbleBorderColor ===
                                                        "transparent"
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

                                        {/* Subtle inline helper for unsynced items */}
                                        {!item.isSynced && (
                                            <TouchableOpacity
                                                onPress={handleLoadRemote}
                                            >
                                                <Text
                                                    style={{
                                                        marginTop: 4,
                                                        fontSize: 11,
                                                        color: "#93c5fd",
                                                        textDecorationLine:
                                                            "underline",
                                                        alignSelf: isUser
                                                            ? "flex-end"
                                                            : "flex-start",
                                                    }}
                                                >
                                                    Tap to check cloud copy
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                ))}
            </ScrollView>

            {/* Floating Scroll-to-Latest Button */}
            {showScrollButton && (
                <TouchableOpacity
                    onPress={() =>
                        scrollRef.current?.scrollToEnd({ animated: true })
                    }
                    style={{
                        position: "absolute",
                        bottom: 20,
                        right: 20,
                        backgroundColor: colors.primary,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
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
                            fontSize: 13,
                        }}
                    >
                        ↓ Latest
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
