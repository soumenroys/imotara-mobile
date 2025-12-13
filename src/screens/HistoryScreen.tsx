// src/screens/HistoryScreen.tsx
import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useHistoryStore } from "../state/HistoryContext";
import type { HistoryItem as HistoryRecord } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";
import { fetchRemoteHistory } from "../api/historyClient";
import colors from "../theme/colors";
import AppButton from "../components/ui/AppButton";
import AppChip from "../components/ui/AppChip";
import { DEBUG_UI_ENABLED } from "../config/debug";

const USER_BUBBLE_BG = "rgba(56, 189, 248, 0.35)";
const BOT_BUBBLE_BG = colors.surfaceSoft;
const SESSION_GAP_MS = 45 * 60 * 1000;

function getMoodEmojiForText(text: string): string {
    const lower = (text || "").toLowerCase();

    const sad = [
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
        "low",
    ];
    const anxious = [
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
    const angry = [
        "angry",
        "mad",
        "frustrated",
        "annoyed",
        "irritated",
        "furious",
        "rage",
        "hate",
    ];
    const hopeful = [
        "hope",
        "hopeful",
        "better",
        "relieved",
        "excited",
        "good mood",
        "feeling good",
        "happy",
        "joyful",
        "cheerful",
    ];
    const stuck = [
        "stuck",
        "lost",
        "confused",
        "dont know",
        "don’t know",
        "no idea",
        "numb",
        "unsure",
    ];

    const match = (arr: string[]) => arr.some((w) => lower.includes(w));

    if (match(sad)) return "💙";
    if (match(anxious)) return "💛";
    if (match(angry)) return "❤️";
    if (match(stuck)) return "🟣";
    if (match(hopeful)) return "💚";

    return "⚪️";
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

function getMoodTintForTextBackground(text: string): string {
    const emoji = getMoodEmojiForText(text);

    switch (emoji) {
        case "💙":
            return colors.emotionSad;
        case "💛":
            return colors.emotionAnxious;
        case "❤️":
            return colors.emotionAngry;
        case "🟣":
            return colors.emotionConfused;
        case "💚":
            return colors.emotionHopeful;
        default:
            return BOT_BUBBLE_BG;
    }
}

function getMoodHaloColor(text: string): string {
    const emoji = getMoodEmojiForText(text);

    switch (emoji) {
        case "💙":
            return "rgba(96, 165, 250, 0.18)";
        case "💛":
            return "rgba(250, 204, 21, 0.18)";
        case "❤️":
            return "rgba(248, 113, 113, 0.18)";
        case "🟣":
            return "rgba(192, 132, 252, 0.18)";
        case "💚":
            return "rgba(74, 222, 128, 0.18)";
        default:
            return "rgba(148, 163, 184, 0.12)";
    }
}

function getBaseTextForMood(items: HistoryRecord[], index: number): string {
    const item = items[index];

    if (item.from === "user") return item.text;

    for (let i = index - 1; i >= 0; i--) {
        if (items[i].from === "user") return items[i].text;
    }

    return item.text;
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
    const navigation = useNavigation<any>();

    const {
        history,
        pushHistoryToRemote,
        mergeRemoteHistory,
        isSyncing,
        lastSyncResult,
        lastSyncAt: historyLastSyncAt,
        hasUnsyncedChanges,
    } = useHistoryStore();

    const { lastSyncAt, lastSyncStatus, autoSyncDelaySeconds } = useSettings();

    const scrollRef = React.useRef<ScrollView>(null);
    const [showScrollToLatest, setShowScrollToLatest] = React.useState(false);
    const [showScrollToTop, setShowScrollToTop] = React.useState(false);

    // ✅ QA hardening: prevent state updates after leaving screen
    const mountedRef = React.useRef(true);
    React.useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // ✅ QA hardening: avoid repeated remote-load taps
    const [isLoadingRemote, setIsLoadingRemote] = React.useState(false);

    const hasSyncError = React.useMemo(() => {
        if (lastSyncResult && !lastSyncResult.ok) return true;
        const lower = (lastSyncStatus || "").toLowerCase();
        return lower.includes("failed") || lower.includes("error");
    }, [lastSyncResult, lastSyncStatus]);

    const effectiveLastSyncAt = lastSyncAt || historyLastSyncAt || null;

    const formattedLastSync = effectiveLastSyncAt
        ? new Date(effectiveLastSyncAt).toLocaleString()
        : null;

    const unsyncedCount = React.useMemo(
        () => history.filter((h) => !h.isSynced).length,
        [history]
    );

    const topChip = React.useMemo(() => {
        if (!effectiveLastSyncAt) {
            return {
                label: "Sync status: never synced",
                variant: "neutral" as const,
                icon: "☁",
            };
        }

        const lower = (lastSyncStatus || "").toLowerCase();

        if (hasSyncError) {
            return {
                label: "Sync issue · history is only on this device",
                variant: "danger" as const,
                icon: "⚠",
            };
        }

        if (lower.includes("pushed") || lower.includes("merged") || lower.includes("synced")) {
            return {
                label: "Synced · recent history backed up",
                variant: "primary" as const,
                icon: "✓",
            };
        }

        return {
            label: "Sync checked recently",
            variant: "neutral" as const,
            icon: "☁",
        };
    }, [effectiveLastSyncAt, lastSyncStatus, hasSyncError]);

    const handleLoadRemote = async () => {
        // debug button is already gated, but keep this safe if called elsewhere
        if (!DEBUG_UI_ENABLED) return;

        if (isLoadingRemote) return;
        setIsLoadingRemote(true);

        try {
            const remote = await fetchRemoteHistory();

            if (!Array.isArray(remote)) {
                Alert.alert("Remote fetch", "Unexpected response format.");
                return;
            }

            const result = mergeRemoteHistory(remote);

            if (result.normalized === 0) {
                Alert.alert(
                    "Remote history",
                    "No valid items found on the backend yet."
                );
                return;
            }

            if (result.added === 0) {
                Alert.alert(
                    "Remote history",
                    `No new items. Local history already contains all ${result.normalized} remote item(s).`
                );
            } else {
                Alert.alert(
                    "Remote history",
                    `Merged ${result.added} new item(s) into local history.`
                );
            }
        } catch (error) {
            console.warn("handleLoadRemote error:", error);
            Alert.alert(
                "Remote history error",
                "Could not load remote history right now. Please try again later."
            );
        } finally {
            if (mountedRef.current) setIsLoadingRemote(false);
        }
    };

    const handleRetrySync = async () => {
        if (isSyncing) return;

        try {
            const result = await pushHistoryToRemote();

            if (result.ok) {
                const pushedCount =
                    typeof result.pushed === "number" ? result.pushed : 0;
                Alert.alert(
                    "Sync complete",
                    pushedCount > 0
                        ? `Pushed ${pushedCount} item(s) to the cloud.`
                        : "Everything is already in sync."
                );
            } else {
                Alert.alert(
                    "Sync issue",
                    result.errorMessage ||
                    "Could not sync right now. Please try again later."
                );
            }
        } catch (error) {
            console.warn("handleRetrySync error:", error);
            Alert.alert("Sync error", "Could not sync right now. Please try again later.");
        }
    };

    const handleGoToChat = () => {
        // keep behavior safe across any route name differences
        try {
            navigation.navigate("Chat");
            return;
        } catch { }
        try {
            navigation.navigate("ChatScreen");
            return;
        } catch { }
    };

    const sortedHistory = React.useMemo(
        () => [...history].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)),
        [history]
    );

    const groupedHistory = React.useMemo(() => {
        const groups: { label: string; items: HistoryRecord[] }[] = [];

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

    const retryLabel = isSyncing
        ? "Syncing…"
        : hasSyncError
            ? "Try sync again now"
            : "Sync now";

    const isEmpty = sortedHistory.length === 0;

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    paddingBottom: 80,
                }}
                onScroll={(e) => {
                    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;

                    const distanceFromBottom =
                        contentSize.height - (contentOffset.y + layoutMeasurement.height);

                    setShowScrollToLatest(distanceFromBottom > 120);
                    setShowScrollToTop(contentOffset.y > 80);
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
                        marginBottom: 6,
                    }}
                >
                    A simple preview of your recent conversations with Imotara on this device.
                </Text>

                <View style={{ marginTop: 4, marginBottom: 6 }}>
                    <AppChip
                        label={topChip.label}
                        variant={topChip.variant}
                        icon={topChip.icon}
                        animate
                    />
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

                {(unsyncedCount > 0 || hasUnsyncedChanges) && (
                    <View style={{ marginBottom: 8 }}>
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
                                ? "Imotara couldn’t reach the cloud recently. Your messages are safe on this device and will sync when the connection recovers."
                                : autoSyncDelaySeconds > 0
                                    ? `Imotara will auto-sync these in about ${autoSyncDelaySeconds}s when you’re online.`
                                    : "Imotara will sync these the next time you tap Sync."}
                        </Text>

                        <AppButton
                            title={retryLabel}
                            onPress={handleRetrySync}
                            disabled={isSyncing}
                            variant="primary"
                            size="sm"
                            style={{
                                alignSelf: "flex-start",
                                marginTop: 6,
                                borderRadius: 999,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderColor: isSyncing
                                    ? "rgba(148, 163, 184, 0.7)"
                                    : colors.primary,
                                backgroundColor: isSyncing
                                    ? "rgba(148, 163, 184, 0.2)"
                                    : "rgba(56, 189, 248, 0.18)",
                                opacity: isSyncing ? 0.7 : 1,
                            }}
                            textStyle={{
                                fontSize: 11,
                                fontWeight: "600",
                                color: colors.textPrimary,
                            }}
                        />

                        {isSyncing && (
                            <Text
                                style={{
                                    marginTop: 4,
                                    fontSize: 11,
                                    color: colors.textSecondary,
                                    fontStyle: "italic",
                                }}
                            >
                                Syncing in background…
                            </Text>
                        )}
                    </View>
                )}

                {/* Debug-only: Load remote history */}
                {DEBUG_UI_ENABLED && (
                    <AppButton
                        title={isLoadingRemote ? "Loading remote…" : "Load Remote History"}
                        onPress={handleLoadRemote}
                        disabled={isLoadingRemote}
                        variant="success"
                        size="sm"
                        style={{
                            alignSelf: "flex-start",
                            marginBottom: 16,
                            opacity: isLoadingRemote ? 0.7 : 1,
                        }}
                    />
                )}

                {/* ✅ Step 6: First-use empty state */}
                {isEmpty && (
                    <View
                        style={{
                            marginTop: 12,
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surfaceSoft,
                            padding: 16,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 16,
                                fontWeight: "700",
                                color: colors.textPrimary,
                                marginBottom: 6,
                            }}
                        >
                            Your story starts here ✨
                        </Text>

                        <Text
                            style={{
                                fontSize: 13,
                                color: colors.textSecondary,
                                lineHeight: 18,
                                marginBottom: 12,
                            }}
                        >
                            When you chat with Imotara, your conversation appears here as an “Emotion History”
                            so you can notice patterns, moods, and growth over time.
                        </Text>

                        <AppButton
                            title="Start in Chat"
                            onPress={handleGoToChat}
                            variant="primary"
                            style={{
                                alignSelf: "flex-start",
                                borderRadius: 999,
                                paddingHorizontal: 16,
                            }}
                        />

                        <Text
                            style={{
                                marginTop: 10,
                                fontSize: 12,
                                color: colors.textSecondary,
                            }}
                        >
                            Tip: long-press a message later to see the timestamp.
                        </Text>
                    </View>
                )}

                {/* History list */}
                {groupedHistory.map((group) => (
                    <View key={group.label} style={{ marginBottom: 18 }}>
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
                            const moodBaseText = getBaseTextForMood(group.items, index);

                            let emotionHeader: string | null = null;
                            if (!isUser) {
                                const emoji = getMoodEmojiForText(moodBaseText);
                                const label = getEmotionSectionLabel(emoji);

                                const hasPrevious = group.items
                                    .slice(0, index)
                                    .some((prev, prevIdx) => {
                                        if (prev.from !== "bot") return false;
                                        const prevBase = getBaseTextForMood(group.items, prevIdx);
                                        return getMoodEmojiForText(prevBase) === emoji;
                                    });

                                if (!hasPrevious) {
                                    emotionHeader = `${emoji} ${label}`;
                                }
                            }

                            let showSessionDivider = false;
                            if (index > 0) {
                                const prev = group.items[index - 1];
                                const gap = item.timestamp - (prev.timestamp ?? 0);
                                if (gap > SESSION_GAP_MS) showSessionDivider = true;
                            }

                            const bubbleBackground = isUser
                                ? USER_BUBBLE_BG
                                : getMoodTintForTextBackground(moodBaseText);

                            const moodHaloColor = !isUser
                                ? getMoodHaloColor(moodBaseText)
                                : "transparent";

                            const chipVariant = item.isSynced
                                ? ("primary" as const)
                                : hasSyncError
                                    ? ("danger" as const)
                                    : ("warning" as const);

                            const chipLabel = item.isSynced
                                ? "Synced to cloud"
                                : hasSyncError
                                    ? "Sync issue · device only"
                                    : "On this device only";

                            const chipIcon = item.isSynced ? "✓" : hasSyncError ? "⚠" : "📱";

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

                                    <View
                                        style={{
                                            alignSelf: isUser ? "flex-end" : "flex-start",
                                            maxWidth: "80%",
                                            padding: isUser ? 0 : 4,
                                            borderRadius: isUser ? 0 : 20,
                                            backgroundColor: moodHaloColor,
                                            marginBottom: 10,
                                        }}
                                    >
                                        <TouchableOpacity
                                            activeOpacity={0.9}
                                            onLongPress={() =>
                                                Alert.alert(
                                                    "Message timestamp",
                                                    new Date(item.timestamp).toLocaleString()
                                                )
                                            }
                                            delayLongPress={250}
                                            style={{
                                                alignSelf: "flex-start",
                                                maxWidth: "100%",
                                                backgroundColor: bubbleBackground,
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                                borderRadius: 16,
                                                borderWidth: 1,
                                                borderColor: colors.border,
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
                                                {isUser
                                                    ? "You"
                                                    : `Imotara ${getMoodEmojiForText(moodBaseText)}`}
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
                                                {new Date(item.timestamp).toLocaleTimeString()}
                                            </Text>

                                            <AppChip
                                                label={chipLabel}
                                                variant={chipVariant}
                                                icon={chipIcon}
                                                animate
                                                style={{
                                                    alignSelf: isUser ? "flex-end" : "flex-start",
                                                    marginTop: 6,
                                                }}
                                            />

                                            {!item.isSynced && (
                                                <AppButton
                                                    title={
                                                        isLoadingRemote
                                                            ? "Checking cloud…"
                                                            : "Tap to check cloud copy"
                                                    }
                                                    onPress={handleLoadRemote}
                                                    disabled={isLoadingRemote}
                                                    variant="ghost"
                                                    size="sm"
                                                    style={{
                                                        alignSelf: isUser ? "flex-end" : "flex-start",
                                                        marginTop: 4,
                                                        borderWidth: 0,
                                                        paddingHorizontal: 0,
                                                        paddingVertical: 0,
                                                        opacity: isLoadingRemote ? 0.7 : 1,
                                                    }}
                                                    textStyle={{
                                                        fontSize: 11,
                                                        fontWeight: "500",
                                                        color: "#93c5fd",
                                                        textDecorationLine: "underline",
                                                    }}
                                                />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                ))}
            </ScrollView>

            {(showScrollToTop || showScrollToLatest) && (
                <View
                    style={{
                        position: "absolute",
                        bottom: 20,
                        right: 20,
                        alignItems: "flex-end",
                    }}
                >
                    {showScrollToTop && (
                        <AppButton
                            title="↑ Top"
                            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
                            variant="primary"
                            size="sm"
                            style={{
                                borderRadius: 999,
                                marginBottom: 10,
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                shadowColor: "#000",
                                shadowOpacity: 0.25,
                                shadowOffset: { width: 0, height: 2 },
                                shadowRadius: 4,
                                elevation: 4,
                            }}
                        />
                    )}

                    {showScrollToLatest && (
                        <AppButton
                            title="↓ Latest"
                            onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
                            variant="primary"
                            size="sm"
                            style={{
                                borderRadius: 999,
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                shadowColor: "#000",
                                shadowOpacity: 0.25,
                                shadowOffset: { width: 0, height: 2 },
                                shadowRadius: 4,
                                elevation: 4,
                            }}
                        />
                    )}
                </View>
            )}
        </View>
    );
}
