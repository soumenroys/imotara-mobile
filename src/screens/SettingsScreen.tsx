// src/screens/SettingsScreen.tsx
import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    Switch,
    ScrollView,
} from "react-native";
import { useHistoryStore } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";
import colors from "../theme/colors";
import { fetchRemoteHistory } from "../api/historyClient";
import AppSeparator from "../components/ui/AppSeparator";
import AppSurface from "../components/ui/AppSurface";

<AppSeparator style={{ marginVertical: 12 }} />

export default function SettingsScreen() {
    const {
        history,
        clearHistory,
        pushHistoryToRemote,
        mergeRemoteHistory,
    } = useHistoryStore();

    const {
        emotionInsightsEnabled,
        setEmotionInsightsEnabled,
        lastSyncAt,
        lastSyncStatus,
        setLastSyncAt,
        setLastSyncStatus,
    } = useSettings();

    const messageCount = history.length;
    const unsyncedCount = history.filter((h) => !h.isSynced).length;

    const handleClearHistory = () => {
        Alert.alert(
            "Clear chat history?",
            "This will remove all local messages stored in this app on this device.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: () => {
                        clearHistory();
                    },
                },
            ]
        );
    };

    const handleTestRemoteHistory = async () => {
        try {
            const remote = await fetchRemoteHistory();

            if (!Array.isArray(remote)) {
                Alert.alert(
                    "Remote history debug",
                    "Unexpected response format from backend.",
                    [{ text: "OK" }]
                );
                return;
            }

            const mergeResult = mergeRemoteHistory(remote);
            const { totalRemote, normalized, added } = mergeResult;

            const lines: string[] = [];
            lines.push(`Fetched ${totalRemote} raw item(s) from backend.`);
            lines.push(`Recognized ${normalized} item(s) as valid history.`);
            if (added === 0) {
                lines.push(
                    "No new items were added — local history already contained all recognized entries."
                );
            } else {
                lines.push(`Merged ${added} new item(s) into local history.`);
            }

            Alert.alert("Remote history debug", lines.join("\n"), [
                { text: "OK" },
            ]);
        } catch (error) {
            console.error("Failed to fetch remote history:", error);
            Alert.alert(
                "Remote history error",
                "Could not connect to the Imotara backend right now. Please check your network or try again later.",
                [{ text: "OK" }]
            );
        }
    };

    const handlePushLocalHistory = async () => {
        try {
            const result = await pushHistoryToRemote();

            if (!result.ok) {
                Alert.alert(
                    "Cloud sync debug",
                    `Could not push history to the backend. Please check your connection or try again later.\n\n${result.errorMessage || "Network request failed"
                    }`,
                    [{ text: "OK" }]
                );
                return;
            }

            // ✅ Mark this as a successful sync event for the whole app
            const summary = `Push-only sync: pushed ${result.pushed} item(s) to the backend (status ${result.status ?? "unknown"
                }).`;
            setLastSyncAt(Date.now());
            setLastSyncStatus(summary);

            Alert.alert(
                "Cloud sync debug",
                `Pushed ${result.pushed} item(s) to the backend.\n\nStatus: ${result.status ?? "unknown"
                }`,
                [{ text: "OK" }]
            );
        } catch (error) {
            console.error("Failed to push remote history:", error);
            Alert.alert(
                "Cloud sync debug",
                "Could not push history to the backend. Please check your connection or try again later.\n\nNetwork request failed",
                [{ text: "OK" }]
            );
        }
    };

    // One-tap sync: push local → fetch remote → merge into local
    const handleSyncNow = async () => {
        try {
            // 1) Push local history (via unified context method)
            const pushResult = await pushHistoryToRemote();

            // 2) Fetch latest remote history
            const remote = await fetchRemoteHistory();

            if (!Array.isArray(remote)) {
                const pushedText = pushResult.ok
                    ? `Pushed ${pushResult.pushed} item(s) to the backend.`
                    : `Push failed: ${pushResult.errorMessage || "Network / backend error"
                    }`;

                const mergedText =
                    "Remote response was not in the expected list format.";

                const summary = `${pushedText} ${mergedText}`;

                setLastSyncAt(Date.now());
                setLastSyncStatus(summary);

                Alert.alert("Sync issue", `${pushedText}\n\n${mergedText}`, [
                    { text: "OK" },
                ]);
                return;
            }

            // 3) Merge into local (no duplicates, normalized)
            const mergeResult = mergeRemoteHistory(remote);
            const { totalRemote, normalized, added } = mergeResult;

            const pushedText = pushResult.ok
                ? `Pushed ${pushResult.pushed} item(s) to the backend.`
                : `Push failed: ${pushResult.errorMessage || "Network / backend error"
                }`;

            let mergedText: string;
            if (totalRemote === 0) {
                mergedText = "No remote items found.";
            } else if (normalized === 0) {
                mergedText = `Fetched ${totalRemote} item(s), but none looked like valid history rows.`;
            } else if (added === 0) {
                mergedText = `Fetched ${totalRemote} item(s), recognized ${normalized}, but local history already had all of them.`;
            } else {
                mergedText = `Fetched ${totalRemote} item(s), recognized ${normalized}, and merged ${added} new item(s) into local history.`;
            }

            const summary = `${pushedText} ${mergedText}`;

            // 4) Update last sync info (Lite)
            setLastSyncAt(Date.now());
            setLastSyncStatus(summary);

            Alert.alert("Sync summary", `${pushedText}\n\n${mergedText}`, [
                { text: "OK" },
            ]);
        } catch (error) {
            console.error("handleSyncNow error:", error);
            setLastSyncAt(Date.now());
            setLastSyncStatus(
                "Sync error: Full sync (push + fetch) failed. Please check your connection."
            );
            Alert.alert(
                "Sync error",
                "Full sync (push + fetch) failed. Please check your connection and try again.",
                [{ text: "OK" }]
            );
        }
    };

    const formattedLastSync = lastSyncAt
        ? new Date(lastSyncAt).toLocaleString()
        : "Not synced yet";

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: colors.background,
            }}
        >
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    paddingBottom: 40, // keep bottom buttons above tab bar
                }}
            >
                <Text
                    style={{
                        fontSize: 22,
                        fontWeight: "700",
                        marginBottom: 12,
                        color: colors.textPrimary,
                    }}
                >
                    Settings & Privacy
                </Text>

                <Text
                    style={{
                        fontSize: 14,
                        color: colors.textSecondary,
                        marginBottom: 24,
                    }}
                >
                    Imotara Mobile (preview). By default your messages stay on this
                    device. From here you can try early emotion insights and sync
                    options — future versions will add full cloud backup controls and
                    teen safety settings.
                </Text>

                {/* Emotion Insights (preview) card */}
                <View
                    style={{
                        backgroundColor: colors.surfaceSoft,
                        borderRadius: 16,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 6,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                color: colors.textPrimary,
                                fontWeight: "500",
                            }}
                        >
                            Emotion Insights (Preview)
                        </Text>
                        <Switch
                            value={emotionInsightsEnabled}
                            onValueChange={setEmotionInsightsEnabled}
                            trackColor={{
                                false: "#4b5563",
                                true: colors.primary,
                            }}
                            thumbColor={"#f9fafb"}
                        />
                    </View>
                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.textSecondary,
                            marginBottom: 4,
                        }}
                    >
                        When enabled, Imotara will try to give you deeper emotional
                        reflections, suggestions, and gentle prompts in the chat. In
                        this early preview, analysis still runs locally on your device.
                    </Text>
                    <Text
                        style={{
                            fontSize: 12,
                            color: colors.textSecondary,
                            marginTop: 4,
                        }}
                    >
                        This toggle does not send any extra data to the cloud yet. It
                        is a design placeholder for future AI-powered insights.
                    </Text>
                </View>

                {/* Local history card */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginBottom: 6,
                            fontWeight: "500",
                        }}
                    >
                        Local history
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.textSecondary,
                            marginBottom: 8,
                        }}
                    >
                        Clear all chat messages stored on this device. This does not
                        affect any future cloud backups or sync features.
                    </Text>

                    {/* Small local stats */}
                    <Text
                        style={{
                            fontSize: 12,
                            color: colors.textSecondary,
                            marginBottom: 10,
                        }}
                    >
                        Messages on this device: {messageCount}
                        {unsyncedCount > 0 ? ` · Unsynced: ${unsyncedCount}` : ""}
                    </Text>

                    <TouchableOpacity
                        onPress={handleClearHistory}
                        style={{
                            alignSelf: "flex-start",
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: "#fca5a5",
                            backgroundColor: "rgba(248, 113, 113, 0.12)",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: "#fecaca",
                            }}
                        >
                            Clear Local History
                        </Text>
                    </TouchableOpacity>
                </AppSurface>

                {/* Remote debug + sync card */}
                <View
                    style={{
                        backgroundColor: colors.surfaceSoft,
                        borderRadius: 16,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginBottom: 6,
                            fontWeight: "500",
                        }}
                    >
                        Remote history (debug)
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.textSecondary,
                            marginBottom: 12,
                        }}
                    >
                        Test connection to the Imotara backend, push your local history,
                        and optionally merge remote items back into this device. This is
                        a developer preview for the future sync engine.
                    </Text>

                    {/* Test fetch */}
                    <TouchableOpacity
                        onPress={handleTestRemoteHistory}
                        style={{
                            alignSelf: "flex-start",
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.primary,
                            backgroundColor: "rgba(56, 189, 248, 0.16)",
                            marginBottom: 8,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: colors.textPrimary,
                            }}
                        >
                            Test Remote History Fetch
                        </Text>
                    </TouchableOpacity>

                    {/* Push only */}
                    <TouchableOpacity
                        onPress={handlePushLocalHistory}
                        style={{
                            alignSelf: "flex-start",
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.primary,
                            backgroundColor: "rgba(56, 189, 248, 0.12)",
                            marginBottom: 8,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: colors.textPrimary,
                            }}
                        >
                            Push Local History to Cloud
                        </Text>
                    </TouchableOpacity>

                    {/* Full sync: push + fetch + merge */}
                    <TouchableOpacity
                        onPress={handleSyncNow}
                        style={{
                            alignSelf: "flex-start",
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: "#a5b4fc",
                            backgroundColor: "rgba(129, 140, 248, 0.16)",
                            marginBottom: 10,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: colors.textPrimary,
                            }}
                        >
                            Sync Now (push + fetch)
                        </Text>
                    </TouchableOpacity>

                    {/* Lite sync status */}
                    <View
                        style={{
                            marginTop: 4,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 12,
                                color: colors.textSecondary,
                            }}
                        >
                            Last sync: {formattedLastSync}
                        </Text>
                        {lastSyncStatus && (
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: colors.textSecondary,
                                    marginTop: 2,
                                }}
                            >
                                {lastSyncStatus}
                            </Text>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
