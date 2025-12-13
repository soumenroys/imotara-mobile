// src/screens/SettingsScreen.tsx
import React from "react";
import {
    View,
    Text,
    Alert,
    Switch,
    ScrollView,
    TouchableOpacity,
} from "react-native";
import { useHistoryStore } from "../state/HistoryContext";
import type { HistoryItem as HistoryRecord } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";
import colors from "../theme/colors";
import { fetchRemoteHistory } from "../api/historyClient";
import AppSeparator from "../components/ui/AppSeparator";
import AppSurface from "../components/ui/AppSurface";
import AppButton from "../components/ui/AppButton";
import { DEBUG_UI_ENABLED } from "../config/debug";

export default function SettingsScreen() {
    // Keep compatibility with your current store shape, but allow optional newer fields
    const store = useHistoryStore() as any;

    const {
        history,
        clearHistory,
        pushHistoryToRemote,
        mergeRemoteHistory,
        // Optional newer helpers (if present)
        runSync,
        syncNow,
        isSyncing: storeIsSyncing,
    } = store;

    const {
        emotionInsightsEnabled,
        setEmotionInsightsEnabled,
        lastSyncAt,
        lastSyncStatus,
        setLastSyncAt,
        setLastSyncStatus,
        autoSyncDelaySeconds,
        setAutoSyncDelaySeconds,
    } = useSettings();

    const messageCount = (history as HistoryRecord[]).length;

    // ✅ Fix implicit-any error by typing callback param
    const unsyncedCount = (history as HistoryRecord[]).filter(
        (h: HistoryRecord) => !h.isSynced
    ).length;

    // ✅ QA hardening: avoid setState after leaving screen
    const mountedRef = React.useRef(true);
    React.useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // ✅ QA hardening: prevent double-taps on async tools
    const busyRef = React.useRef<{
        testRemote: boolean;
        pushOnly: boolean;
        syncNow: boolean;
    }>({ testRemote: false, pushOnly: false, syncNow: false });

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
        if (busyRef.current.testRemote) return;
        busyRef.current.testRemote = true;

        try {
            const remote = await fetchRemoteHistory();

            if (!Array.isArray(remote)) {
                Alert.alert(
                    "Remote history",
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

            Alert.alert("Remote history", lines.join("\n"), [{ text: "OK" }]);
        } catch (error) {
            console.error("Failed to fetch remote history:", error);
            Alert.alert(
                "Remote history error",
                "Could not connect to the Imotara backend right now. Please check your network or try again later.",
                [{ text: "OK" }]
            );
        } finally {
            busyRef.current.testRemote = false;
        }
    };

    const handlePushLocalHistory = async () => {
        if (busyRef.current.pushOnly) return;
        busyRef.current.pushOnly = true;

        try {
            const result = await pushHistoryToRemote();

            if (!result.ok) {
                Alert.alert(
                    "Cloud sync",
                    `Could not push history to the backend. Please check your connection or try again later.\n\n${result.errorMessage || "Network request failed"
                    }`,
                    [{ text: "OK" }]
                );
                return;
            }

            // ✅ Mark this as a successful sync event for the whole app
            const summary = `Push-only sync: pushed ${result.pushed} item(s) to the backend (status ${result.status ?? "unknown"
                }).`;
            if (mountedRef.current) {
                setLastSyncAt(Date.now());
                setLastSyncStatus(summary);
            }

            Alert.alert(
                "Cloud sync",
                `Pushed ${result.pushed} item(s) to the backend.\n\nStatus: ${result.status ?? "unknown"
                }`,
                [{ text: "OK" }]
            );
        } catch (error) {
            console.error("Failed to push remote history:", error);
            Alert.alert(
                "Cloud sync",
                "Could not push history to the backend. Please check your connection or try again later.\n\nNetwork request failed",
                [{ text: "OK" }]
            );
        } finally {
            busyRef.current.pushOnly = false;
        }
    };

    // One-tap sync: push local → fetch remote → merge into local
    const handleSyncNow = async () => {
        if (busyRef.current.syncNow) return;
        busyRef.current.syncNow = true;

        try {
            // Prefer deduped trigger if present; otherwise fall back to pushHistoryToRemote
            const syncFn =
                typeof syncNow === "function"
                    ? syncNow
                    : typeof runSync === "function"
                        ? runSync
                        : pushHistoryToRemote;

            // 1) Push local history
            const pushResult = await syncFn({ reason: "SettingsScreen: Sync Now" });

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

                if (mountedRef.current) {
                    setLastSyncAt(Date.now());
                    setLastSyncStatus(summary);
                }

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
            if (mountedRef.current) {
                setLastSyncAt(Date.now());
                setLastSyncStatus(summary);
            }

            Alert.alert("Sync summary", `${pushedText}\n\n${mergedText}`, [
                { text: "OK" },
            ]);
        } catch (error) {
            console.error("handleSyncNow error:", error);
            if (mountedRef.current) {
                setLastSyncAt(Date.now());
                setLastSyncStatus(
                    "Sync error: Full sync (push + fetch) failed. Please check your connection."
                );
            }
            Alert.alert(
                "Sync error",
                "Full sync (push + fetch) failed. Please check your connection and try again.",
                [{ text: "OK" }]
            );
        } finally {
            busyRef.current.syncNow = false;
        }
    };

    const formattedLastSync = lastSyncAt
        ? new Date(lastSyncAt).toLocaleString()
        : "Not synced yet";

    // Utility: set auto-sync delay via preset, clamped to 3–60 seconds
    const setDelayPreset = (seconds: number) => {
        const safe = Math.min(Math.max(seconds, 3), 60);
        setAutoSyncDelaySeconds(safe);
    };

    // If store exposes sync state, reflect it in button disabled state too
    const isAnySyncBusy =
        busyRef.current.pushOnly ||
        busyRef.current.syncNow ||
        (typeof storeIsSyncing === "boolean" ? storeIsSyncing : false);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
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
                    {"\n\n"}Your messages are never shared publicly — sync only stores a
                    private cloud copy for you.
                </Text>

                {/* Emotion Insights (preview) card */}
                <AppSurface style={{ marginBottom: 16 }}>
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
                </AppSurface>

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

                    <AppButton
                        title="Clear Local History"
                        onPress={handleClearHistory}
                        variant="destructive"
                        style={{ alignSelf: "flex-start", borderRadius: 999 }}
                    />
                </AppSurface>

                {/* Small visual separator */}
                <AppSeparator style={{ marginVertical: 12 }} />

                {/* Background auto-sync card */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginBottom: 6,
                            fontWeight: "500",
                        }}
                    >
                        Background auto-sync (mobile)
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.textSecondary,
                            marginBottom: 8,
                        }}
                    >
                        When new messages are only on this device, Imotara can gently
                        sync them to the cloud after a short delay. This keeps your
                        history backed up without you needing to tap anything.
                    </Text>

                    <Text
                        style={{
                            fontSize: 12,
                            color: colors.textSecondary,
                            marginBottom: 6,
                        }}
                    >
                        Current delay:{" "}
                        <Text
                            style={{
                                fontWeight: "600",
                                color: colors.textPrimary,
                            }}
                        >
                            {autoSyncDelaySeconds}s
                        </Text>{" "}
                        after the app notices unsynced messages.
                    </Text>

                    <View style={{ flexDirection: "row", marginTop: 4 }}>
                        {[5, 8, 15].map((sec, index) => {
                            const isActive = autoSyncDelaySeconds === sec;
                            return (
                                <TouchableOpacity
                                    key={sec}
                                    onPress={() => setDelayPreset(sec)}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 6,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: isActive
                                            ? colors.primary
                                            : colors.border,
                                        backgroundColor: isActive
                                            ? "rgba(56, 189, 248, 0.18)"
                                            : "rgba(15, 23, 42, 0.9)",
                                        marginRight: index < 2 ? 8 : 0,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: "600",
                                            color: isActive
                                                ? colors.textPrimary
                                                : colors.textSecondary,
                                        }}
                                    >
                                        {sec}s
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.textSecondary,
                            marginTop: 6,
                        }}
                    >
                        You can adjust this later — shorter delays sync more quickly,
                        longer delays are gentler on battery and data.
                    </Text>
                </AppSurface>

                {/* Remote card */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginBottom: 6,
                            fontWeight: "500",
                        }}
                    >
                        Remote history
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.textSecondary,
                            marginBottom: 10,
                        }}
                    >
                        Sync your local history to the Imotara backend and merge any
                        remote items back into this device.
                    </Text>

                    {/* Quick snapshot */}
                    <Text
                        style={{
                            fontSize: 12,
                            color: colors.textSecondary,
                            marginBottom: 12,
                        }}
                    >
                        Local messages: {messageCount}
                        {unsyncedCount > 0
                            ? ` · Unsynced: ${unsyncedCount}`
                            : " · All synced"}
                    </Text>

                    {/* Debug-only tools */}
                    {DEBUG_UI_ENABLED && (
                        <>
                            <AppButton
                                title={
                                    busyRef.current.testRemote
                                        ? "Testing remote…"
                                        : "Test Remote History Fetch"
                                }
                                onPress={handleTestRemoteHistory}
                                disabled={busyRef.current.testRemote}
                                variant="secondary"
                                style={{
                                    alignSelf: "flex-start",
                                    borderRadius: 999,
                                    marginBottom: 8,
                                    opacity: busyRef.current.testRemote ? 0.7 : 1,
                                }}
                            />

                            <AppButton
                                title={
                                    busyRef.current.pushOnly
                                        ? "Pushing…"
                                        : "Push Local History to Cloud"
                                }
                                onPress={handlePushLocalHistory}
                                disabled={busyRef.current.pushOnly || isAnySyncBusy}
                                variant="secondary"
                                style={{
                                    alignSelf: "flex-start",
                                    borderRadius: 999,
                                    marginBottom: 8,
                                    opacity:
                                        busyRef.current.pushOnly || isAnySyncBusy
                                            ? 0.7
                                            : 1,
                                }}
                            />
                        </>
                    )}

                    {/* Production-safe one-tap sync stays visible */}
                    <AppButton
                        title={
                            busyRef.current.syncNow || isAnySyncBusy
                                ? "Syncing…"
                                : "Sync Now (push + fetch)"
                        }
                        onPress={handleSyncNow}
                        disabled={busyRef.current.syncNow || isAnySyncBusy}
                        variant="primary"
                        style={{
                            alignSelf: "flex-start",
                            borderRadius: 999,
                            marginBottom: 10,
                            opacity:
                                busyRef.current.syncNow || isAnySyncBusy ? 0.7 : 1,
                        }}
                    />

                    {/* Lite sync status */}
                    <View style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
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
                </AppSurface>

                {/* App version footer */}
                <View
                    style={{
                        marginTop: 32,
                        alignItems: "center",
                        paddingBottom: 20,
                        opacity: 0.5,
                    }}
                >
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        Imotara Mobile Preview · v0.9.0
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
