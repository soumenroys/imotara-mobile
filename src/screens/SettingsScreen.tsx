// src/screens/SettingsScreen.tsx
import React from "react";
import Constants from "expo-constants";
import IOSTipJar from "../components/imotara/IOSTipJar";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";


import {
    View,
    Text,
    Alert,
    Switch,
    ScrollView,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Linking,
} from "react-native";

import { useHistoryStore } from "../state/HistoryContext";
import type { HistoryItem as HistoryRecord } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import {
    scheduleCheckInReminder,
    cancelCheckInReminder,
    isCheckInReminderEnabled,
    getSavedReminderTime,
    DEFAULT_HOUR,
    DEFAULT_MINUTE,
} from "../notifications/checkInReminder";
import {
    loadMemories,
    clearMemories,
    removeMemory,
    updateMemory,
    addMemory,
    type MemoryItem,
} from "../state/companionMemory";
import { fetchRemoteHistory } from "../api/historyClient";
import AppSeparator from "../components/ui/AppSeparator";
import AppSurface from "../components/ui/AppSurface";
import AppButton from "../components/ui/AppButton";
import { DEBUG_UI_ENABLED } from "../config/debug";
import { speakMessage, stopSpeaking } from "../lib/tts/mobileTTS";


// ✅ Licensing types (foundation only)
import type { LicenseTier } from "../licensing/featureGates";
import { gate } from "../licensing/featureGates";

// ✅ Donation presets + formatting (re-used)
import { DONATION_PRESETS, formatINRFromPaise } from "../payments/donations";

/**
 * ✅ TS FIX:
 * In some TS setups, DONATION_PRESETS may be inferred too narrowly and p becomes `never`.
 * We cast to a UI-safe structural type to keep typing stable without changing runtime behavior.
 */
type DonationUIItem = { id: string; label: string; amount: number };
const DONATION_UI_PRESETS = DONATION_PRESETS as readonly DonationUIItem[];

function prettyTier(tier: LicenseTier | string | undefined | null): string {
    const t = String(tier ?? "FREE").toUpperCase();
    switch (t) {
        case "FREE":
            return "Free";
        case "PREMIUM":
            return "Premium";
        case "FAMILY":
            return "Family";
        case "EDU":
            return "Education";
        case "ENTERPRISE":
            return "Enterprise";
        default:
            return "Free";
    }
}

function getApiBaseUrl(): string {
    // Try a few common Expo env names (safe fallbacks).
    const v =
        process.env.EXPO_PUBLIC_IMOTARA_API_BASE_URL ||
        process.env.EXPO_PUBLIC_API_BASE_URL ||
        process.env.EXPO_PUBLIC_BACKEND_URL ||
        "";

    // Normalize trailing slash
    return v.endsWith("/") ? v.slice(0, -1) : v;
}

export default function SettingsScreen() {
    const { accessToken, signOut } = useAuth();

    // Keep compatibility with your current store shape, but allow optional newer fields
    const store = useHistoryStore() as any;

    const {
        history,
        clearHistory,
        deleteFromHistory,
        pushHistoryToRemote,
        mergeRemoteHistory,
        // Optional newer helpers (if present)
        runSync,
        syncNow,
        isSyncing: storeIsSyncing,

        // ✅ Optional licensing fields (if present in HistoryContext)
        licenseTier,
        setLicenseTier,
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

        // ✅ New
        analysisMode,
        setAnalysisMode,
        toneContext,
        setToneContext,

        // ✅ Cross-device chat link key (optional)
        chatLinkKey,
        setChatLinkKey,
    } = useSettings();

    const { themeMode, toggleTheme, isDark, colors } = useTheme();

    const messageCount = (history as HistoryRecord[]).length;

    // ✅ Fix implicit-any error by typing callback param
    const unsyncedCount = (history as HistoryRecord[]).filter(
        (h: HistoryRecord) => !h.isSynced
    ).length;

    // ✅ Cloud sync gate (soft gating)
    const cloudGate = gate("CLOUD_SYNC", licenseTier);

    // ✅ Keep real gating for production, but allow DEBUG builds to test sync reliability
    const canCloudSync = cloudGate.enabled || DEBUG_UI_ENABLED;

    // ✅ TS-safe reason: only exists when enabled === false
    const cloudGateReason = !cloudGate.enabled ? cloudGate.reason : undefined;

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
        donate: boolean;
    }>({ testRemote: false, pushOnly: false, syncNow: false, donate: false });

    // ─── Profile sync (Supabase cross-device) ────────────────────────────────
    // Capture initial toneContext to decide whether to pull from server on mount
    const initialToneRef = React.useRef(toneContext);

    // Pull: on mount, if local profile is empty/default, fetch from server
    React.useEffect(() => {
        if (!accessToken) return;
        const base = getApiBaseUrl();
        if (!base) return;
        const hasLocal = initialToneRef.current?.user?.name || initialToneRef.current?.companion?.name;
        if (hasLocal) return; // local profile exists — don't overwrite
        fetch(`${base}/api/profile/sync`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!mountedRef.current) return;
                const tc = data?.toneContext;
                const hasServer = tc?.user?.name || tc?.companion?.name || tc?.user?.preferredLang;
                if (hasServer) setToneContext(tc);
            })
            .catch(() => {}); // silent — sync is best-effort
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    // Push: when toneContext changes and user is logged in, sync to server (debounced 2s)
    React.useEffect(() => {
        if (!accessToken) return;
        const base = getApiBaseUrl();
        if (!base) return;
        const timer = setTimeout(() => {
            if (!mountedRef.current) return;
            fetch(`${base}/api/profile/sync`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(toneContext ?? {}),
            }).catch(() => {}); // silent — sync is best-effort
        }, 2000);
        return () => clearTimeout(timer);
    }, [toneContext, accessToken]);
    // ─────────────────────────────────────────────────────────────────────────

    // ✅ Daily check-in reminder
    const [reminderEnabled, setReminderEnabled] = React.useState(false);
    const [reminderLoading, setReminderLoading] = React.useState(false);
    const [reminderHour, setReminderHour] = React.useState(DEFAULT_HOUR);
    const [reminderMinute, setReminderMinute] = React.useState(DEFAULT_MINUTE);
    React.useEffect(() => {
        isCheckInReminderEnabled().then(setReminderEnabled).catch(() => {});
        getSavedReminderTime().then(({ hour, minute }) => {
            setReminderHour(hour);
            setReminderMinute(minute);
        }).catch(() => {});
    }, []);

    const handleReminderToggle = async (value: boolean) => {
        if (reminderLoading) return;
        setReminderLoading(true);
        try {
            if (value) {
                const ok = await scheduleCheckInReminder(reminderHour, reminderMinute);
                if (!mountedRef.current) return;
                if (ok) {
                    setReminderEnabled(true);
                } else {
                    Alert.alert(
                        "Permission needed",
                        "Please allow notifications in your device settings to enable daily reminders.",
                        [{ text: "OK" }]
                    );
                }
            } else {
                await cancelCheckInReminder();
                if (mountedRef.current) setReminderEnabled(false);
            }
        } catch {
            // non-fatal
        } finally {
            if (mountedRef.current) setReminderLoading(false);
        }
    };

    const handleReminderTimeChange = async (hour: number, minute: number) => {
        setReminderHour(hour);
        setReminderMinute(minute);
        if (reminderEnabled) {
            await scheduleCheckInReminder(hour, minute).catch(() => {});
        }
    };

    // Emotional fingerprint — computed from history, memoized
    const emotionalFingerprint = React.useMemo(() => {
        const now = Date.now();
        const dayMs = 86_400_000;
        const relevant = (history as HistoryRecord[]).filter((h) => h.from === "user" && h.emotion && h.emotion !== "neutral");
        if (relevant.length < 3) return null;
        const last30 = relevant.filter((h) => (h.timestamp ?? 0) >= now - 30 * dayMs);
        const freq: Record<string, number> = {};
        for (const h of last30) freq[h.emotion!] = (freq[h.emotion!] ?? 0) + 1;
        const total = Object.values(freq).reduce((s, n) => s + n, 0);
        const topEmotions = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([e, c]) => ({ emotion: e, pct: total > 0 ? Math.round((c / total) * 100) : 0 }));
        const last3 = relevant.filter((h) => (h.timestamp ?? 0) >= now - 3 * dayMs);
        const prev4 = relevant.filter((h) => { const ts = h.timestamp ?? 0; return ts >= now - 7 * dayMs && ts < now - 3 * dayMs; });
        let trend: "lighter" | "heavier" | "steady" | null = null;
        if (last3.length >= 2 && prev4.length >= 2) {
            const avg = (arr: HistoryRecord[]) => arr.reduce((s, h) => s + ((h as any).intensity ?? 0.5), 0) / arr.length;
            const diff = avg(last3) - avg(prev4);
            trend = diff < -0.08 ? "lighter" : diff > 0.08 ? "heavier" : "steady";
        }
        return { topEmotions, trend, totalRecords: relevant.length };
    }, [history]);

    // Companion memory
    const [memories, setMemories] = React.useState<MemoryItem[]>([]);
    const [deletingMemoryId, setDeletingMemoryId] = React.useState<string | null>(null);
    const [editingMemoryId, setEditingMemoryId] = React.useState<string | null>(null);
    const [editingMemoryText, setEditingMemoryText] = React.useState("");
    const [addingMemory, setAddingMemory] = React.useState(false);
    const [newMemoryText, setNewMemoryText] = React.useState("");
    React.useEffect(() => {
        loadMemories().then(setMemories).catch(() => {});
    }, []);

    // Feedback / bug report
    const [feedbackType, setFeedbackType] = React.useState<"feedback" | "bug">("feedback");
    const [feedbackText, setFeedbackText] = React.useState("");
    const [feedbackStatus, setFeedbackStatus] = React.useState<string | null>(null);

    // Account deletion
    const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
    const handleRemoveMemory = (id: string) => {
        setDeletingMemoryId(id);
        removeMemory(id)
            .then(() => setMemories((prev) => prev.filter((m) => m.id !== id)))
            .catch(() => {})
            .finally(() => setDeletingMemoryId(null));
    };
    const handleStartEditMemory = (m: MemoryItem) => {
        setEditingMemoryId(m.id);
        setEditingMemoryText(m.text);
    };
    const handleSaveEditMemory = (id: string) => {
        const trimmed = editingMemoryText.trim();
        if (!trimmed) { setEditingMemoryId(null); return; }
        updateMemory(id, trimmed)
            .then(() => setMemories((prev) => prev.map((m) => m.id === id ? { ...m, text: trimmed } : m)))
            .catch(() => {});
        setEditingMemoryId(null);
        setEditingMemoryText("");
    };
    const handleClearMemories = () => {
        Alert.alert(
            "Clear companion memory?",
            "Imotara will forget what it has learned about you. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: () => {
                        clearMemories().then(() => setMemories([])).catch(() => {});
                    },
                },
            ]
        );
    };

    const handleAddMemory = () => {
        const trimmed = newMemoryText.trim();
        if (!trimmed) { setAddingMemory(false); return; }
        addMemory({ text: trimmed, source: "manual" })
            .then(() => loadMemories())
            .then(setMemories)
            .catch(() => {});
        setNewMemoryText("");
        setAddingMemory(false);
    };

    // ✅ Link key status (UI only)
    const [chatLinkStatus, setChatLinkStatus] = React.useState<string | null>(null);
    const [voicePreviewId, setVoicePreviewId] = React.useState<string | null>(null);

    const linkStatusTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const showLinkStatus = (msg: string) => {
        if (linkStatusTimerRef.current) clearTimeout(linkStatusTimerRef.current);
        setChatLinkStatus(msg);
        linkStatusTimerRef.current = setTimeout(() => setChatLinkStatus(null), 3000);
    };

    // Stop TTS and clear timers on unmount
    React.useEffect(() => {
        return () => {
            stopSpeaking();
            if (linkStatusTimerRef.current) clearTimeout(linkStatusTimerRef.current);
        };
    }, []);

    const saveChatLinkKey = () => {
        const v = (chatLinkKey ?? "").trim();
        setChatLinkKey(v);
        showLinkStatus(v ? "Link Key saved on this device." : "Link Key cleared.");
    };

    const clearChatLinkKey = () => {
        setChatLinkKey("");
        showLinkStatus("Link Key cleared.");
    };

    const handleExportData = async () => {
        try {
            const exportPayload = {
                exportedAt: new Date().toISOString(),
                appVersion: Constants.expoConfig?.version ?? "unknown",
                messages: history.map((item: HistoryRecord) => ({
                    id: item.id,
                    text: item.text,
                    from: item.from,
                    emotion: item.emotion,
                    intensity: item.intensity,
                    timestamp: item.timestamp,
                    isSynced: item.isSynced,
                })),
            };
            const json = JSON.stringify(exportPayload, null, 2);
            const fileName = `imotara-export-${new Date().toISOString().slice(0, 10)}.json`;
            const fileUri = FileSystem.cacheDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(fileUri, { mimeType: "application/json", dialogTitle: "Export Imotara data" });
            } else {
                Alert.alert("Export unavailable", "Sharing is not available on this device.");
            }
        } catch (e) {
            Alert.alert("Export failed", "Could not export your data. Please try again.");
        }
    };

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
        // ✅ Soft gate
        if (!canCloudSync) {
            Alert.alert(
                "Premium feature",
                cloudGateReason || "Cloud sync is available with Premium.",
                [{ text: "OK" }]
            );
            return;
        }

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
        // ✅ Soft gate
        if (!canCloudSync) {
            Alert.alert(
                "Premium feature",
                cloudGateReason || "Cloud sync is available with Premium.",
                [{ text: "OK" }]
            );
            return;
        }

        // ✅ Never silently no-op
        if (busyRef.current.syncNow) {
            if (mountedRef.current) {
                setLastSyncStatus("Sync already running…");
            }
            Alert.alert("Sync", "Sync is already running. Please wait a moment.", [
                { text: "OK" },
            ]);
            return;
        }

        busyRef.current.syncNow = true;

        // ✅ Immediate visible feedback
        if (mountedRef.current) {
            setLastSyncStatus("Syncing…");
        }

        try {
            // Prefer deduped trigger if present; otherwise fall back to pushHistoryToRemote
            const syncFn =
                typeof syncNow === "function"
                    ? syncNow
                    : typeof runSync === "function"
                        ? runSync
                        : pushHistoryToRemote;

            // 1) Push local history
            // Some implementations accept opts; some don't. Call safely.
            const pushResult =
                syncFn === pushHistoryToRemote && (syncFn as any).length === 0
                    ? await (syncFn as any)()
                    : await (syncFn as any)({ reason: "SettingsScreen: Sync Now" });

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

    const handleDonate = async (preset: { label: string; amount: number }) => {
        if (busyRef.current.donate) return;
        busyRef.current.donate = true;

        try {
            const base = getApiBaseUrl();
            const donateUrl = `${base}/donate`;
            await Linking.openURL(donateUrl);
        } catch {
            Alert.alert("Error", "Could not open donation page. Please try again.", [{ text: "OK" }]);
        } finally {
            busyRef.current.donate = false;
        }
    };

    const handleFeedbackSubmit = async () => {
        const trimmed = feedbackText.trim();
        if (!trimmed) {
            setFeedbackStatus("Please describe your feedback or issue before submitting.");
            return;
        }
        const subject = encodeURIComponent(
            feedbackType === "bug" ? "[Imotara] Bug Report" : "[Imotara] Feedback"
        );
        const body = encodeURIComponent(trimmed);
        const url = `mailto:info@imotara.com?subject=${subject}&body=${body}`;
        try {
            await Linking.openURL(url);
            setFeedbackText("");
            setFeedbackStatus("Email app opened. Just tap Send to submit your feedback.");
        } catch {
            setFeedbackStatus("Could not open email app. Please email info@imotara.com directly.");
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account",
            "This will permanently delete all your data — conversations, memories, and settings. This cannot be undone.\n\nAre you sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete My Account",
                    style: "destructive",
                    onPress: async () => {
                        if (!mountedRef.current) return;
                        setIsDeletingAccount(true);
                        try {
                            // 1. Wipe local data
                            clearHistory();
                            await clearMemories();

                            // 2. Request server-side deletion if authenticated
                            if (accessToken) {
                                const base = getApiBaseUrl();
                                if (base) {
                                    await fetch(`${base}/api/account/delete`, {
                                        method: "DELETE",
                                        headers: { Authorization: `Bearer ${accessToken}` },
                                    }).catch(() => {}); // best-effort
                                }
                            }

                            // 3. Sign out (also clears AsyncStorage keys)
                            await signOut();

                            // 4. For local-mode users signOut doesn't navigate away — show confirmation
                            if (mountedRef.current) {
                                Alert.alert(
                                    "Data Deleted",
                                    "All your conversations, memories, and settings have been permanently deleted."
                                );
                            }
                        } catch {
                            if (mountedRef.current) {
                                Alert.alert(
                                    "Error",
                                    "Something went wrong. Please try again or contact support@imotara.com."
                                );
                            }
                        } finally {
                            if (mountedRef.current) {
                                setIsDeletingAccount(false);
                            }
                        }
                    },
                },
            ]
        );
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
        busyRef.current.donate ||
        (typeof storeIsSyncing === "boolean" ? storeIsSyncing : false);

    // ✅ Licensing display + optional debug switching
    const tierLabel = prettyTier(licenseTier);
    const canSetTier = typeof setLicenseTier === "function";

    const setTierSafe = (tier: LicenseTier) => {
        if (!canSetTier) return;

        // IMPORTANT: This is only a local flag for gating tests.
        // It does not enable billing or store subscriptions.
        setLicenseTier(tier);

        if (mountedRef.current) {
            setLastSyncStatus(
                `Plan changed locally for testing: ${prettyTier(tier)}`
            );
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.background }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        >
            <ScrollView
                keyboardShouldPersistTaps="handled"
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
                    Imotara Mobile. By default your messages stay on this
                    device. From here you can try early emotion insights and sync
                    options — future versions will add full cloud backup controls and
                    teen safety settings.
                    {"\n\n"}Your messages are never shared publicly — sync only stores a
                    private cloud copy for you.
                </Text>

                {/* Privacy Policy & Terms links — required by App Store guideline 5.1.1 */}
                <View style={{ flexDirection: "row", marginBottom: 24, gap: 20 }}>
                    <TouchableOpacity
                        onPress={() => WebBrowser.openBrowserAsync("https://imotara.com/privacy")}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={{ fontSize: 13, color: colors.primary, textDecorationLine: "underline" }}>
                            Privacy Policy
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => WebBrowser.openBrowserAsync("https://imotara.com/terms")}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={{ fontSize: 13, color: colors.primary, textDecorationLine: "underline" }}>
                            Terms of Use
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Support / Donation card
                    - iOS: Apple IAP "tip jar" via StoreKit 2 (guideline 3.1.1 compliant)
                    - Android: existing Razorpay preset buttons */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginBottom: 6,
                            fontWeight: "500",
                        }}
                    >
                        Support Imotara 🇮🇳
                    </Text>

                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.textSecondary,
                            marginBottom: 10,
                        }}
                    >
                        Imotara is a privacy-first companion built in India. If you'd like to leave a tip to support development, you can do so below. All features remain completely free.
                    </Text>

                    {Platform.OS === "ios" ? (
                        /* iOS: Apple IAP tip jar — StoreKit 2, processed by Apple */
                        <IOSTipJar />
                    ) : (
                        /* Android: show Razorpay preset price buttons */
                        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                            {DONATION_UI_PRESETS.map((p) => (
                                <TouchableOpacity
                                    key={p.id}
                                    onPress={() =>
                                        handleDonate({
                                            id: p.id,
                                            label: p.label || formatINRFromPaise(p.amount),
                                            amount: p.amount,
                                        } as any)
                                    }
                                    disabled={busyRef.current.donate}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: colors.primary,
                                        backgroundColor: "rgba(56, 189, 248, 0.12)",
                                        marginRight: 8,
                                        marginBottom: 8,
                                        opacity: busyRef.current.donate ? 0.6 : 1,
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>
                                        {p.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: colors.textSecondary,
                                    marginTop: 8,
                                    width: "100%",
                                }}
                            >
                                Your chat data is never publicly exposed. Donations help cover hosting and development.
                            </Text>
                        </View>
                    )}
                </AppSurface>

                {/* ✅ Plan / Licensing card (foundation) */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginBottom: 6,
                            fontWeight: "500",
                        }}
                    >
                        Plan
                    </Text>

                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                        Current plan:{" "}
                        <Text
                            style={{
                                fontWeight: "700",
                                color: colors.textPrimary,
                            }}
                        >
                            {tierLabel}
                        </Text>
                    </Text>

                    <Text
                        style={{
                            fontSize: 12,
                            color: colors.textSecondary,
                            marginTop: 6,
                        }}
                    >
                        Billing is not enabled yet. This plan flag is used
                        only to prepare feature gating (e.g., cloud sync / history depth)
                        for a future release.
                    </Text>

                    {!canCloudSync && (
                        <Text
                            style={{
                                fontSize: 12,
                                color: colors.textSecondary,
                                marginTop: 8,
                            }}
                        >
                            {cloudGateReason ||
                                "Cloud sync is available with Premium."}
                        </Text>
                    )}

                    {DEBUG_UI_ENABLED && canSetTier && (
                        <View style={{ marginTop: 12 }}>
                            <Text
                                style={{
                                    fontSize: 12,
                                    color: colors.textSecondary,
                                    marginBottom: 8,
                                }}
                            >
                                Debug (local): switch plan to test gated features
                            </Text>

                            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                                {(
                                    [
                                        "FREE",
                                        "PREMIUM",
                                        "FAMILY",
                                        "EDU",
                                        "ENTERPRISE",
                                    ] as LicenseTier[]
                                ).map((tier) => {
                                    const active =
                                        String(licenseTier ?? "FREE").toUpperCase() ===
                                        tier;

                                    return (
                                        <TouchableOpacity
                                            key={tier}
                                            onPress={() => setTierSafe(tier)}
                                            style={{
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor: active
                                                    ? colors.primary
                                                    : colors.border,
                                                backgroundColor: active
                                                    ? "rgba(56, 189, 248, 0.18)"
                                                    : "rgba(15, 23, 42, 0.9)",
                                                marginRight: 8,
                                                marginBottom: 8,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: "700",
                                                    color: active
                                                        ? colors.textPrimary
                                                        : colors.textSecondary,
                                                }}
                                            >
                                                {prettyTier(tier)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </AppSurface>

                {/* Emotion Insights card */}
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
                            Emotion Insights
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
                        this early version, analysis still runs locally on your device.
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

                {/* Appearance */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 6 }}>
                        Appearance
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                            {isDark ? "Dark mode" : "Light mode"}
                        </Text>
                        <TouchableOpacity
                            onPress={toggleTheme}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: isDark ? "rgba(30,41,59,0.7)" : "rgba(226,232,240,0.9)",
                                gap: 6,
                            }}
                        >
                            <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={16} color={colors.textPrimary} />
                            <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: "600" }}>
                                Switch to {isDark ? "Light" : "Dark"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </AppSurface>

                {/* Daily check-in reminder */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: reminderEnabled ? 12 : 0 }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>
                                Daily check-in reminder
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                {reminderEnabled
                                    ? `Reminds you at ${String(reminderHour).padStart(2, "0")}:${String(reminderMinute).padStart(2, "0")} every day`
                                    : "Get a gentle nudge to reflect daily"}
                            </Text>
                        </View>
                        <Switch
                            value={reminderEnabled}
                            onValueChange={handleReminderToggle}
                            disabled={reminderLoading}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#ffffff"
                        />
                    </View>

                    {reminderEnabled && (
                        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>
                                Reminder time
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                                {/* Hour stepper */}
                                <View style={{ alignItems: "center", gap: 4 }}>
                                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>Hour</Text>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => handleReminderTimeChange((reminderHour + 23) % 24, reminderMinute)}
                                            style={{ padding: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                                        >
                                            <Text style={{ color: colors.textPrimary, fontSize: 14 }}>−</Text>
                                        </TouchableOpacity>
                                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, minWidth: 24, textAlign: "center" }}>
                                            {String(reminderHour).padStart(2, "0")}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => handleReminderTimeChange((reminderHour + 1) % 24, reminderMinute)}
                                            style={{ padding: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                                        >
                                            <Text style={{ color: colors.textPrimary, fontSize: 14 }}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textSecondary, marginTop: 14 }}>:</Text>
                                {/* Minute stepper */}
                                <View style={{ alignItems: "center", gap: 4 }}>
                                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>Minute</Text>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => handleReminderTimeChange(reminderHour, (reminderMinute + 45) % 60)}
                                            style={{ padding: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                                        >
                                            <Text style={{ color: colors.textPrimary, fontSize: 14 }}>−</Text>
                                        </TouchableOpacity>
                                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, minWidth: 24, textAlign: "center" }}>
                                            {String(reminderMinute).padStart(2, "0")}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => handleReminderTimeChange(reminderHour, (reminderMinute + 15) % 60)}
                                            style={{ padding: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                                        >
                                            <Text style={{ color: colors.textPrimary, fontSize: 14 }}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <View style={{ flex: 1, alignItems: "flex-end", marginTop: 14 }}>
                                    <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: "right", lineHeight: 14 }}>
                                        Minutes step{"\n"}by 15
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}
                </AppSurface>

                {/* Emotional fingerprint */}
                {emotionalFingerprint && (
                    <AppSurface style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <View>
                                <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>Your emotional fingerprint</Text>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                    {emotionalFingerprint.totalRecords} moments tracked · last 30 days
                                </Text>
                            </View>
                            {emotionalFingerprint.trend && (
                                <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: emotionalFingerprint.trend === "lighter" ? "rgba(52,211,153,0.4)" : emotionalFingerprint.trend === "heavier" ? "rgba(251,146,60,0.4)" : colors.border, backgroundColor: emotionalFingerprint.trend === "lighter" ? "rgba(52,211,153,0.08)" : emotionalFingerprint.trend === "heavier" ? "rgba(251,146,60,0.08)" : "transparent" }}>
                                    <Text style={{ fontSize: 10, color: emotionalFingerprint.trend === "lighter" ? "#34d399" : emotionalFingerprint.trend === "heavier" ? "#fb923c" : colors.textSecondary }}>
                                        {emotionalFingerprint.trend === "lighter" ? "Easing ↓" : emotionalFingerprint.trend === "heavier" ? "Intensifying ↑" : "Steady →"}
                                    </Text>
                                </View>
                            )}
                        </View>
                        {emotionalFingerprint.topEmotions.map(({ emotion, pct }) => (
                            <View key={emotion} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <Text style={{ width: 64, fontSize: 11, color: colors.textSecondary }}>
                                    {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                                </Text>
                                <View style={{ flex: 1, height: 4, borderRadius: 999, backgroundColor: colors.border }}>
                                    <View style={{ width: `${pct}%`, height: 4, borderRadius: 999, backgroundColor: colors.primary }} />
                                </View>
                                <Text style={{ width: 28, fontSize: 10, color: colors.textSecondary, textAlign: "right" }}>{pct}%</Text>
                            </View>
                        ))}
                    </AppSurface>
                )}

                {/* Companion memory */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: memories.length > 0 ? 10 : 0 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>
                                Companion memory
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                {memories.length === 0
                                    ? "Nothing stored yet — Imotara will learn from your conversations."
                                    : `${memories.length} thing${memories.length !== 1 ? "s" : ""} remembered`}
                            </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <TouchableOpacity onPress={() => { setAddingMemory(true); setNewMemoryText(""); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>+ Add</Text>
                            </TouchableOpacity>
                            {memories.length > 0 && (
                                <TouchableOpacity onPress={handleClearMemories} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Text style={{ fontSize: 12, color: "rgba(248,113,113,0.9)", fontWeight: "600" }}>Clear</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    {addingMemory && (
                        <View style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 }}>
                            <TextInput
                                value={newMemoryText}
                                onChangeText={setNewMemoryText}
                                autoFocus
                                placeholder="E.g. I have anxiety around social situations"
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                maxLength={200}
                                style={{ fontSize: 12, color: colors.textPrimary, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, minHeight: 40 }}
                            />
                            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
                                <TouchableOpacity onPress={() => setAddingMemory(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleAddMemory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    {memories.map((m) => (
                        <View
                            key={m.id}
                            style={{
                                paddingVertical: 6,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                        >
                            {editingMemoryId === m.id ? (
                                <View style={{ gap: 6 }}>
                                    <TextInput
                                        value={editingMemoryText}
                                        onChangeText={setEditingMemoryText}
                                        autoFocus
                                        multiline
                                        maxLength={200}
                                        style={{ fontSize: 12, color: colors.textPrimary, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, minHeight: 40 }}
                                    />
                                    <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
                                        <TouchableOpacity onPress={() => setEditingMemoryId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Text style={{ fontSize: 11, color: colors.textSecondary }}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleSaveEditMemory(m.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Save</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                    <Text style={{ fontSize: 11, color: colors.primary, marginTop: 1 }}>●</Text>
                                    <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1 }}>{m.text}</Text>
                                    <TouchableOpacity
                                        onPress={() => handleStartEditMemory(m)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        style={{ marginRight: 8 }}
                                    >
                                        <Text style={{ fontSize: 11, color: colors.primary }}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveMemory(m.id)}
                                        disabled={deletingMemoryId === m.id}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={{ fontSize: 11, color: deletingMemoryId === m.id ? colors.textSecondary : "rgba(248,113,113,0.8)" }}>
                                            {deletingMemoryId === m.id ? "…" : "Forget"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    ))}
                </AppSurface>

                {/* ✅ Analysis Mode (Local / Cloud / Auto) */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginBottom: 6,
                            fontWeight: "500",
                        }}
                    >
                        Analysis Mode
                    </Text>

                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
                        Choose how Imotara replies are generated.
                    </Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {(
                            [
                                { id: "auto", label: "Auto" },
                                { id: "cloud", label: "Cloud" },
                                { id: "local", label: "Local" },
                            ] as const
                        ).map((opt) => {
                            const active = analysisMode === opt.id;
                            const cloudLocked = opt.id === "cloud" && !canCloudSync;

                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    disabled={cloudLocked}
                                    onPress={() => {
                                        if (cloudLocked) {
                                            Alert.alert(
                                                "Cloud mode unavailable",
                                                cloudGateReason || "Cloud mode is available with Premium."
                                            );
                                            return;
                                        }
                                        setAnalysisMode(opt.id);
                                    }}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active
                                            ? "rgba(56, 189, 248, 0.18)"
                                            : "rgba(15, 23, 42, 0.9)",
                                        marginRight: 8,
                                        marginBottom: 8,
                                        opacity: cloudLocked ? 0.45 : 1,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: "700",
                                            color: active ? colors.textPrimary : colors.textSecondary,
                                        }}
                                    >
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}

                    </View>

                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
                        Auto: tries cloud, falls back to local. Cloud: always uses cloud.
                        Local: device-only, nothing is sent externally.{"\n"}
                        When cloud is used, your message text is sent to OpenAI (ChatGPT) to generate a reply, with Google (Gemini) as a fallback. No account info, device ID, or personal data is attached. OpenAI's and Google's privacy policies apply to data processed by their APIs. Local mode keeps everything on-device — nothing is sent externally.
                    </Text>

                    {!canCloudSync ? (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
                            Cloud is currently unavailable:{" "}
                            {cloudGateReason || "Cloud mode is available with Premium."}
                        </Text>
                    ) : null}

                </AppSurface>

                {/* ✅ Cross-device Link Key (optional) */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginBottom: 6,
                            fontWeight: "500",
                        }}
                    >
                        Link this device (optional)
                    </Text>

                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
                        Enter the same Link Key on Web + Mobile to see the same remote chat history.
                        Treat it like a private password.
                    </Text>

                    <TextInput
                        value={chatLinkKey}
                        onChangeText={(t) => {
                            setChatLinkKey(t);
                            setChatLinkStatus(null);
                        }}
                        placeholder="Link Key (e.g., soumen-sync-1)"
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            color: colors.textPrimary,
                            backgroundColor: colors.surfaceSoft,
                            marginBottom: 10,
                        }}
                    />

                    <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                        <TouchableOpacity
                            onPress={saveChatLinkKey}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: colors.surface,
                            }}
                        >
                            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
                                Save
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={clearChatLinkKey}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: colors.surfaceSoft,
                            }}
                        >
                            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
                                Clear
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {chatLinkStatus ? (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10 }}>
                            {chatLinkStatus}
                        </Text>
                    ) : null}

                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10 }}>
                        Tip: Use a short phrase with no spaces. Example: soumen-sync-1
                    </Text>
                </AppSurface>

                {/* ✅ Personal Info */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Personal Info
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
                        Optional. Used only to make wording feel more natural. Never shared.
                    </Text>

                    {/* Name */}
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                        Your name (optional)
                    </Text>
                    <TextInput
                        value={toneContext?.user?.name ?? ""}
                        onChangeText={(t) =>
                            setToneContext({
                                ...(toneContext || {}),
                                user: { ...(toneContext?.user || {}), name: t },
                            })
                        }
                        placeholder="e.g., Soumen"
                        placeholderTextColor={colors.textSecondary}
                        autoCorrect={false}
                        style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            fontSize: 14,
                            color: colors.textPrimary,
                            backgroundColor: colors.surfaceSoft,
                            marginBottom: 14,
                        }}
                    />

                    {/* Age range */}
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                        Age range
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
                        {(
                            [
                                { id: "prefer_not", label: "Prefer not to say" },
                                { id: "13_17", label: "13–17" },
                                { id: "18_24", label: "18–24" },
                                { id: "25_34", label: "25–34" },
                                { id: "35_44", label: "35–44" },
                                { id: "45_54", label: "45–54" },
                                { id: "55_64", label: "55–64" },
                                { id: "65_plus", label: "65+" },
                            ] as const
                        ).map((opt) => {
                            const active = ((toneContext?.user?.ageTone ?? toneContext?.user?.ageRange) || "prefer_not") === opt.id;
                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    onPress={() =>
                                        setToneContext({
                                            ...(toneContext || {}),
                                            user: {
                                                ...(toneContext?.user || {}),
                                                ageTone: opt.id as any,
                                                ageRange: opt.id as any,
                                            },
                                        })
                                    }
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? "rgba(56, 189, 248, 0.18)" : "rgba(15, 23, 42, 0.9)",
                                        marginRight: 8,
                                        marginBottom: 8,
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: active ? colors.textPrimary : colors.textSecondary }}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Gender */}
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                        Gender
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
                        {(
                            [
                                { id: "prefer_not", label: "Prefer not to say" },
                                { id: "female", label: "Female" },
                                { id: "male", label: "Male" },
                                { id: "nonbinary", label: "Non-binary" },
                                { id: "other", label: "Other" },
                            ] as const
                        ).map((opt) => {
                            const active = (toneContext?.user?.gender || "prefer_not") === opt.id;
                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    onPress={() =>
                                        setToneContext({
                                            ...(toneContext || {}),
                                            user: { ...(toneContext?.user || {}), gender: opt.id as any },
                                        })
                                    }
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? "rgba(56, 189, 248, 0.18)" : "rgba(15, 23, 42, 0.9)",
                                        marginRight: 8,
                                        marginBottom: 8,
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: active ? colors.textPrimary : colors.textSecondary }}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Voice preview */}
                    <TouchableOpacity
                        onPress={() => {
                            const id = "settings-user-preview";
                            if (voicePreviewId === id) {
                                stopSpeaking();
                                setVoicePreviewId(null);
                            } else {
                                const gender = toneContext?.user?.gender;
                                const lang = toneContext?.user?.preferredLang ?? "en";
                                setVoicePreviewId(id);
                                speakMessage(id, "Hi, I'm Imotara — I'm here with you.", gender, lang, () =>
                                    setVoicePreviewId(null)
                                );
                            }
                        }}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}
                    >
                        <Text style={{ fontSize: 12, color: colors.primary }}>
                            {voicePreviewId === "settings-user-preview" ? "⏹ Stop preview" : "🔊 Preview voice"}
                        </Text>
                    </TouchableOpacity>

                    {/* Preferred language */}
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                        Preferred language
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
                        {(
                            [
                                { id: "en", label: "English" },
                                { id: "bn", label: "Bengali" },
                                { id: "gu", label: "Gujarati" },
                                { id: "hi", label: "Hindi" },
                                { id: "kn", label: "Kannada" },
                                { id: "ml", label: "Malayalam" },
                                { id: "mr", label: "Marathi" },
                                { id: "or", label: "Odia" },
                                { id: "pa", label: "Punjabi" },
                                { id: "ta", label: "Tamil" },
                                { id: "te", label: "Telugu" },
                                { id: "ur", label: "Urdu" },
                                { id: "ar", label: "Arabic" },
                                { id: "zh", label: "Chinese" },
                                { id: "fr", label: "French" },
                                { id: "de", label: "German" },
                                { id: "he", label: "Hebrew" },
                                { id: "id", label: "Indonesian" },
                                { id: "ja", label: "Japanese" },
                                { id: "pt", label: "Portuguese" },
                                { id: "ru", label: "Russian" },
                                { id: "es", label: "Spanish" },
                            ] as const
                        ).map((opt) => {
                            const currentLang = toneContext?.user?.preferredLang ?? "en";
                            const active = currentLang === opt.id;
                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    onPress={() =>
                                        setToneContext({
                                            ...(toneContext || {}),
                                            user: {
                                                ...(toneContext?.user || {}),
                                                preferredLang: opt.id as any,
                                            },
                                        })
                                    }
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? "rgba(56, 189, 248, 0.18)" : "rgba(15, 23, 42, 0.9)",
                                        marginRight: 8,
                                        marginBottom: 8,
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: active ? colors.textPrimary : colors.textSecondary }}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                </AppSurface>

                {/* ✅ Expected Companion Tone (tone only) */}

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
                            Expected Companion Tone (tone only)
                        </Text>

                        <Switch
                            value={!!toneContext?.companion?.enabled}
                            onValueChange={(v) =>
                                setToneContext({
                                    ...(toneContext || {}),
                                    companion: {
                                        ...(toneContext?.companion || {}),
                                        enabled: !!v,
                                    },
                                })
                            }
                            trackColor={{ false: "#4b5563", true: colors.primary }}
                            thumbColor={"#f9fafb"}
                        />
                    </View>

                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
                        Optional. This only guides wording and warmth. Imotara will not pretend to be a
                        real person.
                    </Text>

                    {/* Companion name */}
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                        Companion name (optional)
                    </Text>
                    <TextInput
                        value={toneContext?.companion?.name ?? ""}
                        onChangeText={(t) =>
                            setToneContext({
                                ...(toneContext || {}),
                                companion: { ...(toneContext?.companion || {}), name: t },
                            })
                        }
                        placeholder="e.g. Imotara"
                        placeholderTextColor={colors.textSecondary}
                        editable={!!toneContext?.companion?.enabled}
                        style={{
                            fontSize: 13,
                            color: colors.textPrimary,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            backgroundColor: colors.surfaceSoft,
                            marginBottom: 12,
                            opacity: toneContext?.companion?.enabled ? 1 : 0.5,
                        }}
                    />

                    {/* Relationship */}
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                        Relationship tone
                    </Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {(
                            [
                                { id: "prefer_not", label: "Prefer not to specify" },
                                { id: "mentor", label: "Mentor" },
                                { id: "elder", label: "Elder" },
                                { id: "friend", label: "Friend" },
                                { id: "coach", label: "Coach" },
                                { id: "sibling", label: "Sibling (younger/peer vibe)" },
                                { id: "junior_buddy", label: "Junior buddy (younger vibe)" },
                                { id: "parent_like", label: "Parent-like (tone only)" },
                                { id: "partner_like", label: "Partner-like (tone only)" },
                            ] as const
                        ).map((opt) => {
                            const active = (toneContext?.companion?.relationship || "prefer_not") === opt.id;

                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    onPress={() =>
                                        setToneContext({
                                            ...(toneContext || {}),
                                            companion: {
                                                ...(toneContext?.companion || {}),
                                                relationship: opt.id,
                                            },
                                        })
                                    }
                                    disabled={!toneContext?.companion?.enabled}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active
                                            ? "rgba(56, 189, 248, 0.18)"
                                            : "rgba(15, 23, 42, 0.9)",
                                        marginRight: 8,
                                        marginBottom: 8,
                                        opacity: toneContext?.companion?.enabled ? 1 : 0.5,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: "700",
                                            color: active ? colors.textPrimary : colors.textSecondary,
                                        }}
                                    >
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Age range */}
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10, marginBottom: 6 }}>
                        Age tone
                    </Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {(
                            [
                                { id: "prefer_not", label: "Prefer not to say" },
                                { id: "under_13", label: "Under 13" },
                                { id: "13_17", label: "13–17" },
                                { id: "18_24", label: "18–24" },
                                { id: "25_34", label: "25–34" },
                                { id: "35_44", label: "35–44" },
                                { id: "45_54", label: "45–54" },
                                { id: "55_64", label: "55–64" },
                                { id: "65_plus", label: "65+" },
                            ] as const
                        ).map((opt) => {
                            const active =
                                ((toneContext?.companion?.ageTone ?? toneContext?.companion?.ageRange) || "prefer_not") === opt.id;

                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    onPress={() =>
                                        setToneContext({
                                            ...(toneContext || {}),
                                            companion: {
                                                ...(toneContext?.companion || {}),
                                                ageTone: opt.id,
                                                ageRange: opt.id, // legacy compatibility
                                            },
                                        })
                                    }
                                    disabled={!toneContext?.companion?.enabled}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active
                                            ? "rgba(56, 189, 248, 0.18)"
                                            : "rgba(15, 23, 42, 0.9)",
                                        marginRight: 8,
                                        marginBottom: 8,
                                        opacity: toneContext?.companion?.enabled ? 1 : 0.5,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: "700",
                                            color: active ? colors.textPrimary : colors.textSecondary,
                                        }}
                                    >
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* ⚠️ Tone mismatch hint (additive UI only) */}
                    {(() => {
                        const relationship = toneContext?.companion?.relationship || "prefer_not";
                        const ageTone =
                            (toneContext?.companion?.ageTone ?? toneContext?.companion?.ageRange) || "prefer_not";

                        const mismatch =
                            !!toneContext?.companion?.enabled &&
                            ageTone === "under_13" &&
                            ["mentor", "elder", "parent_like", "partner_like"].includes(relationship);

                        if (!mismatch) return null;

                        const relationshipLabel: Record<string, string> = {
                            mentor: "Mentor",
                            elder: "Elder",
                            parent_like: "Parent-like",
                            partner_like: "Partner-like",
                        };

                        return (
                            <View
                                style={{
                                    marginTop: 10,
                                    padding: 12,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: "rgba(251, 191, 36, 0.55)",
                                    backgroundColor: "rgba(251, 191, 36, 0.12)",
                                }}
                            >
                                <Text style={{ fontSize: 12, color: colors.textPrimary, fontWeight: "700" }}>
                                    Heads up
                                </Text>

                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 16 }}>
                                    "Under 13" + "{relationshipLabel[relationship] || relationship}" can create a tone
                                    conflict and sometimes makes replies feel awkward or repetitive. You can keep it,
                                    but for smoother replies try "Junior buddy" or "Sibling".
                                </Text>

                                <View style={{ flexDirection: "row", marginTop: 10 }}>
                                    <TouchableOpacity
                                        onPress={() =>
                                            setToneContext({
                                                ...(toneContext || {}),
                                                companion: {
                                                    ...(toneContext?.companion || {}),
                                                    relationship: "junior_buddy",
                                                },
                                            })
                                        }
                                        style={{
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 999,
                                            borderWidth: 1,
                                            borderColor: colors.primary,
                                            backgroundColor: "rgba(56, 189, 248, 0.18)",
                                        }}
                                    >
                                        <Text style={{ fontSize: 12, fontWeight: "800", color: colors.textPrimary }}>
                                            Fix: set Junior buddy
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })()}

                    {/* Gender */}
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10, marginBottom: 6 }}>
                        Gender tone
                    </Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {(
                            [
                                { id: "prefer_not", label: "Prefer not to say" },
                                { id: "female", label: "Female" },
                                { id: "male", label: "Male" },
                                { id: "nonbinary", label: "Non-binary" },
                                { id: "other", label: "Other" },
                            ] as const
                        ).map((opt) => {
                            const active = (toneContext?.companion?.gender || "prefer_not") === opt.id;

                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    onPress={() =>
                                        setToneContext({
                                            ...(toneContext || {}),
                                            companion: {
                                                ...(toneContext?.companion || {}),
                                                gender: opt.id,
                                            },
                                        })
                                    }
                                    disabled={!toneContext?.companion?.enabled}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active
                                            ? "rgba(56, 189, 248, 0.18)"
                                            : "rgba(15, 23, 42, 0.9)",
                                        marginRight: 8,
                                        marginBottom: 8,
                                        opacity: toneContext?.companion?.enabled ? 1 : 0.5,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: "700",
                                            color: active ? colors.textPrimary : colors.textSecondary,
                                        }}
                                    >
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Companion respond */}
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10, marginBottom: 6 }}>
                        Companion respond
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 4 }}>
                        {(
                            [
                                { id: "auto", label: "Let Imotara decide" },
                                { id: "comfort", label: "Comfort me" },
                                { id: "reflect", label: "Help me reflect" },
                                { id: "motivate", label: "Motivate me" },
                                { id: "advise", label: "Give advice" },
                            ] as const
                        ).map((opt) => {
                            const currentStyle = toneContext?.user?.responseStyle ?? "auto";
                            const active = currentStyle === opt.id;
                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    onPress={() =>
                                        setToneContext({
                                            ...(toneContext || {}),
                                            user: {
                                                ...(toneContext?.user || {}),
                                                responseStyle: opt.id === "auto" ? undefined : (opt.id as any),
                                            },
                                        })
                                    }
                                    disabled={!toneContext?.companion?.enabled}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? "rgba(56, 189, 248, 0.18)" : "rgba(15, 23, 42, 0.9)",
                                        marginRight: 8,
                                        marginBottom: 8,
                                        opacity: toneContext?.companion?.enabled ? 1 : 0.5,
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: active ? colors.textPrimary : colors.textSecondary }}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {toneContext?.user?.responseStyle && (
                        <Text style={{ fontSize: 11, color: colors.textSecondary, fontStyle: "italic", marginTop: 4, marginBottom: 4 }}>
                            {toneContext.user.responseStyle === "comfort"  && "\u201cThat sounds really hard. I\u2019m here with you \u2014 take all the time you need.\u201d"}
                            {toneContext.user.responseStyle === "reflect"  && "\u201cWhat do you think that feeling is trying to tell you?\u201d"}
                            {toneContext.user.responseStyle === "motivate" && "\u201cYou\u2019re doing better than you think. One small step is all it takes today.\u201d"}
                            {toneContext.user.responseStyle === "advise"   && "\u201cHere\u2019s what might help: start with the smallest task, just to build momentum.\u201d"}
                        </Text>
                    )}
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
                        title="Export Data (JSON)"
                        onPress={handleExportData}
                        style={{ alignSelf: "flex-start", borderRadius: 999, marginBottom: 8 }}
                    />

                    <AppButton
                        title="Clear Local History"
                        onPress={handleClearHistory}
                        variant="destructive"
                        style={{ alignSelf: "flex-start", borderRadius: 999 }}
                    />

                    {/* Auto-clear old messages */}
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 14, marginBottom: 6 }}>
                        Auto-clear synced messages older than:
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {([30, 60, 90] as const).map((days) => (
                            <TouchableOpacity
                                key={days}
                                onPress={() => {
                                    Alert.alert(
                                        `Clear messages older than ${days} days?`,
                                        "Only synced messages will be removed from this device. Unsynced messages are kept.",
                                        [
                                            { text: "Cancel", style: "cancel" },
                                            {
                                                text: "Clear",
                                                style: "destructive",
                                                onPress: () => {
                                                    const cutoff = Date.now() - days * 86_400_000;
                                                    history
                                                        .filter((item: HistoryRecord) => item.isSynced && (item.timestamp ?? 0) < cutoff)
                                                        .forEach((item: HistoryRecord) => deleteFromHistory(item.id));
                                                },
                                            },
                                        ],
                                    );
                                }}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 7,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                                }}
                            >
                                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary }}>
                                    {days} days
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
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
                                disabled={
                                    busyRef.current.pushOnly ||
                                    isAnySyncBusy ||
                                    !canCloudSync
                                }
                                variant="secondary"
                                style={{
                                    alignSelf: "flex-start",
                                    borderRadius: 999,
                                    marginBottom: 8,
                                    opacity:
                                        busyRef.current.pushOnly ||
                                            isAnySyncBusy ||
                                            !canCloudSync
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
                        disabled={
                            busyRef.current.syncNow || isAnySyncBusy || !canCloudSync
                        }
                        variant="primary"
                        style={{
                            alignSelf: "flex-start",
                            borderRadius: 999,
                            marginBottom: 10,
                            opacity:
                                busyRef.current.syncNow ||
                                    isAnySyncBusy ||
                                    !canCloudSync
                                    ? 0.7
                                    : 1,
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

                        {!canCloudSync && (
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: colors.textSecondary,
                                    marginTop: 6,
                                }}
                            >
                                {cloudGateReason ||
                                    "Cloud sync is available with Premium."}
                            </Text>
                        )}
                    </View>
                </AppSurface>

                {/* Feedback / Report Issue */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginBottom: 6,
                            fontWeight: "500",
                        }}
                    >
                        Feedback / Report Issue
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
                        Share feedback or report a bug — your message goes directly to the developer.
                    </Text>

                    {/* Type selector */}
                    <View style={{ flexDirection: "row", marginBottom: 12, gap: 8 }}>
                        {(["feedback", "bug"] as const).map((t) => (
                            <TouchableOpacity
                                key={t}
                                onPress={() => setFeedbackType(t)}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 6,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: feedbackType === t ? colors.primary : "rgba(255,255,255,0.15)",
                                    backgroundColor: feedbackType === t ? "rgba(56,189,248,0.15)" : "transparent",
                                }}
                            >
                                <Text style={{ fontSize: 13, color: feedbackType === t ? colors.primary : colors.textSecondary, fontWeight: feedbackType === t ? "600" : "400" }}>
                                    {t === "feedback" ? "Feedback" : "Bug Report"}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TextInput
                        value={feedbackText}
                        onChangeText={(v) => { setFeedbackText(v); setFeedbackStatus(null); }}
                        placeholder={feedbackType === "bug" ? "Describe the bug — what happened, what you expected, steps to reproduce…" : "What's on your mind? Suggestions, thoughts, anything…"}
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        numberOfLines={5}
                        style={{
                            backgroundColor: "rgba(255,255,255,0.06)",
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.12)",
                            padding: 12,
                            fontSize: 13,
                            color: colors.textPrimary,
                            textAlignVertical: "top",
                            height: 110,
                            marginBottom: 12,
                        }}
                    />

                    <TouchableOpacity
                        onPress={handleFeedbackSubmit}
                        disabled={!feedbackText.trim()}
                        style={{
                            alignSelf: "flex-start",
                            paddingHorizontal: 20,
                            paddingVertical: 9,
                            borderRadius: 999,
                            backgroundColor: "rgba(56,189,248,0.18)",
                            borderWidth: 1,
                            borderColor: "rgba(56,189,248,0.4)",
                            opacity: !feedbackText.trim() ? 0.5 : 1,
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                            Open Email
                        </Text>
                    </TouchableOpacity>

                    {feedbackStatus ? (
                        <Text style={{ fontSize: 12, color: feedbackStatus.startsWith("Thank") ? "#4ade80" : "#f87171", marginTop: 10 }}>
                            {feedbackStatus}
                        </Text>
                    ) : null}
                </AppSurface>

                {/* Delete Account */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginBottom: 6,
                            fontWeight: "500",
                        }}
                    >
                        Delete Account
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 19 }}>
                        Permanently deletes all your conversations, memories, and settings from this device and our servers. This action cannot be undone.
                    </Text>
                    <TouchableOpacity
                        onPress={handleDeleteAccount}
                        disabled={isDeletingAccount}
                        style={{
                            alignSelf: "flex-start",
                            paddingHorizontal: 20,
                            paddingVertical: 9,
                            borderRadius: 999,
                            backgroundColor: "rgba(248,113,113,0.12)",
                            borderWidth: 1,
                            borderColor: "rgba(248,113,113,0.4)",
                            opacity: isDeletingAccount ? 0.5 : 1,
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#f87171" }}>
                            {isDeletingAccount ? "Deleting…" : "Delete My Account"}
                        </Text>
                    </TouchableOpacity>
                </AppSurface>

                {/* App Info */}
                <AppSurface style={{ marginBottom: 16 }}>
                    {(() => {
                        const version =
                            (Constants as any)?.expoConfig?.version ??
                            (Constants as any)?.manifest2?.extra?.expoClient?.version ??
                            "—";
                        const build =
                            (Constants as any)?.expoConfig?.ios?.buildNumber ??
                            (Constants as any)?.expoConfig?.android?.versionCode ??
                            "—";
                        const rows = [
                            { label: "Version", value: `v${version}` },
                            { label: "Build", value: `${build}` },
                        ];
                        return (
                            <>
                                <Text
                                    style={{
                                        fontSize: 14,
                                        color: colors.textPrimary,
                                        fontWeight: "500",
                                        marginBottom: 10,
                                    }}
                                >
                                    App Info
                                </Text>
                                {rows.map(({ label, value }) => (
                                    <View
                                        key={label}
                                        style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                            paddingVertical: 6,
                                            borderTopWidth: 1,
                                            borderTopColor: "rgba(255,255,255,0.06)",
                                        }}
                                    >
                                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                                            {label}
                                        </Text>
                                        <Text style={{ fontSize: 13, color: colors.textPrimary }}>
                                            {value}
                                        </Text>
                                    </View>
                                ))}
                            </>
                        );
                    })()}
                </AppSurface>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
