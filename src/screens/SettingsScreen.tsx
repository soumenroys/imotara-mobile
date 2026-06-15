// src/screens/SettingsScreen.tsx
import React, { useCallback } from "react";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import Constants from "expo-constants";
import IOSTipJar from "../components/imotara/IOSTipJar";
import UpgradeSheet from "../components/imotara/UpgradeSheet";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";


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
    LayoutAnimation,
    Image,
    Share,
    Modal,
    ActivityIndicator,
    InteractionManager,
} from "react-native";

import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useHistoryStore } from "../state/HistoryContext";
import type { HistoryItem as HistoryRecord } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";
import { useAuth } from "../auth/AuthContext";
import SettingsSearch from "../components/imotara/SettingsSearch";
import { useTheme, ACCENT_COLORS, type Accent, type FontSize } from "../theme/ThemeContext";
import {
    scheduleCheckInReminder,
    cancelCheckInReminder,
    isCheckInReminderEnabled,
    getSavedReminderTime,
    getSavedNotifPrefs,
    saveNotifPrefs,
    DEFAULT_HOUR,
    DEFAULT_MINUTE,
    DEFAULT_INACTIVITY_HOURS,
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
import { HowItWorksModal } from "../components/imotara/HowItWorksModal";
import { speakMessage, speakPreview, stopSpeaking } from "../lib/tts/mobileTTS";


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
        case "FREE":    return "Free";
        case "PLUS":    return "Plus";
        case "PREMIUM": return "Pro";
        case "FAMILY":  return "Family";
        case "EDU":     return "Education";
        case "ENTERPRISE": return "Enterprise";
        default:        return "Free";
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

const AVATAR_AGES = [6, 16, 26, 36, 46, 56, 66, 76, 86, 96];

const AGE_RANGE_TO_AVATAR: Record<string, number> = {
    prefer_not: 26, under_13: 6, "13_17": 16, "18_24": 26,
    "25_34": 26, "35_44": 36, "45_54": 46, "55_64": 56, "65_plus": 66,
};

const AVATAR_AGE_LABEL: Record<number, string> = {
    6: "Under 13", 16: "13–17", 26: "18–34", 36: "35–44",
    46: "45–54", 56: "55–64", 66: "65–75", 76: "76–85", 86: "86–95", 96: "96+",
};

// Static require map — bundler needs literal paths at build time
const AVATAR_IMAGES: Record<string, Record<number, any>> = {
    male: {
        6: require("../../assets/avatars/male/6.jpg"),
        16: require("../../assets/avatars/male/16.jpg"),
        26: require("../../assets/avatars/male/26.jpg"),
        36: require("../../assets/avatars/male/36.jpg"),
        46: require("../../assets/avatars/male/46.jpg"),
        56: require("../../assets/avatars/male/56.jpg"),
        66: require("../../assets/avatars/male/66.jpg"),
        76: require("../../assets/avatars/male/76.jpg"),
        86: require("../../assets/avatars/male/86.jpg"),
        96: require("../../assets/avatars/male/96.jpg"),
    },
    female: {
        6: require("../../assets/avatars/female/6.jpg"),
        16: require("../../assets/avatars/female/16.jpg"),
        26: require("../../assets/avatars/female/26.jpg"),
        36: require("../../assets/avatars/female/36.jpg"),
        46: require("../../assets/avatars/female/46.jpg"),
        56: require("../../assets/avatars/female/56.jpg"),
        66: require("../../assets/avatars/female/66.jpg"),
        76: require("../../assets/avatars/female/76.jpg"),
        86: require("../../assets/avatars/female/86.jpg"),
        96: require("../../assets/avatars/female/96.jpg"),
    },
};

function AvatarSlider({
    gender,
    ageValue,
    onChange,
    name,
    enabled: companionEnabled = true,
    colors,
}: {
    gender: string | undefined;
    ageValue: number;
    onChange: (age: number) => void;
    name?: string;
    enabled?: boolean;
    colors: any;
}) {
    const avatarEnabled = (gender === "male" || gender === "female") && companionEnabled;
    const idx = AVATAR_AGES.indexOf(ageValue);
    const safeIdx = idx === -1 ? 2 : idx;
    const safeAge = AVATAR_AGES[safeIdx];

    return (
        <View style={{ marginTop: 14, marginBottom: 14 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                Avatar appearance
            </Text>
            {avatarEnabled ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {/* Selected avatar image + name */}
                    <View style={{ alignItems: "center", gap: 4 }}>
                        <View
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 16,
                                overflow: "hidden",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.1)",
                                backgroundColor: colors.surfaceSoft,
                            }}
                        >
                            <Image
                                source={AVATAR_IMAGES[gender!]?.[safeAge]}
                                style={{ width: 64, height: 64 }}
                                resizeMode="cover"
                            />
                        </View>
                        {name ? (
                            <Text
                                numberOfLines={1}
                                style={{
                                    fontSize: 11,
                                    fontWeight: "600",
                                    color: colors.textSecondary,
                                    maxWidth: 64,
                                }}
                            >
                                {name}
                            </Text>
                        ) : null}
                    </View>

                    {/* Thumbnail strip */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
                    >
                        {AVATAR_AGES.map((age, i) => {
                            const active = i === safeIdx;
                            return (
                                <TouchableOpacity
                                    key={age}
                                    onPress={() => onChange(age)}
                                    style={{
                                        alignItems: "center",
                                        gap: 3,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 10,
                                            overflow: "hidden",
                                            borderWidth: active ? 2 : 1,
                                            borderColor: active ? colors.primary : "rgba(255,255,255,0.1)",
                                        }}
                                    >
                                        <Image
                                            source={AVATAR_IMAGES[gender!]?.[age]}
                                            style={{ width: 44, height: 44 }}
                                            resizeMode="cover"
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            fontSize: 9,
                                            color: active ? colors.primary : colors.textSecondary,
                                            fontWeight: active ? "700" : "400",
                                        }}
                                    >
                                        {AVATAR_AGE_LABEL[age]}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            ) : (
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    Set Gender to{" "}
                    <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Male</Text>
                    {" "}or{" "}
                    <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Female</Text>
                    {" "}above to choose an avatar.
                </Text>
            )}
        </View>
    );
}

// ── SettingsScreen shell ─────────────────────────────────────────────────────
// Splits the heavy content into a child component so we can defer its mount
// until after the tab-switch animation completes. Without this, 140+ hook
// initialisations + dozens of concurrent AsyncStorage reads fire on mount,
// causing blank frames during tab switches.
// useFocusEffect + setTimeout is reliable in production Hermes builds unlike
// InteractionManager.runAfterInteractions which fires immediately on fast devices.
export default function SettingsScreen() {
    const { colors: colors_early, isDark } = useTheme();
    const [screenReady, setScreenReady] = React.useState(false);
    const prevIsDarkRef = React.useRef(isDark);
    const themeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Tab-switch blank screen fix.
    // Problem: even after our delay, React still needs to mount 140 hooks in
    // SettingsScreenContent, and during that mounting phase the screen is blank
    // before the first paint commits.
    // Fix: double requestAnimationFrame inside the timeout ensures the spinner
    // is fully painted to screen (2 frames committed) BEFORE React starts the
    // heavy mount. RAF1 = schedule render of spinner. RAF2 = spinner committed.
    // Then setScreenReady(true) triggers the heavy mount with a clean first frame.
    useFocusEffect(
        useCallback(() => {
            setScreenReady(false);
            let cancelled = false;
            const timer = setTimeout(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (!cancelled) setScreenReady(true);
                    });
                });
            }, 300);
            return () => {
                cancelled = true;
                clearTimeout(timer);
            };
        }, [])
    );

    // Theme-change blank screen fix: same double-RAF pattern.
    React.useEffect(() => {
        if (prevIsDarkRef.current === isDark) return;
        prevIsDarkRef.current = isDark;
        if (themeTimerRef.current) clearTimeout(themeTimerRef.current);
        setScreenReady(false);
        themeTimerRef.current = setTimeout(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setScreenReady(true);
                });
            });
        }, 350);
        return () => {
            if (themeTimerRef.current) clearTimeout(themeTimerRef.current);
        };
    }, [isDark]);

    if (!screenReady) {
        return (
            <View style={{ flex: 1, backgroundColor: colors_early.background, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="small" color={colors_early.primary} />
            </View>
        );
    }

    return <SettingsScreenContent />;
}

function SettingsScreenContent() {
    const { accessToken, signOut, signInWithGoogle } = useAuth();
    const navigation = useNavigation<any>();

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
        companionPanelEnabled,
        setCompanionPanelEnabled,
        planPanelEnabled,
        setPlanPanelEnabled,
        teenMode,
        setTeenMode,
        childSafeMode,
        setChildSafeMode,
        showSyncBadge,
        setShowSyncBadge,
        companionReactionsEnabled,
        setCompanionReactionsEnabled,
        featureTipsEnabled,
        setFeatureTipsEnabled,
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

        licenseExpiresAt,
        refreshLicense,
        orgId,
        orgName,
        orgRole,
    } = useSettings();

    const { themeMode, toggleTheme, isDark, colors, accent, setAccent, fontSize, setFontSize } = useTheme();

    const messageCount = (history as HistoryRecord[]).length;

    // ✅ Fix implicit-any error by typing callback param
    const unsyncedCount = (history as HistoryRecord[]).filter(
        (h: HistoryRecord) => !h.isSynced
    ).length;

    // ✅ Account backup gate (soft gating)
    const cloudGate = gate("CLOUD_SYNC", licenseTier);

    // ✅ Keep real gating for production, but allow DEBUG builds to test sync reliability
    const canCloudSync = cloudGate.enabled || DEBUG_UI_ENABLED;

    // ✅ TS-safe reason: only exists when enabled === false
    const cloudGateReason = !cloudGate.enabled ? cloudGate.reason : undefined;

    // ── Feature gates (Plus / Pro tier controls) ──────────────────────────────
    const ttsAdvancedGate     = gate("TTS_ADVANCED",      licenseTier);
    const searchModeGate      = gate("SEARCH_MODE",       licenseTier);
    const replyCadenceGate    = gate("REPLY_CADENCE",     licenseTier);
    const companionLetterGate = gate("COMPANION_LETTER",  licenseTier);
    const growthArcGate       = gate("GROWTH_ARC",        licenseTier);
    const childSafeModeGate   = gate("CHILD_SAFE_MODE",   licenseTier);
    const multiProfileGate    = gate("MULTI_PROFILE",     licenseTier);
    // ─────────────────────────────────────────────────────────────────────────

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

    // Per-button donate loading state (null = idle, otherwise the preset id being processed)
    const [donatingId, setDonatingId] = React.useState<string | null>(null);

    // ─── Profile sync (Supabase cross-device) ────────────────────────────────
    // Capture initial toneContext to decide whether to pull from server on mount.
    // Updated on sign-out so a subsequent sign-in (different user, same device session)
    // gets the fresh empty defaults instead of the previous user's stale name.
    const initialToneRef = React.useRef(toneContext);
    React.useEffect(() => {
        if (!accessToken) initialToneRef.current = toneContext;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    // Pull: on sign-in, fetch profile from server and merge with local (server fills empty fields)
    React.useEffect(() => {
        if (!accessToken) return;
        const base = getApiBaseUrl();
        if (!base) return;
        fetchWithTimeout(`${base}/api/profile/sync`, { headers: { Authorization: `Bearer ${accessToken}` } }, 12_000)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!mountedRef.current) return;
                const srv = data?.toneContext;
                if (!srv) return;
                // Merge: local value wins if non-empty, server fills empty fields
                const local = toneContext ?? {};
                setToneContext({
                    user: {
                        name:          local?.user?.name?.trim()          || srv?.user?.name          || undefined,
                        preferredLang: local?.user?.preferredLang         || srv?.user?.preferredLang || undefined,
                        ageTone:       local?.user?.ageTone               || srv?.user?.ageTone       || undefined,
                        gender:        local?.user?.gender                || srv?.user?.gender        || undefined,
                        responseStyle: local?.user?.responseStyle         || srv?.user?.responseStyle || undefined,
                    },
                    companion: {
                        enabled:      local?.companion?.enabled !== undefined ? local.companion.enabled : srv?.companion?.enabled,
                        name:         local?.companion?.name?.trim()      || srv?.companion?.name      || undefined,
                        relationship: local?.companion?.relationship      || srv?.companion?.relationship || undefined,
                        ageTone:      local?.companion?.ageTone           || srv?.companion?.ageTone   || undefined,
                        gender:       local?.companion?.gender            || srv?.companion?.gender    || undefined,
                    },
                });
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
            fetchWithTimeout(`${base}/api/profile/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify(toneContext ?? {}),
            }, 12_000).catch(() => {
                if (mountedRef.current) {
                    showLinkStatus("Couldn't save — changes saved locally");
                }
            });
        }, 2000);
        return () => clearTimeout(timer);
    }, [toneContext, accessToken]);
    // ─────────────────────────────────────────────────────────────────────────

    // ✅ Daily check-in reminder
    const [reminderEnabled, setReminderEnabled] = React.useState(false);
    const [reminderLoading, setReminderLoading] = React.useState(false);
    const [reminderHour, setReminderHour] = React.useState(DEFAULT_HOUR);
    const [reminderMinute, setReminderMinute] = React.useState(DEFAULT_MINUTE);
    // N-3: notification sound + badge
    const [notifSound, setNotifSound] = React.useState(false);
    const [notifBadge, setNotifBadge] = React.useState(false);
    // N-2: inactivity threshold
    const [inactivityHours, setInactivityHours] = React.useState(DEFAULT_INACTIVITY_HOURS);
    const INACTIVITY_OPTIONS = [24, 48, 72, 168] as const;
    const inactivityLabel = (h: number) => h === 168 ? "7 days" : h === 24 ? "1 day" : `${h} hours`;

    React.useEffect(() => {
        isCheckInReminderEnabled().then(setReminderEnabled).catch(() => {});
        getSavedReminderTime().then(({ hour, minute }) => {
            setReminderHour(hour);
            setReminderMinute(minute);
        }).catch(() => {});
        getSavedNotifPrefs().then(({ sound, badge, inactivityHours: ih }) => {
            setNotifSound(sound);
            setNotifBadge(badge);
            setInactivityHours(ih);
        }).catch(() => {});
    }, []);

    const handleReminderToggle = async (value: boolean) => {
        if (reminderLoading) return;
        setReminderLoading(true);
        try {
            if (value) {
                const ok = await scheduleCheckInReminder(reminderHour, reminderMinute, notifSound, notifBadge);
                if (!mountedRef.current) return;
                if (ok) {
                    setReminderEnabled(true);
                } else {
                    Alert.alert(
                        "Permission needed",
                        "Please allow notifications in your device settings to enable daily reminders.",
                        [
                            { text: "Not now", style: "cancel" },
                            { text: "Open Settings", onPress: () => Linking.openSettings() },
                        ]
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
            await scheduleCheckInReminder(hour, minute, notifSound, notifBadge).catch(() => {});
        }
    };

    const handleNotifSoundToggle = async (value: boolean) => {
        setNotifSound(value);
        await saveNotifPrefs({ sound: value });
        if (reminderEnabled) {
            await scheduleCheckInReminder(reminderHour, reminderMinute, value, notifBadge).catch(() => {});
        }
    };

    const handleNotifBadgeToggle = async (value: boolean) => {
        setNotifBadge(value);
        await saveNotifPrefs({ badge: value });
        if (reminderEnabled) {
            await scheduleCheckInReminder(reminderHour, reminderMinute, notifSound, value).catch(() => {});
        }
    };

    const handleInactivityChange = async (hours: number) => {
        setInactivityHours(hours);
        await saveNotifPrefs({ inactivityHours: hours });
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
    const [memoryInputFocused, setMemoryInputFocused] = React.useState(false);
    const [editMemoryInputFocused, setEditMemoryInputFocused] = React.useState(false);
    const MEMORY_MAX_LENGTH = 500;
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

    // NF-3: Family snapshot share
    const [familySnapUrl, setFamilySnapUrl] = React.useState<string | null>(null);

    async function generateFamilySnapshotMobile() {
        try {
            const EMOTION_MAP: Record<string, string> = {
                joy: "joy", happiness: "joy", happy: "joy", hopeful: "hopeful",
                sadness: "sadness", sad: "sadness", grief: "grief",
                anxiety: "anxiety", anxious: "anxiety", stressed: "stressed",
                anger: "anger", angry: "anger", fear: "fear", neutral: "neutral",
            };
            const history: any[] = store.history ?? [];
            const now = Date.now();
            const week: string[] = Array.from({ length: 7 }, (_, i) => {
                const dayStart = now - (6 - i) * 86_400_000;
                const dayEnd = dayStart + 86_400_000;
                const dayMsgs = history.filter((m: any) => m.timestamp >= dayStart && m.timestamp < dayEnd && m.from === "user");
                const withEmotion = dayMsgs.find((m: any) => m.emotion || m.moodHint);
                const raw = withEmotion?.emotion ?? withEmotion?.moodHint ?? "neutral";
                return EMOTION_MAP[raw.toLowerCase()] ?? "neutral";
            });
            const freq: Record<string, number> = {};
            for (const e of week) freq[e] = (freq[e] ?? 0) + 1;
            const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";
            const challengeRaw = await AsyncStorage.getItem("imotara.challenge30.v1").catch(() => null);
            const challengeData = challengeRaw ? JSON.parse(challengeRaw) : {};
            const reflectionDays = Array.isArray(challengeData.completedDays) ? challengeData.completedDays.filter((d: number) => d < 7).length : 0;
            const snap = {
                displayName: (toneContext?.user?.name ?? ""),
                week,
                dominant,
                reflectionDays,
                generatedAt: new Date().toISOString().slice(0, 10),
            };
            const encoded = btoa(encodeURIComponent(JSON.stringify(snap)));
            const url = `https://imotaraapp.vercel.app/family/view?snap=${encoded}`;
            setFamilySnapUrl(url);
            return url;
        } catch {
            return null;
        }
    }

    async function shareFamilySnapshot() {
        const url = familySnapUrl ?? await generateFamilySnapshotMobile();
        if (!url) return;
        try {
            await Share.share({ message: `My mood snapshot this week: ${url}`, url });
        } catch { /* user cancelled */ }
    }

    // ── Accordion section open/closed state ─────────────────────────────────
    const [showUpgradeSheet, setShowUpgradeSheet] = React.useState(false);
    const [sectionAccount, setSectionAccount] = React.useState(false);
    const [sectionAppearance, setSectionAppearance] = React.useState(false);
    const [sectionCompanion, setSectionCompanion] = React.useState(false);
    const [sectionPrivacy, setSectionPrivacy] = React.useState(false);
    const [sectionSupport, setSectionSupport] = React.useState(true);
    const [sectionAdvancedMobile, setSectionAdvancedMobile] = React.useState(false);
    const [sectionMindset, setSectionMindset] = React.useState(false);

    const settingsScrollRef = React.useRef<import("react-native").ScrollView>(null);
    // Refs for each section header View — used with measure() for absolute positioning.
    const sectionRefs = React.useRef<Record<string, import("react-native").View | null>>({});
    // Current scroll offset — needed to compute target scroll Y from screen coordinates.
    const scrollOffsetY = React.useRef(0);

    const handleSearchSelect = React.useCallback((sectionKey: string) => {
        const sectionMap: Record<string, React.Dispatch<React.SetStateAction<boolean>>> = {
            companion: setSectionCompanion,
            experience: setSectionAppearance,
            privacy: setSectionPrivacy,
            mindset: setSectionMindset,
            advanced: setSectionAdvancedMobile,
            account: setSectionAccount,
            support: setSectionSupport,
        };
        const setter = sectionMap[sectionKey];
        if (setter) setter(true);

        // After accordion opens, use measure() to get absolute screen Y of both the
        // section header and the ScrollView, then compute exact scroll target.
        // Formula: targetY = scrollOffset + (sectionScreenY - scrollViewScreenY) - padding
        // measure() gives absolute screen coords and works on both Old and New Architecture.
        setTimeout(() => {
            const sectionRef = sectionRefs.current[sectionKey];
            const scrollView = settingsScrollRef.current;
            if (!sectionRef || !scrollView) return;

            sectionRef.measure((_x, _y, _w, _h, _pageX, sectionScreenY) => {
                (scrollView as any).measure(
                    (_sx: number, _sy: number, _sw: number, _sh: number, _spX: number, scrollViewScreenY: number) => {
                        const targetY = scrollOffsetY.current + (sectionScreenY - scrollViewScreenY) - 16;
                        scrollView.scrollTo({ y: Math.max(0, targetY), animated: true });
                    }
                );
            });
        }, 350);
    }, []);

    // ── Mindset Analysis Toggles ─────────────────────────────────────────────
    const MOOD_CHART_KEY = "imotara.mood.chart.show.v1";
    const [moodChartEnabled, setMoodChartEnabled] = React.useState(true);
    React.useEffect(() => { AsyncStorage.getItem(MOOD_CHART_KEY).then((v) => setMoodChartEnabled(v !== "0")).catch(() => {}); }, []);
    const handleMoodChartToggle = async (val: boolean) => { setMoodChartEnabled(val); await AsyncStorage.setItem(MOOD_CHART_KEY, val ? "1" : "0").catch(() => {}); };

    const MINDSET_PREFS_KEY = "imotara:mindset.analysis.prefs.v1";
    type MindsetPrefs = { today: boolean; week7: boolean; days30: boolean; allTime: boolean };
    const [mindsetPrefs, setMindsetPrefs] = React.useState<MindsetPrefs>({ today: false, week7: false, days30: false, allTime: false });
    React.useEffect(() => {
        AsyncStorage.getItem(MINDSET_PREFS_KEY).then((raw) => {
            if (raw) setMindsetPrefs((p) => ({ ...p, ...JSON.parse(raw) }));
        }).catch(() => {});
    }, []);
    const handleMindsetToggle = async (key: keyof MindsetPrefs) => {
        const next = { ...mindsetPrefs, [key]: !mindsetPrefs[key] };
        setMindsetPrefs(next);
        await AsyncStorage.setItem(MINDSET_PREFS_KEY, JSON.stringify(next)).catch(() => {});
    };

    // A-5: Storage summary (loaded once when component mounts)
    const [storageSummary, setStorageSummary] = React.useState<{
        emotionCount: number;
        totalKB: number;
    } | null>(null);

    React.useEffect(() => {
        (async () => {
            try {
                const emotionRaw = await AsyncStorage.getItem("imotara:history:v1").catch(() => null);
                const emotionArr: unknown[] = (() => {
                    try { return JSON.parse(emotionRaw ?? "[]"); } catch { return []; }
                })();
                // Approximate total KB from the main stored blobs
                const keys = [
                    "imotara:history:v1",
                    "imotara_settings_v1",
                    "imotara.challenge30.v1",
                ];
                let totalBytes = 0;
                for (const k of keys) {
                    const v = await AsyncStorage.getItem(k).catch(() => null);
                    if (v) totalBytes += v.length;
                }
                setStorageSummary({
                    emotionCount: emotionArr.length,
                    totalKB: Math.round(totalBytes / 1024),
                });
            } catch {
                // non-fatal
            }
        })();
    }, []);

    // C-3: Show timestamps toggle (mobile) — default ON
    const SHOW_TIMESTAMPS_KEY = "imotara.chat.showTimestamps.v1";
    const [showChatTimestamps, setShowChatTimestamps] = React.useState(true);
    React.useEffect(() => {
        AsyncStorage.getItem(SHOW_TIMESTAMPS_KEY)
            .then((v) => setShowChatTimestamps(v === null ? true : v === "1"))
            .catch(() => {});
    }, []);
    const handleShowTimestampsToggle = async (val: boolean) => {
        setShowChatTimestamps(val);
        await AsyncStorage.setItem(SHOW_TIMESTAMPS_KEY, val ? "1" : "0").catch(() => {});
    };

    // M-2: Auto-cleanup (mobile)
    const AUTO_CLEANUP_KEY = "imotara.history.autoCleanupDays.v1";
    const [autoCleanupDays, setAutoCleanupDays] = React.useState(0);
    const AUTO_CLEANUP_OPTIONS = [0, 30, 60, 90] as const;
    React.useEffect(() => {
        AsyncStorage.getItem(AUTO_CLEANUP_KEY).then((v) => {
            const n = parseInt(v ?? "0", 10);
            setAutoCleanupDays(isFinite(n) ? n : 0);
        }).catch(() => {});
    }, []);
    const handleAutoCleanupChange = async (days: number) => {
        setAutoCleanupDays(days);
        await AsyncStorage.setItem(AUTO_CLEANUP_KEY, String(days)).catch(() => {});
        if (days > 0) {
            try {
                const raw = await AsyncStorage.getItem("imotara:history:v1").catch(() => null);
                if (!raw) return;
                const arr: { timestamp?: number }[] = JSON.parse(raw);
                const cutoff = Date.now() - days * 86_400_000;
                const kept = arr.filter((r) => (r.timestamp ?? Date.now()) >= cutoff);
                await AsyncStorage.setItem("imotara:history:v1", JSON.stringify(kept)).catch(() => {});
            } catch { /* non-fatal */ }
        }
    };

    // O-1: Feature discovery reset
    const [discoveryResetMsg, setDiscoveryResetMsg] = React.useState<string | null>(null);
    const handleDiscoveryReset = async () => {
        // Both keys cleared for migration compatibility (old key: imotara.discovery.v1)
        await Promise.all([
            AsyncStorage.removeItem("imotara.onboarding.discovery.v1").catch(() => {}),
            AsyncStorage.removeItem("imotara.discovery.v1").catch(() => {}),
        ]);
        setDiscoveryResetMsg("Discovery cards reset — they will reappear in your next Chat session.");
    };

    // O-2: Restart onboarding
    const ONBOARDING_DONE_KEY = "imotara.onboarding.done.v1";
    const [onboardingResetMsg, setOnboardingResetMsg] = React.useState<string | null>(null);
    const handleRestartOnboarding = () => {
        Alert.alert(
            "Restart onboarding?",
            "Onboarding will appear next time you open the app. Your data, history, and settings are not affected.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Restart", style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.removeItem(ONBOARDING_DONE_KEY).catch(() => {});
                        setOnboardingResetMsg("Onboarding will appear next time you open Imotara.");
                    },
                },
            ]
        );
    };

    // H-2: Haptic intensity
    const HAPTIC_INTENSITY_KEY = "imotara.haptic.intensity.v1";
    const [hapticIntensity, setHapticIntensity] = React.useState<"off" | "light" | "strong">("light");
    React.useEffect(() => {
        AsyncStorage.getItem(HAPTIC_INTENSITY_KEY).then((v) => {
            if (v === "off" || v === "light" || v === "strong") setHapticIntensity(v);
        }).catch(() => {});
    }, []);
    const handleHapticIntensityChange = async (val: "off" | "light" | "strong") => {
        setHapticIntensity(val);
        await AsyncStorage.setItem(HAPTIC_INTENSITY_KEY, val).catch(() => {});
    };

    // Reduced motion
    const REDUCED_MOTION_KEY = "imotara.reduced.motion.v1";
    const [reducedMotion, setReducedMotion] = React.useState(false);
    React.useEffect(() => { AsyncStorage.getItem(REDUCED_MOTION_KEY).then((v) => setReducedMotion(v === "1")).catch(() => {}); }, []);
    const handleReducedMotionToggle = async (val: boolean) => { setReducedMotion(val); await AsyncStorage.setItem(REDUCED_MOTION_KEY, val ? "1" : "0").catch(() => {}); };

    // V-1: Voice max duration
    const VOICE_MAX_DURATION_KEY = "imotara.voice.maxDuration.v1";
    const [voiceMaxDuration, setVoiceMaxDuration] = React.useState(60);
    const VOICE_DURATION_OPTIONS = [30, 60, 120, 300] as const;
    React.useEffect(() => {
        AsyncStorage.getItem(VOICE_MAX_DURATION_KEY).then((v) => {
            const n = parseInt(v ?? "60", 10);
            setVoiceMaxDuration(isFinite(n) ? n : 60);
        }).catch(() => {});
    }, []);
    const handleVoiceDurationChange = async (secs: number) => {
        setVoiceMaxDuration(secs);
        await AsyncStorage.setItem(VOICE_MAX_DURATION_KEY, String(secs)).catch(() => {});
    };
    const voiceDurationLabel = (s: number) => s < 60 ? `${s}s` : `${s / 60} min`;

    // V-2: Recording quality
    const VOICE_QUALITY_KEY = "imotara.voice.quality.v1";
    const [voiceQuality, setVoiceQuality] = React.useState<"high" | "low">("high");
    React.useEffect(() => {
        AsyncStorage.getItem(VOICE_QUALITY_KEY).then((v) => {
            if (v === "low" || v === "high") setVoiceQuality(v);
        }).catch(() => {});
    }, []);
    const handleVoiceQualityChange = async (val: "high" | "low") => {
        setVoiceQuality(val);
        await AsyncStorage.setItem(VOICE_QUALITY_KEY, val).catch(() => {});
    };

    // V-3: Online transcription toggle
    const VOICE_CLOUD_KEY = "imotara.voice.cloudTranscription.v1";
    const [voiceCloudTranscription, setVoiceCloudTranscription] = React.useState(true);
    React.useEffect(() => {
        AsyncStorage.getItem(VOICE_CLOUD_KEY).then((v) => {
            setVoiceCloudTranscription(v !== "0");
        }).catch(() => {});
    }, []);
    const handleVoiceCloudToggle = async (val: boolean) => {
        setVoiceCloudTranscription(val);
        await AsyncStorage.setItem(VOICE_CLOUD_KEY, val ? "1" : "0").catch(() => {});
    };

    // V-4: Voice transcription confirmation
    const HANDSFREE_KEY = "imotara:handsfree.v1";
    const [handsfree, setHandsfree] = React.useState(false);
    React.useEffect(() => {
        AsyncStorage.getItem(HANDSFREE_KEY).then((v) => setHandsfree(v === "1")).catch(() => {});
    }, []);
    const handleHandsfreeToggle = async (val: boolean) => {
        setHandsfree(val);
        await AsyncStorage.setItem(HANDSFREE_KEY, val ? "1" : "0").catch(() => {});
    };

    const VOICE_CONFIRM_KEY = "imotara.voice.confirmTranscription.v1";
    const [voiceConfirm, setVoiceConfirm] = React.useState(false);
    React.useEffect(() => {
        AsyncStorage.getItem(VOICE_CONFIRM_KEY).then((v) => {
            setVoiceConfirm(v === "1");
        }).catch(() => {});
    }, []);
    const handleVoiceConfirmToggle = async (val: boolean) => {
        setVoiceConfirm(val);
        await AsyncStorage.setItem(VOICE_CONFIRM_KEY, val ? "1" : "0").catch(() => {});
    };

    // T-1: TTS rate + pitch
    const TTS_RATE_KEY = "imotara.tts.rate.v1";
    const TTS_PITCH_KEY = "imotara.tts.pitch.v1";
    const [ttsRate, setTtsRate] = React.useState(0.95);
    const [ttsPitch, setTtsPitch] = React.useState(1.0);
    React.useEffect(() => {
        AsyncStorage.getItem(TTS_RATE_KEY).then((v) => {
            const r = parseFloat(v ?? "0.95");
            if (isFinite(r)) setTtsRate(r);
        }).catch(() => {});
        AsyncStorage.getItem(TTS_PITCH_KEY).then((v) => {
            const p = parseFloat(v ?? "1.0");
            if (isFinite(p)) setTtsPitch(p);
        }).catch(() => {});
    }, []);
    const handleTtsRateChange = async (val: number) => {
        const clamped = Math.round(val * 20) / 20; // snap to 0.05 steps
        setTtsRate(clamped);
        await AsyncStorage.setItem(TTS_RATE_KEY, String(clamped)).catch(() => {});
    };
    const handleTtsPitchChange = async (val: number) => {
        const clamped = Math.round(val * 20) / 20;
        setTtsPitch(clamped);
        await AsyncStorage.setItem(TTS_PITCH_KEY, String(clamped)).catch(() => {});
    };

    // M-1: Memory max items
    const MEMORY_MAX_ITEMS_KEY = "imotara.memory.maxItems.v1";
    const [memoryMaxItems, setMemoryMaxItems] = React.useState(12);
    const MEMORY_MAX_OPTIONS = [6, 12, 20, 30] as const;
    React.useEffect(() => {
        AsyncStorage.getItem(MEMORY_MAX_ITEMS_KEY).then((v) => {
            const n = parseInt(v ?? "12", 10);
            setMemoryMaxItems(isFinite(n) ? n : 12);
        }).catch(() => {});
    }, []);
    const handleMemoryMaxItemsChange = async (n: number) => {
        setMemoryMaxItems(n);
        await AsyncStorage.setItem(MEMORY_MAX_ITEMS_KEY, String(n)).catch(() => {});
    };

    // M-3: Online status poll interval
    const STATUS_POLL_KEY = "imotara.status.pollInterval.v1";
    const [statusPollInterval, setStatusPollInterval] = React.useState(15);
    const STATUS_POLL_OPTIONS = [10, 15, 30, 60] as const;
    React.useEffect(() => {
        AsyncStorage.getItem(STATUS_POLL_KEY).then((v) => {
            const n = parseInt(v ?? "15", 10);
            setStatusPollInterval(isFinite(n) ? n : 15);
        }).catch(() => {});
    }, []);
    const handleStatusPollChange = async (secs: number) => {
        setStatusPollInterval(secs);
        await AsyncStorage.setItem(STATUS_POLL_KEY, String(secs)).catch(() => {});
    };

    // Chat behaviour toggles
    const SEARCH_MODE_KEY = "imotara.search.mode.v1";
    const [searchMode, setSearchMode] = React.useState<"fuzzy" | "exact">("fuzzy");
    React.useEffect(() => { AsyncStorage.getItem(SEARCH_MODE_KEY).then((v) => setSearchMode(v === "exact" ? "exact" : "fuzzy")).catch(() => {}); }, []);
    const handleSearchModeToggle = async (val: boolean) => {
        const mode: "fuzzy" | "exact" = val ? "exact" : "fuzzy";
        setSearchMode(mode);
        await AsyncStorage.setItem(SEARCH_MODE_KEY, mode).catch(() => {});
    };

    const GROW_NUDGE_PERM_KEY = "imotara.grow.nudge.perm.v1";
    const [growNudgePerm, setGrowNudgePerm] = React.useState(false);
    React.useEffect(() => {
        AsyncStorage.getItem(GROW_NUDGE_PERM_KEY).then((v) => setGrowNudgePerm(v === "1")).catch(() => {});
    }, []);
    const handleGrowNudgePermToggle = async (val: boolean) => {
        setGrowNudgePerm(val);
        await AsyncStorage.setItem(GROW_NUDGE_PERM_KEY, val ? "1" : "0").catch(() => {});
    };

    const SENTIMENT_CHIPS_KEY = "imotara.sentiment.chips.enabled.v1";
    const [sentimentChipsEnabled, setSentimentChipsEnabled] = React.useState(true);
    React.useEffect(() => {
        AsyncStorage.getItem(SENTIMENT_CHIPS_KEY).then((v) => setSentimentChipsEnabled(v !== "0")).catch(() => {});
    }, []);
    const handleSentimentChipsToggle = async (val: boolean) => {
        setSentimentChipsEnabled(val);
        await AsyncStorage.setItem(SENTIMENT_CHIPS_KEY, val ? "1" : "0").catch(() => {});
    };

    const WEEKLY_RECAP_KEY = "imotara.weekly.recap.enabled.v1";
    const [weeklyRecapEnabled, setWeeklyRecapEnabled] = React.useState(true);
    React.useEffect(() => {
        AsyncStorage.getItem(WEEKLY_RECAP_KEY).then((v) => setWeeklyRecapEnabled(v !== "0")).catch(() => {});
    }, []);
    const handleWeeklyRecapToggle = async (val: boolean) => {
        setWeeklyRecapEnabled(val);
        await AsyncStorage.setItem(WEEKLY_RECAP_KEY, val ? "1" : "0").catch(() => {});
    };

    const MESSAGE_UNDO_KEY = "imotara.undo.enabled.v1";
    const [undoEnabled, setUndoEnabled] = React.useState(true);
    React.useEffect(() => {
        AsyncStorage.getItem(MESSAGE_UNDO_KEY).then((v) => setUndoEnabled(v === "1")).catch(() => {});
    }, []);
    const handleUndoEnabledToggle = async (val: boolean) => {
        setUndoEnabled(val);
        await AsyncStorage.setItem(MESSAGE_UNDO_KEY, val ? "1" : "0").catch(() => {});
    };

    const DAILY_CHECKIN_SHOW_KEY = "imotara.daily.checkin.show.v1";
    const [dailyCheckinShow, setDailyCheckinShow] = React.useState(true);
    React.useEffect(() => { AsyncStorage.getItem(DAILY_CHECKIN_SHOW_KEY).then((v) => setDailyCheckinShow(v !== "0")).catch(() => {}); }, []);
    const handleDailyCheckinShowToggle = async (val: boolean) => { setDailyCheckinShow(val); await AsyncStorage.setItem(DAILY_CHECKIN_SHOW_KEY, val ? "1" : "0").catch(() => {}); };

    const COLLECTIVE_PULSE_SHOW_KEY = "imotara.collective.pulse.show.v1";
    const [collectivePulseShow, setCollectivePulseShow] = React.useState(true);
    React.useEffect(() => { AsyncStorage.getItem(COLLECTIVE_PULSE_SHOW_KEY).then((v) => setCollectivePulseShow(v !== "0")).catch(() => {}); }, []);
    const handleCollectivePulseShowToggle = async (val: boolean) => { setCollectivePulseShow(val); await AsyncStorage.setItem(COLLECTIVE_PULSE_SHOW_KEY, val ? "1" : "0").catch(() => {}); };

    const TONE_REFLECTION_SHOW_KEY = "imotara.tone.reflection.show.v1";
    const [toneReflectionShow, setToneReflectionShow] = React.useState(true);
    React.useEffect(() => { AsyncStorage.getItem(TONE_REFLECTION_SHOW_KEY).then((v) => setToneReflectionShow(v !== "0")).catch(() => {}); }, []);
    const handleToneReflectionShowToggle = async (val: boolean) => { setToneReflectionShow(val); await AsyncStorage.setItem(TONE_REFLECTION_SHOW_KEY, val ? "1" : "0").catch(() => {}); };

    const RETURN_GREETING_SHOW_KEY = "imotara.return.greeting.show.v1";
    const [returnGreetingShow, setReturnGreetingShow] = React.useState(true);
    React.useEffect(() => { AsyncStorage.getItem(RETURN_GREETING_SHOW_KEY).then((v) => setReturnGreetingShow(v !== "0")).catch(() => {}); }, []);
    const handleReturnGreetingShowToggle = async (val: boolean) => { setReturnGreetingShow(val); await AsyncStorage.setItem(RETURN_GREETING_SHOW_KEY, val ? "1" : "0").catch(() => {}); };
    const RETURN_GREETING_HOURS_KEY = "imotara.return.greeting.hours.v1";
    const RETURN_GREETING_HOUR_OPTIONS = [6, 12, 24, 48] as const;
    const [returnGreetingHours, setReturnGreetingHours] = React.useState(24);
    React.useEffect(() => { AsyncStorage.getItem(RETURN_GREETING_HOURS_KEY).then((v) => { const n = parseInt(v ?? "24", 10); if (RETURN_GREETING_HOUR_OPTIONS.includes(n as 6 | 12 | 24 | 48)) setReturnGreetingHours(n); }).catch(() => {}); }, []);
    const handleReturnGreetingHoursChange = async (h: number) => { setReturnGreetingHours(h); await AsyncStorage.setItem(RETURN_GREETING_HOURS_KEY, String(h)).catch(() => {}); };

    const MOOD_GLIMPSE_SHOW_KEY = "imotara.mood.glimpse.show.v1";
    const [moodGlimpseShow, setMoodGlimpseShow] = React.useState(true);
    React.useEffect(() => { AsyncStorage.getItem(MOOD_GLIMPSE_SHOW_KEY).then((v) => setMoodGlimpseShow(v !== "0")).catch(() => {}); }, []);
    const handleMoodGlimpseShowToggle = async (val: boolean) => { setMoodGlimpseShow(val); await AsyncStorage.setItem(MOOD_GLIMPSE_SHOW_KEY, val ? "1" : "0").catch(() => {}); };

    const MILESTONE_SHOW_KEY = "imotara.milestone.show.v1";
    const [milestoneShow, setMilestoneShow] = React.useState(true);
    React.useEffect(() => { AsyncStorage.getItem(MILESTONE_SHOW_KEY).then((v) => setMilestoneShow(v !== "0")).catch(() => {}); }, []);
    const handleMilestoneShowToggle = async (val: boolean) => { setMilestoneShow(val); await AsyncStorage.setItem(MILESTONE_SHOW_KEY, val ? "1" : "0").catch(() => {}); };

    const UNSENT_HINT_SHOW_KEY = "imotara.unsent.hint.show.v1";
    const [unsentHintShow, setUnsentHintShow] = React.useState(true);
    React.useEffect(() => { AsyncStorage.getItem(UNSENT_HINT_SHOW_KEY).then((v) => setUnsentHintShow(v !== "0")).catch(() => {}); }, []);
    const handleUnsentHintShowToggle = async (val: boolean) => { setUnsentHintShow(val); await AsyncStorage.setItem(UNSENT_HINT_SHOW_KEY, val ? "1" : "0").catch(() => {}); };

    const TRIAL_BANNER_SHOW_KEY = "imotara.trial.banner.show.v1";
    const [trialBannerShow, setTrialBannerShow] = React.useState(true);
    React.useEffect(() => { AsyncStorage.getItem(TRIAL_BANNER_SHOW_KEY).then((v) => setTrialBannerShow(v !== "0")).catch(() => {}); }, []);
    const handleTrialBannerShowToggle = async (val: boolean) => { setTrialBannerShow(val); await AsyncStorage.setItem(TRIAL_BANNER_SHOW_KEY, val ? "1" : "0").catch(() => {}); };

    // G-1: Emotional arc cadence
    const ARC_CADENCE_KEY = "imotara.arc.cadenceDays.v1";
    const [arcCadenceDays, setArcCadenceDays] = React.useState(30);
    const CADENCE_OPTIONS = [7, 14, 30, 60] as const;
    React.useEffect(() => {
        AsyncStorage.getItem(ARC_CADENCE_KEY).then((v) => {
            const n = parseInt(v ?? "30", 10);
            setArcCadenceDays(isFinite(n) ? n : 30);
        }).catch(() => {});
    }, []);
    const handleArcCadenceChange = async (days: number) => {
        setArcCadenceDays(days);
        await AsyncStorage.setItem(ARC_CADENCE_KEY, String(days)).catch(() => {});
    };

    // G-2: Companion letter cadence
    const LETTER_CADENCE_KEY = "imotara.letter.cadenceDays.v1";
    const [letterCadenceDays, setLetterCadenceDays] = React.useState(30);
    React.useEffect(() => {
        AsyncStorage.getItem(LETTER_CADENCE_KEY).then((v) => {
            const n = parseInt(v ?? "30", 10);
            setLetterCadenceDays(isFinite(n) ? n : 30);
        }).catch(() => {});
    }, []);
    const handleLetterCadenceChange = async (days: number) => {
        setLetterCadenceDays(days);
        await AsyncStorage.setItem(LETTER_CADENCE_KEY, String(days)).catch(() => {});
    };

    // G-3: Open-loop thresholds
    const OPENLOOP_MIN_THREADS_KEY = "imotara.openloop.minThreads.v1";
    const OPENLOOP_MIN_AGE_KEY = "imotara.openloop.minAgeDays.v1";
    const [openLoopMinThreads, setOpenLoopMinThreads] = React.useState(3);
    const [openLoopMinAgeDays, setOpenLoopMinAgeDays] = React.useState(14);
    const OPENLOOP_THREAD_OPTIONS = [2, 3, 5] as const;
    const OPENLOOP_AGE_OPTIONS = [7, 14, 21, 30] as const;
    React.useEffect(() => {
        AsyncStorage.getItem(OPENLOOP_MIN_THREADS_KEY).then((v) => {
            const n = parseInt(v ?? "3", 10);
            setOpenLoopMinThreads(isFinite(n) ? n : 3);
        }).catch(() => {});
        AsyncStorage.getItem(OPENLOOP_MIN_AGE_KEY).then((v) => {
            const n = parseInt(v ?? "14", 10);
            setOpenLoopMinAgeDays(isFinite(n) ? n : 14);
        }).catch(() => {});
    }, []);
    const handleOpenLoopThreadsChange = async (n: number) => {
        setOpenLoopMinThreads(n);
        await AsyncStorage.setItem(OPENLOOP_MIN_THREADS_KEY, String(n)).catch(() => {});
    };
    const handleOpenLoopAgeChange = async (days: number) => {
        setOpenLoopMinAgeDays(days);
        await AsyncStorage.setItem(OPENLOOP_MIN_AGE_KEY, String(days)).catch(() => {});
    };

    // C-1: Typing indicator speed
    const TYPING_SPEED_KEY = "imotara.typing.speed.v1";
    const [typingSpeed, setTypingSpeed] = React.useState<"slow" | "normal" | "fast">("normal");
    React.useEffect(() => {
        AsyncStorage.getItem(TYPING_SPEED_KEY).then((v) => {
            if (v === "slow" || v === "normal" || v === "fast") setTypingSpeed(v);
        }).catch(() => {});
    }, []);
    const handleTypingSpeedChange = async (val: "slow" | "normal" | "fast") => {
        setTypingSpeed(val);
        await AsyncStorage.setItem(TYPING_SPEED_KEY, val).catch(() => {});
    };

    // U-2: Reaction icon set
    const REACTIONS_SET_KEY = "imotara.reactions.set.v1";
    const [reactionsSet, setReactionsSet] = React.useState<"default" | "minimal" | "extended">("default");
    React.useEffect(() => {
        AsyncStorage.getItem(REACTIONS_SET_KEY).then((v) => {
            if (v === "minimal" || v === "default" || v === "extended") setReactionsSet(v as "default" | "minimal" | "extended");
        }).catch(() => {});
    }, []);
    const handleReactionsSetChange = async (val: "default" | "minimal" | "extended") => {
        setReactionsSet(val);
        await AsyncStorage.setItem(REACTIONS_SET_KEY, val).catch(() => {});
    };

    // P-1: Adult content guard sensitivity
    const CONTENT_GUARD_KEY = "imotara.content.guard.v1";
    const [contentGuard, setContentGuard] = React.useState<"strict" | "standard" | "relaxed">("standard");
    React.useEffect(() => {
        AsyncStorage.getItem(CONTENT_GUARD_KEY).then((v) => {
            if (v === "strict" || v === "standard" || v === "relaxed") setContentGuard(v as "strict" | "standard" | "relaxed");
        }).catch(() => {});
    }, []);
    const handleContentGuardChange = async (val: "strict" | "standard" | "relaxed") => {
        setContentGuard(val);
        await AsyncStorage.setItem(CONTENT_GUARD_KEY, val).catch(() => {});
    };

    // P-2: Crisis detection threshold
    const CRISIS_THRESHOLD_KEY = "imotara.crisis.threshold.v1";
    const [crisisThreshold, setCrisisThreshold] = React.useState<"sensitive" | "standard" | "conservative">("standard");
    React.useEffect(() => {
        AsyncStorage.getItem(CRISIS_THRESHOLD_KEY).then((v) => {
            if (v === "sensitive" || v === "standard" || v === "conservative") setCrisisThreshold(v as "sensitive" | "standard" | "conservative");
        }).catch(() => {});
    }, []);
    const handleCrisisThresholdChange = async (val: "sensitive" | "standard" | "conservative") => {
        setCrisisThreshold(val);
        await AsyncStorage.setItem(CRISIS_THRESHOLD_KEY, val).catch(() => {});
    };

    // P-3: Crisis country override
    const CRISIS_COUNTRY_KEY = "imotara.crisis.country.v1";
    const CRISIS_COUNTRIES = [
        { code: "auto", label: "Auto-detect" },
        { code: "IN", label: "India" }, { code: "US", label: "United States" },
        { code: "GB", label: "United Kingdom" }, { code: "AU", label: "Australia" },
        { code: "CA", label: "Canada" }, { code: "JP", label: "Japan" },
        { code: "KR", label: "South Korea" }, { code: "SG", label: "Singapore" },
        { code: "MY", label: "Malaysia" }, { code: "PH", label: "Philippines" },
        { code: "LK", label: "Sri Lanka" }, { code: "PK", label: "Pakistan" },
        { code: "BD", label: "Bangladesh" }, { code: "NZ", label: "New Zealand" },
        { code: "IE", label: "Ireland" }, { code: "DE", label: "Germany" },
        { code: "FR", label: "France" }, { code: "NL", label: "Netherlands" },
    ];
    const [crisisCountry, setCrisisCountry] = React.useState("auto");
    const [showCrisisCountryModal, setShowCrisisCountryModal] = React.useState(false);
    React.useEffect(() => {
        AsyncStorage.getItem(CRISIS_COUNTRY_KEY).then((v) => { if (v) setCrisisCountry(v); }).catch(() => {});
    }, []);
    const handleCrisisCountryChange = async (code: string) => {
        setCrisisCountry(code);
        setShowCrisisCountryModal(false);
        await AsyncStorage.setItem(CRISIS_COUNTRY_KEY, code).catch(() => {});
    };

    // M-6: API timeout
    const API_TIMEOUT_KEY = "imotara.api.timeout.v1";
    const [apiTimeoutSecs, setApiTimeoutSecs] = React.useState(20);
    const API_TIMEOUT_OPTIONS = [10, 20, 30, 60] as const;
    React.useEffect(() => {
        AsyncStorage.getItem(API_TIMEOUT_KEY).then((v) => {
            const n = parseInt(v ?? "20", 10);
            setApiTimeoutSecs(isFinite(n) ? n : 20);
        }).catch(() => {});
    }, []);
    const handleApiTimeoutChange = async (secs: number) => {
        setApiTimeoutSecs(secs);
        await AsyncStorage.setItem(API_TIMEOUT_KEY, String(secs)).catch(() => {});
    };

    // ─── S-1: Breathing default pattern ─────────────────────────────────────
    const BREATHING_PATTERN_KEY = "imotara.breathing.defaultPattern.v1";
    const BREATHING_PATTERN_LABELS = ["Box (4-4-4-4)", "4-7-8 Calming", "Simple (4-0-6-0)"] as const;
    const [breathingDefaultPattern, setBreathingDefaultPattern] = React.useState(0);
    React.useEffect(() => {
        AsyncStorage.getItem(BREATHING_PATTERN_KEY).then((v) => {
            const n = parseInt(v ?? "0", 10);
            setBreathingDefaultPattern([0, 1, 2].includes(n) ? n : 0);
        }).catch(() => {});
    }, []);
    const handleBreathingPatternChange = async (idx: number) => {
        setBreathingDefaultPattern(idx);
        await AsyncStorage.setItem(BREATHING_PATTERN_KEY, String(idx)).catch(() => {});
    };

    // ─── S-5: Companion memory auto-capture ─────────────────────────────────
    const MEMORY_CAPTURE_KEY = "imotara.memory.capture.enabled.v1";
    const [memoryCaptureEnabled, setMemoryCaptureEnabled] = React.useState(true);
    React.useEffect(() => {
        AsyncStorage.getItem(MEMORY_CAPTURE_KEY).then((v) => setMemoryCaptureEnabled(v !== "0")).catch(() => {});
    }, []);
    const handleMemoryCaptureToggle = async (val: boolean) => {
        setMemoryCaptureEnabled(val);
        await AsyncStorage.setItem(MEMORY_CAPTURE_KEY, val ? "1" : "0").catch(() => {});
    };

    // ─── S-7: TTS auto-read new assistant messages ───────────────────────────
    const TTS_AUTO_READ_KEY = "imotara.tts.autoRead.v1";
    const [ttsAutoRead, setTtsAutoRead] = React.useState(false);
    React.useEffect(() => {
        AsyncStorage.getItem(TTS_AUTO_READ_KEY).then((v) => setTtsAutoRead(v === "1")).catch(() => {});
    }, []);
    const handleTtsAutoReadToggle = async (val: boolean) => {
        setTtsAutoRead(val);
        await AsyncStorage.setItem(TTS_AUTO_READ_KEY, val ? "1" : "0").catch(() => {});
    };

    // ─── S-4: 30-day challenge show/hide ────────────────────────────────────
    const CHALLENGE_SHOW_KEY = "imotara.challenge.show.v1";
    const [challengeShow, setChallengeShow] = React.useState(true);
    React.useEffect(() => {
        AsyncStorage.getItem(CHALLENGE_SHOW_KEY).then((v) => setChallengeShow(v !== "0")).catch(() => {});
    }, []);
    const handleChallengeShowToggle = async (val: boolean) => {
        setChallengeShow(val);
        await AsyncStorage.setItem(CHALLENGE_SHOW_KEY, val ? "1" : "0").catch(() => {});
    };

    // ─── S-8: Reflection journal settings ───────────────────────────────────
    const JOURNAL_SHOW_KEY = "imotara.journal.show.v1";
    const JOURNAL_MAX_KEY = "imotara.journal.maxEntries.v1";
    const JOURNAL_AUTO_DELETE_KEY = "imotara.journal.autoDeleteDays.v1";
    const JOURNAL_MAX_OPTIONS = [50, 100, 200, 0] as const;
    const JOURNAL_DELETE_OPTIONS = [0, 30, 60, 90] as const;
    const [journalShow, setJournalShow] = React.useState(true);
    const [journalMaxEntries, setJournalMaxEntries] = React.useState(100);
    const [journalAutoDeleteDays, setJournalAutoDeleteDays] = React.useState(0);
    React.useEffect(() => {
        AsyncStorage.getItem(JOURNAL_SHOW_KEY).then((v) => setJournalShow(v !== "0")).catch(() => {});
        AsyncStorage.getItem(JOURNAL_MAX_KEY).then((v) => { const n = parseInt(v ?? "100", 10); if (isFinite(n)) setJournalMaxEntries(n); }).catch(() => {});
        AsyncStorage.getItem(JOURNAL_AUTO_DELETE_KEY).then((v) => { const n = parseInt(v ?? "0", 10); if (isFinite(n)) setJournalAutoDeleteDays(n); }).catch(() => {});
    }, []);
    const handleJournalShowToggle = async (val: boolean) => {
        setJournalShow(val);
        await AsyncStorage.setItem(JOURNAL_SHOW_KEY, val ? "1" : "0").catch(() => {});
    };
    const handleJournalMaxChange = async (n: number) => {
        setJournalMaxEntries(n);
        await AsyncStorage.setItem(JOURNAL_MAX_KEY, String(n)).catch(() => {});
    };
    const handleJournalAutoDeleteChange = async (days: number) => {
        setJournalAutoDeleteDays(days);
        await AsyncStorage.setItem(JOURNAL_AUTO_DELETE_KEY, String(days)).catch(() => {});
    };

    // ─── S-3: On This Day show/hide ─────────────────────────────────────────
    const OTD_SHOW_KEY = "imotara.history.otd.show.v1";
    const [otdShow, setOtdShow] = React.useState(true);
    React.useEffect(() => {
        AsyncStorage.getItem(OTD_SHOW_KEY).then((v) => setOtdShow(v !== "0")).catch(() => {});
    }, []);
    const handleOtdShowToggle = async (val: boolean) => {
        setOtdShow(val);
        await AsyncStorage.setItem(OTD_SHOW_KEY, val ? "1" : "0").catch(() => {});
    };

    // ─── S-9: Emotional fingerprint show/hide ────────────────────────────────
    const FINGERPRINT_SHOW_KEY = "imotara.fingerprint.show.v1";
    const [fingerprintShow, setFingerprintShow] = React.useState(true);
    React.useEffect(() => {
        AsyncStorage.getItem(FINGERPRINT_SHOW_KEY).then((v) => setFingerprintShow(v !== "0")).catch(() => {});
    }, []);
    const handleFingerprintShowToggle = async (val: boolean) => {
        setFingerprintShow(val);
        await AsyncStorage.setItem(FINGERPRINT_SHOW_KEY, val ? "1" : "0").catch(() => {});
    };

    // ─── S-6: Chat thread auto-cleanup ──────────────────────────────────────
    const CHAT_CLEANUP_KEY = "imotara.chat.cleanupDays.v1";
    const CHAT_CLEANUP_OPTIONS = [0, 30, 60, 90] as const;
    const [chatCleanupDays, setChatCleanupDays] = React.useState(0);
    React.useEffect(() => {
        AsyncStorage.getItem(CHAT_CLEANUP_KEY).then((v) => { const n = parseInt(v ?? "0", 10); if (isFinite(n)) setChatCleanupDays(n); }).catch(() => {});
    }, []);
    const handleChatCleanupChange = async (days: number) => {
        setChatCleanupDays(days);
        await AsyncStorage.setItem(CHAT_CLEANUP_KEY, String(days)).catch(() => {});
    };

    function toggleSection(setter: React.Dispatch<React.SetStateAction<boolean>>) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setter((v) => !v);
    }

    const [showHowItWorks, setShowHowItWorks] = React.useState(false);

    // Local draft for companion name — allows empty intermediate state while typing.
    // Committed to toneContext on blur so normalization (empty → "Imotara") doesn't
    // fire on every keystroke and prevent the user from clearing the field.
    const [companionNameDraft, setCompanionNameDraft] = React.useState(
        toneContext?.companion?.name ?? ""
    );
    React.useEffect(() => {
        setCompanionNameDraft(toneContext?.companion?.name ?? "");
    }, [toneContext?.companion?.name]);

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

    const handleExportDataCSV = async () => {
        try {
            const header = "id,from,text,emotion,intensity,timestamp,isSynced";
            const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
            const rows = history.map((item: HistoryRecord) =>
                [item.id, item.from, item.text, item.emotion ?? "", item.intensity ?? "", item.timestamp ?? "", item.isSynced ? "true" : "false"]
                    .map(escape).join(",")
            );
            const csv = [header, ...rows].join("\n");
            const fileName = `imotara-export-${new Date().toISOString().slice(0, 10)}.csv`;
            const fileUri = FileSystem.cacheDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Export Imotara data (CSV)" });
            } else {
                Alert.alert("Export unavailable", "Sharing is not available on this device.");
            }
        } catch {
            Alert.alert("Export failed", "Could not export your data. Please try again.");
        }
    };

    const handleClearRemoteData = () => {
        Alert.alert(
            "Clear remote data?",
            "This will delete all your synced conversations from the server. Local data on this device is not affected.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete remote data",
                    style: "destructive",
                    onPress: async () => {
                        if (!accessToken) { Alert.alert("Not signed in", "Sign in to delete remote data."); return; }
                        try {
                            const base = getApiBaseUrl();
                            const res = await fetchWithTimeout(`${base}/api/history`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }, 15_000);
                            if (res.ok) {
                                Alert.alert("Done", "Remote data has been deleted.");
                            } else {
                                Alert.alert("Error", "Could not delete remote data. Please try again.");
                            }
                        } catch {
                            Alert.alert("Error", "Could not reach the server. Please try again.");
                        }
                    },
                },
            ],
        );
    };

    const handleExportJournal = async () => {
        try {
            const raw = await AsyncStorage.getItem("imotara.journal.v1");
            const entries: any[] = raw ? JSON.parse(raw) : [];
            if (entries.length === 0) { Alert.alert("No journal entries", "Write your first journal entry before exporting."); return; }
            const lines = entries.map((e: any) => {
                const date = e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
                return `[${date}] ${e.emotion ? `(${e.emotion}) ` : ""}${e.text ?? ""}`;
            });
            const content = `Imotara Journal Export\nExported: ${new Date().toISOString()}\n${"─".repeat(40)}\n\n${lines.join("\n\n")}`;
            const fileName = `imotara-journal-${new Date().toISOString().slice(0, 10)}.txt`;
            const fileUri = FileSystem.cacheDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(fileUri, { mimeType: "text/plain", dialogTitle: "Export Journal" });
            } else {
                Alert.alert("Export unavailable", "Sharing is not available on this device.");
            }
        } catch {
            Alert.alert("Export failed", "Could not export your journal. Please try again.");
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
                cloudGateReason || "Account backup included with Premium.",
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
                    "Account backup",
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
                "Account backup",
                `Pushed ${result.pushed} item(s) to the backend.\n\nStatus: ${result.status ?? "unknown"
                }`,
                [{ text: "OK" }]
            );
        } catch (error) {
            console.error("Failed to push remote history:", error);
            Alert.alert(
                "Account backup",
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
                cloudGateReason || "Account backup included with Premium.",
                [{ text: "OK" }]
            );
            return;
        }

        // ✅ Never silently no-op
        if (busyRef.current.syncNow) {
            if (mountedRef.current) {
                setLastSyncStatus("Backup in progress…");
            }
            Alert.alert("Sync", "Backup is already in progress. Please wait a moment.", [
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
                    : await (syncFn as any)({ reason: "SettingsScreen: Back up now" });

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

                Alert.alert("Connection issue", `${pushedText}\n\n${mergedText}`, [
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

            Alert.alert("Backup summary", `${pushedText}\n\n${mergedText}`, [
                { text: "OK" },
            ]);
        } catch (error) {
            console.error("handleSyncNow error:", error);
            if (mountedRef.current) {
                setLastSyncAt(Date.now());
                setLastSyncStatus(
                    "Connection issue: Full sync (push + fetch) failed. Please check your connection."
                );
            }
            Alert.alert(
                "Connection issue",
                "Full sync (push + fetch) failed. Please check your connection and try again.",
                [{ text: "OK" }]
            );
        } finally {
            busyRef.current.syncNow = false;
        }
    };

    const handleDonate = async (preset: { id: string; label: string; amount: number }) => {
        if (donatingId) return;
        setDonatingId(preset.id);

        try {
            const base = getApiBaseUrl();
            const donateUrl = `${base}/donate`;
            // Use in-app browser on Android so the user stays in the app context
            // instead of being sent to the system browser.
            await WebBrowser.openBrowserAsync(donateUrl, {
                toolbarColor: "#18181b",
                controlsColor: "#6366f1",
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            });
        } catch {
            Alert.alert("Error", "Could not open donation page. Please try again.", [{ text: "OK" }]);
        } finally {
            setDonatingId(null);
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
        // Step 1: confirm intent
        Alert.alert(
            "Delete Account",
            "This will permanently delete all your data — conversations, memories, and settings. This cannot be undone.\n\nAre you sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete My Account",
                    style: "destructive",
                    onPress: () => {
                        // Step 2: show success confirmation SYNCHRONOUSLY before any async work.
                        // This guarantees the alert is visible regardless of what happens next.
                        Alert.alert(
                            "Data Deleted",
                            "All your conversations, memories, and settings have been permanently deleted.",
                            [{
                                text: "OK",
                                onPress: () => {
                                    // Step 3: perform deletion after user taps OK
                                    clearHistory();
                                    clearMemories().catch(() => {});
                                    if (accessToken) {
                                        const base = getApiBaseUrl();
                                        if (base) {
                                            fetchWithTimeout(`${base}/api/account/delete`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }, 15_000).catch(() => {});
                                        }
                                    }
                                    signOut().catch(() => {});
                                },
                            }]
                        );
                    },
                },
            ]
        );
    };

    const formattedLastSync = lastSyncAt
        ? new Date(lastSyncAt).toLocaleString()
        : "Not synced yet";

    function SettingRow({ label, description, children }: { label: string; description?: string; children?: React.ReactNode }) {
        return (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>{label}</Text>
                    {description ? <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{description}</Text> : null}
                </View>
                {children}
            </View>
        );
    }

    function SettingPillGroup<T extends string>({ options, value, onChange }: { options: readonly { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
        return (
            <View style={{ flexDirection: "row", gap: 10 }}>
                {options.map((opt) => {
                    const active = value === opt.value;
                    return (
                        <TouchableOpacity
                            key={opt.value}
                            onPress={() => onChange(opt.value)}
                            style={{
                                flex: 1, paddingVertical: 10, borderRadius: 12,
                                alignItems: "center", justifyContent: "center", borderWidth: 1.5,
                                minHeight: 44,
                                borderColor: active ? colors.primary : colors.border,
                                backgroundColor: active ? colors.primaryTint : "transparent",
                            }}
                        >
                            <Text style={{ fontSize: 13, color: active ? colors.primary : colors.textSecondary, fontWeight: active ? "700" : "400" }}>
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    }

    function AccordionHeader({ title, open, onPress }: { title: string; open: boolean; onPress: () => void }) {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${title} section, ${open ? "collapse" : "expand"}`}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    paddingHorizontal: 4,
                    marginBottom: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                }}
            >
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>{title}</Text>
                <Ionicons
                    name={open ? "chevron-up-outline" : "chevron-down-outline"}
                    size={18}
                    color={colors.textSecondary}
                />
            </TouchableOpacity>
        );
    }

    // Utility: set auto-sync delay via preset, clamped to 3–60 seconds
    const setDelayPreset = (seconds: number) => {
        const safe = Math.min(Math.max(seconds, 3), 60);
        setAutoSyncDelaySeconds(safe);
    };

    // If store exposes sync state, reflect it in button disabled state too
    const isAnySyncBusy =
        busyRef.current.pushOnly ||
        busyRef.current.syncNow ||
        !!donatingId ||
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
                ref={settingsScrollRef}
                onScroll={e => { scrollOffsetY.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
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
                        marginBottom: 16,
                    }}
                >
                    Imotara Mobile. By default your messages stay on this
                    device. From here you can try early emotion insights and sync
                    options — future versions will add full cloud backup controls and
                    teen safety settings.
                    {"\n\n"}Your messages are never shared publicly — sync only stores a
                    private account backup for you.
                </Text>

                {/* AI-powered settings search */}
                <SettingsSearch onResultSelect={handleSearchSelect} />

                {/* How to use Imotara */}
                <TouchableOpacity
                    onPress={() => setShowHowItWorks(true)}
                    style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 8 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="How to use Imotara"
                >
                    <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
                    <Text style={{ fontSize: 13.5, color: colors.primary }}>How to use Imotara</Text>
                </TouchableOpacity>

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



                {/* ── Plan & support section ── */}
                <View ref={el => { sectionRefs.current["support"] = el; }} collapsable={false}>
                <AccordionHeader title="Your plan" open={sectionSupport} onPress={() => toggleSection(setSectionSupport)} />
                </View>
                {sectionSupport && (
                <View>

                {/* Plan status — current tier + restore button */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                        Current plan:{" "}
                        <Text style={{ fontWeight: "700", color: colors.textPrimary }}>{tierLabel}</Text>
                    </Text>
                    {/* ── Phase 5: org membership badge ─────────────────────── */}
                    {orgName ? (
                        <View style={{ marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={{ fontSize: 11, color: colors.primary }}>🏢</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1 }}>
                                Managed by{" "}
                                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>{orgName}</Text>
                                {orgRole ? <Text style={{ color: colors.textSecondary }}> · {orgRole}</Text> : null}
                            </Text>
                        </View>
                    ) : null}
                    {licenseExpiresAt ? (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                            {new Date(licenseExpiresAt).getTime() > Date.now()
                                ? `Renews ${new Date(licenseExpiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
                                : `Expired ${new Date(licenseExpiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`}
                        </Text>
                    ) : null}
                    {!accessToken ? (
                        <TouchableOpacity
                            onPress={async () => { try { await signInWithGoogle(); } catch { Alert.alert("Sign in failed", "Please try again."); } }}
                            style={{ marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primaryTint, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
                        >
                            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "600", flex: 1 }}>Sign in to restore your plan</Text>
                            <Text style={{ fontSize: 13, color: colors.primary }}>→</Text>
                        </TouchableOpacity>
                    ) : String(licenseTier ?? "FREE").toUpperCase() === "FREE" ? (
                        <TouchableOpacity
                            onPress={async () => {
                                await refreshLicense();
                                try {
                                    const stored = await AsyncStorage.getItem("imotara_license_tier_v1");
                                    if (stored && setLicenseTier) setLicenseTier(stored as any);
                                } catch {}
                                Alert.alert("Plan checked", String(licenseTier ?? "FREE").toUpperCase() !== "FREE" ? "Your plan has been restored!" : "No active plan found for this account.");
                            }}
                            style={{ marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
                        >
                            <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>Already purchased? Tap to check your plan</Text>
                            <Text style={{ fontSize: 13, color: colors.primary }}>↻</Text>
                        </TouchableOpacity>
                    ) : null}
                </AppSurface>

                {/* D2: Apply for organisation plan — visible to all users */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: "600", marginBottom: 4 }}>Organisation plan</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        Deploy Imotara for your company, NGO, school, or healthcare organisation. Manage members, analytics, and bulk licensing.
                    </Text>
                    <TouchableOpacity
                        onPress={() => Linking.openURL("https://imotara.com/org/new")}
                        style={{ alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(99,102,241,0.35)", backgroundColor: "rgba(99,102,241,0.12)" }}
                    >
                        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>Apply for org plan →</Text>
                    </TouchableOpacity>
                </AppSurface>

                {/* Join Imotara Movement */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: "600", marginBottom: 4 }}>🌿 Join Imotara Movement</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        Share your lived experience, empathy, and care to support others as a peer Wellness Companion on Imotara Connect.
                    </Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate("Connect", { startRegister: true })}
                        style={{ alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(52,211,153,0.35)", backgroundColor: "rgba(52,211,153,0.12)" }}
                    >
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#34d399" }}>🤝 As Wellness Companion →</Text>
                    </TouchableOpacity>
                </AppSurface>

                {/* D4: Subscription cancel/manage — visible for paid personal plans */}
                {!orgId && licenseTier && licenseTier !== "FREE" && (
                    <AppSurface style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: "600", marginBottom: 4 }}>Manage subscription</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                            Cancel or modify your subscription through {Platform.OS === "ios" ? "Apple" : "Google Play"} settings.
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                if (Platform.OS === "ios") {
                                    Linking.openURL("itms-apps://subscriptions");
                                } else {
                                    Linking.openURL("https://play.google.com/store/account/subscriptions");
                                }
                            }}
                            style={{ alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft }}
                        >
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                {Platform.OS === "ios" ? "Manage in App Store →" : "Manage in Google Play →"}
                            </Text>
                        </TouchableOpacity>
                    </AppSurface>
                )}

                {/* Upgrade Plan card — hidden when user is on org plan (org manages license) */}
                {!orgId && <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "600", marginBottom: 4 }}>
                        Upgrade your plan
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
                        Unlock unlimited replies, 90-day history, all companion tones, and more.
                    </Text>
                    <TouchableOpacity
                        onPress={() => setShowUpgradeSheet(true)}
                        style={{
                            alignSelf: "flex-start",
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 12,
                            backgroundColor: "rgba(99,102,241,0.2)",
                            borderWidth: 1,
                            borderColor: "rgba(99,102,241,0.4)",
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                            View plans →
                        </Text>
                    </TouchableOpacity>
                </AppSurface>}

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
                            {DONATION_UI_PRESETS.map((p) => {
                                const isBusy = donatingId === p.id;
                                return (
                                <TouchableOpacity
                                    key={p.id}
                                    onPress={() =>
                                        handleDonate({
                                            id: p.id,
                                            label: p.label || formatINRFromPaise(p.amount),
                                            amount: p.amount,
                                        })
                                    }
                                    disabled={!!donatingId}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        minHeight: 40,
                                        borderColor: colors.primary,
                                        backgroundColor: "rgba(56, 189, 248, 0.12)",
                                        marginRight: 8,
                                        marginBottom: 8,
                                        opacity: donatingId && !isBusy ? 0.5 : 1,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 6,
                                    }}
                                >
                                    {isBusy && <ActivityIndicator size="small" color={colors.primary} />}
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>
                                        {p.label}
                                    </Text>
                                </TouchableOpacity>
                                );
                            })}
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

                </View>
                )}

                {/* ── Experience section ── */}
                <View ref={el => { sectionRefs.current["experience"] = el; }} collapsable={false}>
                <AccordionHeader title="Experience" open={sectionAppearance} onPress={() => toggleSection(setSectionAppearance)} />
                </View>
                {sectionAppearance && (
                <View>
                {/* Emotion Insights */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>Emotion Insights</Text>
                        <Switch value={emotionInsightsEnabled} onValueChange={setEmotionInsightsEnabled} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Enables deeper emotional reflections and gentle prompts in chat. Runs locally on your device.</Text>
                </AppSurface>

                {/* Quick panel swipe gestures */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "600", marginBottom: 2 }}>
                        Quick panels
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
                        Swipe gestures in the chat screen that open side panels.
                    </Text>

                    {/* Companion panel toggle */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: "500" }}>
                                Swipe right — Your Companion
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                Swipe left→right in chat to open your companion settings
                            </Text>
                        </View>
                        <Switch
                            value={companionPanelEnabled}
                            onValueChange={setCompanionPanelEnabled}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#ffffff"
                        />
                    </View>

                    {/* Plan & Support panel toggle */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: "500" }}>
                                Swipe left — Plan & Support
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                Swipe right→left in chat to open plan and support
                            </Text>
                        </View>
                        <Switch
                            value={planPanelEnabled}
                            onValueChange={setPlanPanelEnabled}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#ffffff"
                        />
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

                    {/* N-3: Sound + badge toggles */}
                    {reminderEnabled && (
                        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10, gap: 10 }}>
                            <SettingRow label="Play sound" description="Play a sound when the reminder fires">
                                <Switch value={notifSound} onValueChange={handleNotifSoundToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                            </SettingRow>
                            <SettingRow label="Show badge" description="Show a badge on the app icon">
                                <Switch value={notifBadge} onValueChange={handleNotifBadgeToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                            </SettingRow>
                            {/* N-2: Inactivity threshold */}
                            <View>
                                <Text style={{ fontSize: 13, color: colors.textPrimary, marginBottom: 6 }}>Nudge if silent for</Text>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                    {INACTIVITY_OPTIONS.map((h) => (
                                        <TouchableOpacity
                                            key={h}
                                            onPress={() => handleInactivityChange(h)}
                                            style={{
                                                paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40,
                                                borderColor: inactivityHours === h ? colors.primary : colors.border,
                                                backgroundColor: inactivityHours === h ? colors.primaryTint : "transparent",
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, color: inactivityHours === h ? colors.primary : colors.textSecondary }}>
                                                {inactivityLabel(h)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                    )}
                </AppSurface>


                {/* V-1 + V-2 + V-3 + M-1 + M-3: Voice & memory settings */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 14 }}>
                        Voice input
                    </Text>

                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Max recording duration</Text>
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                        {(VOICE_DURATION_OPTIONS as readonly number[]).map((secs) => {
                            const active = voiceMaxDuration === secs;
                            return (
                                <TouchableOpacity
                                    key={secs}
                                    onPress={() => handleVoiceDurationChange(secs)}
                                    style={{
                                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 12, color: active ? colors.primary : colors.textSecondary }}>{voiceDurationLabel(secs)}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Recording quality</Text>
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                        {(["high", "low"] as const).map((val) => {
                            const active = voiceQuality === val;
                            return (
                                <TouchableOpacity
                                    key={val}
                                    onPress={() => handleVoiceQualityChange(val)}
                                    style={{
                                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 12, color: active ? colors.primary : colors.textSecondary }}>
                                        {val === "high" ? "High" : "Low"}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <SettingRow label="Online transcription" description="Send recording to server to convert to text">
                        <Switch value={voiceCloudTranscription} onValueChange={handleVoiceCloudToggle} />
                    </SettingRow>

                    <SettingRow label="Ask before using" description="Show confirmation before inserting voice text into chat">
                        <Switch value={voiceConfirm} onValueChange={handleVoiceConfirmToggle} />
                    </SettingRow>

                    <View style={{ marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: "rgba(124,58,237,0.35)", backgroundColor: "rgba(124,58,237,0.08)", paddingHorizontal: 12, paddingVertical: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flex: 1, marginRight: 12 }}>
                                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>Hands-free conversation</Text>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Speak → Imotara types, replies, and reads aloud automatically</Text>
                            </View>
                            <Switch value={handsfree} onValueChange={handleHandsfreeToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </View>
                    </View>
                </AppSurface>


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

                {/* Accent colour */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 8 }}>
                        Accent colour
                    </Text>
                    <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                        {(Object.entries(ACCENT_COLORS) as [Accent, string][]).map(([key, hex]) => (
                            <TouchableOpacity
                                key={key}
                                onPress={() => setAccent(key)}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: hex,
                                    borderWidth: accent === key ? 3 : 1.5,
                                    borderColor: accent === key ? colors.textPrimary : (isDark ? "transparent" : "rgba(0,0,0,0.15)"),
                                    shadowColor: hex,
                                    shadowOpacity: accent === key ? 0.7 : 0,
                                    shadowRadius: 6,
                                    elevation: accent === key ? 4 : 0,
                                }}
                            />
                        ))}
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 6, textTransform: "capitalize" }}>
                        {accent}
                    </Text>
                </AppSurface>

                {/* Text size */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 8 }}>
                        Text size
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        {(["sm", "md", "lg"] as FontSize[]).map((sz) => {
                            const labels: Record<FontSize, string> = { sm: "S", md: "M", lg: "L" };
                            const active = fontSize === sz;
                            return (
                                <TouchableOpacity
                                    key={sz}
                                    onPress={() => setFontSize(sz)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        borderRadius: 12,
                                        alignItems: "center",
                                        borderWidth: 1.5,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{
                                        fontSize: sz === "sm" ? 13 : sz === "lg" ? 18 : 15,
                                        color: active ? colors.primary : colors.textSecondary,
                                        fontWeight: active ? "700" : "400",
                                    }}>
                                        {labels[sz]}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </AppSurface>

                {/* H-2: Haptic intensity */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 8 }}>
                        Haptic intensity
                    </Text>
                    <SettingPillGroup
                        options={[{ label: "Off", value: "off" }, { label: "Light", value: "light" }, { label: "Strong", value: "strong" }] as const}
                        value={hapticIntensity}
                        onChange={handleHapticIntensityChange}
                    />
                </AppSurface>

                {/* Reduced motion */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <SettingRow label="Reduced motion" description="Disable animations and transitions in the app">
                        <Switch value={reducedMotion} onValueChange={handleReducedMotionToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                    </SettingRow>
                </AppSurface>

                {/* C-1: Typing indicator speed — gated: Plus+ (REPLY_CADENCE) */}
                {replyCadenceGate.enabled ? (
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 8 }}>
                        Typing indicator speed
                    </Text>
                    <SettingPillGroup
                        options={[{ label: "Slow", value: "slow" }, { label: "Normal", value: "normal" }, { label: "Fast", value: "fast" }] as const}
                        value={typingSpeed}
                        onChange={handleTypingSpeedChange}
                    />
                </AppSurface>
                ) : (
                <AppSurface style={{ marginBottom: 16, opacity: 0.5 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>Typing indicator speed</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Available on Plus and above</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Plus+</Text>
                    </View>
                </AppSurface>
                )}

                {/* U-2: Reaction icon set */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Reaction set
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        Icons available when reacting to messages
                    </Text>
                    <SettingPillGroup
                        options={[{ label: "Minimal", value: "minimal" }, { label: "Default", value: "default" }, { label: "Extended", value: "extended" }] as const}
                        value={reactionsSet}
                        onChange={handleReactionsSetChange}
                    />
                </AppSurface>

                {/* Chat behaviour toggles */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "600", marginBottom: 12 }}>
                        Chat behaviour
                    </Text>

                    <SettingRow label="Hide Grow nudge" description="Permanently hide the Grow feature suggestion in Chat">
                        <Switch value={growNudgePerm} onValueChange={handleGrowNudgePermToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                    </SettingRow>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Sentiment seed chips" description="Show quick-tap mood hints above the message input">
                            <Switch value={sentimentChipsEnabled} onValueChange={handleSentimentChipsToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Weekly mood recap" description="Show the weekly mood summary banner in Chat">
                            <Switch value={weeklyRecapEnabled} onValueChange={handleWeeklyRecapToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Message undo (5s)" description="Allow undoing a sent message within 5 seconds of sending">
                            <Switch value={undoEnabled} onValueChange={handleUndoEnabledToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Daily check-in" description="Show the 'How are you right now?' banner once per day">
                            <Switch value={dailyCheckinShow} onValueChange={handleDailyCheckinShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Collective pulse" description="Show anonymous community mood snapshot in Chat">
                            <Switch value={collectivePulseShow} onValueChange={handleCollectivePulseShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Tone reflection card" description="Show session tone summary after 3+ messages">
                            <Switch value={toneReflectionShow} onValueChange={handleToneReflectionShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Return greeting" description="Show a welcome-back card after being away">
                            <Switch value={returnGreetingShow} onValueChange={handleReturnGreetingShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                        {returnGreetingShow && (
                            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>Show after absence of</Text>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                    {RETURN_GREETING_HOUR_OPTIONS.map((h) => (
                                        <TouchableOpacity
                                            key={h}
                                            onPress={() => handleReturnGreetingHoursChange(h)}
                                            style={{
                                                paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
                                                borderWidth: 1.5, minHeight: 40,
                                                borderColor: returnGreetingHours === h ? colors.primary : colors.border,
                                                backgroundColor: returnGreetingHours === h ? colors.primaryTint : "transparent",
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, color: returnGreetingHours === h ? colors.primary : colors.textSecondary }}>
                                                {h === 24 ? "24 h" : h === 48 ? "48 h" : `${h} h`}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Mood glimpse" description="Show latest detected mood at the top of Chat">
                            <Switch value={moodGlimpseShow} onValueChange={handleMoodGlimpseShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Milestone celebration" description="Show a card when you resolve a recurring emotional theme">
                            <Switch value={milestoneShow} onValueChange={handleMilestoneShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Unsent Letter hint" description="Show contextual hint to try the Unsent Letter feature">
                            <Switch value={unsentHintShow} onValueChange={handleUnsentHintShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Trial countdown banner" description="Show remaining trial days banner in Chat">
                            <Switch value={trialBannerShow} onValueChange={handleTrialBannerShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    {/* Search mode — gated: Plus+ (SEARCH_MODE) */}
                    {searchModeGate.enabled ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Exact history search" description="Match the exact phrase instead of individual words">
                            <Switch value={searchMode === "exact"} onValueChange={handleSearchModeToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>
                    ) : (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8, opacity: 0.5 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, color: colors.textPrimary }}>Exact history search</Text>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Available on Plus and above</Text>
                            </View>
                            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Plus+</Text>
                        </View>
                    </View>
                    )}

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Companion memory auto-capture" description="Automatically save key facts from conversations to companion memory">
                            <Switch value={memoryCaptureEnabled} onValueChange={handleMemoryCaptureToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Auto-read assistant replies" description="Automatically read out new assistant messages using text-to-speech">
                            <Switch value={ttsAutoRead} onValueChange={handleTtsAutoReadToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>
                </AppSurface>

                {/* Grow & Wellbeing */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "600", marginBottom: 12 }}>
                        Grow &amp; Wellbeing
                    </Text>

                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>Default breathing pattern</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                        {BREATHING_PATTERN_LABELS.map((label, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => handleBreathingPatternChange(idx)}
                                style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40, borderColor: breathingDefaultPattern === idx ? colors.primary : colors.border, backgroundColor: breathingDefaultPattern === idx ? colors.primaryTint : "transparent" }}
                            >
                                <Text style={{ fontSize: 12, color: breathingDefaultPattern === idx ? colors.primary : colors.textSecondary }}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
                        <SettingRow label="30-day challenge widget" description="Show the 30-day emotional wellness challenge on the Grow screen">
                            <Switch value={challengeShow} onValueChange={handleChallengeShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Reflection journal" description="Show the reflection journal section on the Grow screen">
                            <Switch value={journalShow} onValueChange={handleJournalShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                        {journalShow && (
                            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>Max journal entries</Text>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                                    {(JOURNAL_MAX_OPTIONS as readonly number[]).map((n) => (
                                        <TouchableOpacity key={n} onPress={() => handleJournalMaxChange(n)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40, borderColor: journalMaxEntries === n ? colors.primary : colors.border, backgroundColor: journalMaxEntries === n ? colors.primaryTint : "transparent" }}>
                                            <Text style={{ fontSize: 12, color: journalMaxEntries === n ? colors.primary : colors.textSecondary }}>{n === 0 ? "Unlimited" : String(n)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>Auto-delete entries after</Text>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                    {(JOURNAL_DELETE_OPTIONS as readonly number[]).map((d) => (
                                        <TouchableOpacity key={d} onPress={() => handleJournalAutoDeleteChange(d)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40, borderColor: journalAutoDeleteDays === d ? colors.primary : colors.border, backgroundColor: journalAutoDeleteDays === d ? colors.primaryTint : "transparent" }}>
                                            <Text style={{ fontSize: 12, color: journalAutoDeleteDays === d ? colors.primary : colors.textSecondary }}>{d === 0 ? "Never" : `${d} days`}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="On This Day card" description="Show past entries from this date in history">
                            <Switch value={otdShow} onValueChange={handleOtdShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                        <SettingRow label="Emotional fingerprint" description="Show your unique emotional pattern analysis in Trends">
                            <Switch value={fingerprintShow} onValueChange={handleFingerprintShowToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>
                </AppSurface>

                </View>
                )}

                {/* ── Your companion section ── */}
                <View ref={el => { sectionRefs.current["companion"] = el; }} collapsable={false}>
                <AccordionHeader title="Your companion" open={sectionCompanion} onPress={() => toggleSection(setSectionCompanion)} />
                </View>
                {sectionCompanion && (
                <View>

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
                                                avatarAge: AGE_RANGE_TO_AVATAR[opt.id] ?? 26,
                                            },
                                        })
                                    }
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
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
                                        paddingHorizontal: 14,
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
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
                                const name = toneContext?.user?.name?.trim();
                                setVoicePreviewId(id);
                                speakPreview(gender, lang, name, () => setVoicePreviewId(null));
                            }
                        }}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}
                    >
                        <Text style={{ fontSize: 12, color: colors.primary }}>
                            {voicePreviewId === "settings-user-preview" ? "⏹ Stop preview" : "🔊 Preview voice"}
                        </Text>
                    </TouchableOpacity>

                    {/* Avatar appearance */}
                    <AvatarSlider
                        gender={toneContext?.user?.gender}
                        ageValue={toneContext?.user?.avatarAge ?? 26}
                        onChange={(age) =>
                            setToneContext({
                                ...(toneContext || {}),
                                user: { ...(toneContext?.user || {}), avatarAge: age },
                            })
                        }
                        name={toneContext?.user?.name?.trim() || undefined}
                        colors={colors}
                    />

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
                                        paddingHorizontal: 14,
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
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
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#ffffff"
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
                        value={companionNameDraft}
                        onChangeText={setCompanionNameDraft}
                        onBlur={() =>
                            setToneContext({
                                ...(toneContext || {}),
                                companion: { ...(toneContext?.companion || {}), name: companionNameDraft },
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
                                        paddingHorizontal: 14,
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
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
                                                avatarAge: AGE_RANGE_TO_AVATAR[opt.id] ?? 26,
                                            },
                                        })
                                    }
                                    disabled={!toneContext?.companion?.enabled}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
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
                                        paddingHorizontal: 14,
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
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

                    {/* Companion voice preview */}
                    <TouchableOpacity
                        onPress={() => {
                            const id = "settings-comp-preview";
                            if (voicePreviewId === id) {
                                stopSpeaking();
                                setVoicePreviewId(null);
                            } else {
                                const gender = toneContext?.companion?.gender;
                                const lang = toneContext?.user?.preferredLang ?? "en";
                                const name = toneContext?.companion?.name?.trim();
                                setVoicePreviewId(id);
                                speakPreview(gender, lang, name, () => setVoicePreviewId(null));
                            }
                        }}
                        disabled={!toneContext?.companion?.enabled}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 14,
                            opacity: toneContext?.companion?.enabled ? 1 : 0.4,
                        }}
                    >
                        <Text style={{ fontSize: 12, color: colors.primary }}>
                            {voicePreviewId === "settings-comp-preview" ? "⏹ Stop preview" : "🔊 Preview companion voice"}
                        </Text>
                    </TouchableOpacity>

                    {/* T-1: TTS speed + pitch — gated: Plus+ (TTS_ADVANCED) */}
                    {ttsAdvancedGate.enabled ? (
                    <View style={{ marginBottom: 14 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Voice speed</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{ttsRate.toFixed(2)}×</Text>
                        </View>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {([0.5, 0.75, 0.95, 1.1, 1.25, 1.5] as const).map((v) => (
                                <TouchableOpacity
                                    key={v}
                                    onPress={() => handleTtsRateChange(v)}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        minHeight: 44,
                                        borderColor: Math.abs(ttsRate - v) < 0.01 ? colors.primary : colors.border,
                                        backgroundColor: Math.abs(ttsRate - v) < 0.01 ? colors.primaryTint : "transparent",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text style={{ fontSize: 12, color: Math.abs(ttsRate - v) < 0.01 ? colors.primary : colors.textSecondary }}>
                                        {v}×
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Voice pitch</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{ttsPitch.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {([0.75, 0.9, 1.0, 1.1, 1.25] as const).map((v) => (
                                <TouchableOpacity
                                    key={v}
                                    onPress={() => handleTtsPitchChange(v)}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        minHeight: 44,
                                        borderColor: Math.abs(ttsPitch - v) < 0.01 ? colors.primary : colors.border,
                                        backgroundColor: Math.abs(ttsPitch - v) < 0.01 ? colors.primaryTint : "transparent",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text style={{ fontSize: 12, color: Math.abs(ttsPitch - v) < 0.01 ? colors.primary : colors.textSecondary }}>
                                        {v}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    ) : (
                    <View style={{ marginBottom: 14, opacity: 0.5, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: "500" }}>Voice speed &amp; pitch</Text>
                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{!ttsAdvancedGate.enabled ? ttsAdvancedGate.reason : ""}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Plus+</Text>
                    </View>
                    )}

                    {/* Avatar appearance */}
                    <AvatarSlider
                        gender={toneContext?.companion?.gender}
                        ageValue={toneContext?.companion?.avatarAge ?? 26}
                        onChange={(age) =>
                            setToneContext({
                                ...(toneContext || {}),
                                companion: { ...(toneContext?.companion || {}), avatarAge: age },
                            })
                        }
                        name={toneContext?.companion?.name?.trim() || undefined}
                        enabled={toneContext?.companion?.enabled ?? false}
                        colors={colors}
                    />

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
                                        paddingHorizontal: 14,
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
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

                {/* G-1: Emotional arc cadence — gated: Pro+ (GROWTH_ARC) */}
                {growthArcGate.enabled ? (
                <AppSurface style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>
                            Emotional arc cadence
                        </Text>
                        {!growthArcGate.enabled && (
                            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Pro+</Text>
                        )}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        How often your emotional journey narrative is generated
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                        {(CADENCE_OPTIONS as readonly number[]).map((days) => {
                            const active = arcCadenceDays === days;
                            const label = days === 7 ? "1 week" : days === 14 ? "2 weeks" : days === 30 ? "Monthly" : "2 months";
                            return (
                                <TouchableOpacity
                                    key={days}
                                    onPress={() => handleArcCadenceChange(days)}
                                    style={{
                                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 12, color: active ? colors.primary : colors.textSecondary }}>{label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </AppSurface>
                ) : (
                <AppSurface style={{ marginBottom: 16, opacity: 0.5 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>Emotional arc cadence</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{!growthArcGate.enabled ? growthArcGate.reason : ""}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Pro+</Text>
                    </View>
                </AppSurface>
                )}

                {/* G-2: Companion letter cadence — gated: Pro+ (COMPANION_LETTER) */}
                {companionLetterGate.enabled ? (
                <AppSurface style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>
                            Companion letter cadence
                        </Text>
                        {!companionLetterGate.enabled && (
                            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Pro+</Text>
                        )}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        How often your companion writes you a personal letter
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                        {(CADENCE_OPTIONS as readonly number[]).map((days) => {
                            const active = letterCadenceDays === days;
                            const label = days === 7 ? "1 week" : days === 14 ? "2 weeks" : days === 30 ? "Monthly" : "2 months";
                            return (
                                <TouchableOpacity
                                    key={days}
                                    onPress={() => handleLetterCadenceChange(days)}
                                    style={{
                                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 12, color: active ? colors.primary : colors.textSecondary }}>{label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </AppSurface>
                ) : (
                <AppSurface style={{ marginBottom: 16, opacity: 0.5 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>Companion letter cadence</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{!companionLetterGate.enabled ? companionLetterGate.reason : ""}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Pro+</Text>
                    </View>
                </AppSurface>
                )}

                {/* G-3: Open-loop thresholds */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Open-loop detection
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        Minimum conversations before a recurring theme is surfaced
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Conversations</Text>
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                        {(OPENLOOP_THREAD_OPTIONS as readonly number[]).map((n) => {
                            const active = openLoopMinThreads === n;
                            return (
                                <TouchableOpacity
                                    key={n}
                                    onPress={() => handleOpenLoopThreadsChange(n)}
                                    style={{
                                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 12, color: active ? colors.primary : colors.textSecondary }}>{n}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Minimum age</Text>
                    <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                        {(OPENLOOP_AGE_OPTIONS as readonly number[]).map((days) => {
                            const active = openLoopMinAgeDays === days;
                            const label = days === 7 ? "7 days" : days === 14 ? "14 days" : days === 21 ? "21 days" : "30 days";
                            return (
                                <TouchableOpacity
                                    key={days}
                                    onPress={() => handleOpenLoopAgeChange(days)}
                                    style={{
                                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 12, color: active ? colors.primary : colors.textSecondary }}>{label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </AppSurface>


                {/* M-1: Memory max items */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Memory limit
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        Maximum number of facts your companion remembers about you
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        {(MEMORY_MAX_OPTIONS as readonly number[]).map((n) => {
                            const active = memoryMaxItems === n;
                            return (
                                <TouchableOpacity
                                    key={n}
                                    onPress={() => handleMemoryMaxItemsChange(n)}
                                    style={{
                                        flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", borderWidth: 1.5,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 13, color: active ? colors.primary : colors.textSecondary, fontWeight: active ? "700" : "400" }}>{n}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </AppSurface>

                </View>
                )}

                {/* ── Privacy & safety section ── */}
                <View ref={el => { sectionRefs.current["privacy"] = el; }} collapsable={false}>
                <AccordionHeader title="Privacy & safety" open={sectionPrivacy} onPress={() => toggleSection(setSectionPrivacy)} />
                </View>
                {sectionPrivacy && (
                <View>

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
                                { id: "cloud", label: "Online" },
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
                                                "Online mode unavailable",
                                                cloudGateReason || "Online mode available with Premium."
                                            );
                                            return;
                                        }
                                        setAnalysisMode(opt.id);
                                    }}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        minHeight: 40,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
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
                        When cloud is used, your message text is sent to Imotara's servers to generate a reply. No account info, device ID, or personal data is attached. Local mode keeps everything on-device — nothing is sent externally.
                    </Text>

                    {!canCloudSync ? (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
                            Cloud is currently unavailable:{" "}
                            {cloudGateReason || "Online mode available with Premium."}
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


                {/* A-5: Data on this device summary */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 8 }}>
                        Data on this device
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
                        {[
                            { label: "Chat messages", value: messageCount },
                            { label: "Emotion entries", value: storageSummary?.emotionCount ?? "—" },
                            { label: "Storage used", value: storageSummary ? `~${storageSummary.totalKB} KB` : "—" },
                        ].map((item) => (
                            <View
                                key={item.label}
                                style={{
                                    flex: 1,
                                    minWidth: 90,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    backgroundColor: colors.surfaceSoft,
                                    paddingHorizontal: 10,
                                    paddingVertical: 8,
                                    alignItems: "center",
                                }}
                            >
                                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>
                                    {item.value}
                                </Text>
                                <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: "center" }}>
                                    {item.label}
                                </Text>
                            </View>
                        ))}
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        Stored only on this device unless you sync.
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

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                        <AppButton
                            title="Export JSON"
                            onPress={handleExportData}
                            style={{ alignSelf: "flex-start", borderRadius: 999 }}
                        />
                        <AppButton
                            title="Export CSV"
                            onPress={handleExportDataCSV}
                            style={{ alignSelf: "flex-start", borderRadius: 999 }}
                        />
                        <AppButton
                            title="Export Journal"
                            onPress={handleExportJournal}
                            style={{ alignSelf: "flex-start", borderRadius: 999 }}
                        />
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <AppButton
                            title="Clear Local History"
                            onPress={handleClearHistory}
                            variant="destructive"
                            style={{ alignSelf: "flex-start", borderRadius: 999 }}
                        />
                        <AppButton
                            title="Clear Remote Data"
                            onPress={handleClearRemoteData}
                            variant="destructive"
                            style={{ alignSelf: "flex-start", borderRadius: 999 }}
                        />
                    </View>

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
                                    paddingVertical: 9,
                                    borderRadius: 12,
                                    borderWidth: 1.5, minHeight: 40,
                                    borderColor: colors.border,
                                    backgroundColor: "transparent",
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
                        sync them to your account after a short delay. This keeps your
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
                                        paddingVertical: 9,
                                        borderRadius: 12,
                                        borderWidth: 1.5, minHeight: 40,
                                        borderColor: isActive
                                            ? colors.primary
                                            : colors.border,
                                        backgroundColor: isActive
                                            ? colors.primaryTint
                                            : "transparent",
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
                                        : "Save history to account"
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
                                : "Back up now (push + fetch)"
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
                                    "Account backup included with Premium."}
                            </Text>
                        )}
                    </View>
                </AppSurface>

                {/* P-1: Adult content guard */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Content safety sensitivity
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        How strictly explicit content is filtered. Strict catches more edge cases; Relaxed reduces false positives on mature topics.
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        {(["strict", "standard", "relaxed"] as const).map((val) => {
                            const active = contentGuard === val;
                            const labels = { strict: "Strict", standard: "Standard", relaxed: "Relaxed" };
                            return (
                                <TouchableOpacity
                                    key={val}
                                    onPress={() => handleContentGuardChange(val)}
                                    style={{
                                        flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", borderWidth: 1.5,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 13, color: active ? colors.primary : colors.textSecondary, fontWeight: active ? "700" : "400" }}>
                                        {labels[val]}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </AppSurface>

                {/* P-2: Crisis detection threshold */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Crisis detection sensitivity
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        How quickly crisis signals trigger the safety response. Sensitive catches more; Conservative reduces alerts on metaphorical language.
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        {(["sensitive", "standard", "conservative"] as const).map((val) => {
                            const active = crisisThreshold === val;
                            const labels = { sensitive: "Sensitive", standard: "Standard", conservative: "Conservative" };
                            return (
                                <TouchableOpacity
                                    key={val}
                                    onPress={() => handleCrisisThresholdChange(val)}
                                    style={{
                                        flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", borderWidth: 1.5,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 12, color: active ? colors.primary : colors.textSecondary, fontWeight: active ? "700" : "400" }}>
                                        {labels[val]}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </AppSurface>

                {/* P-3: Crisis country override */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Crisis resources country
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        Override the country used for crisis helpline resources. Default auto-detects from your device locale.
                    </Text>
                    <TouchableOpacity
                        onPress={() => setShowCrisisCountryModal(true)}
                        style={{
                            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                            borderRadius: 12, borderWidth: 1, borderColor: colors.border,
                            backgroundColor: colors.surfaceSoft, paddingHorizontal: 14, paddingVertical: 10,
                        }}
                    >
                        <Text style={{ fontSize: 13, color: colors.textPrimary }}>
                            {CRISIS_COUNTRIES.find((c) => c.code === crisisCountry)?.label ?? "Auto-detect"}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>›</Text>
                    </TouchableOpacity>
                    <Modal
                        visible={showCrisisCountryModal}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setShowCrisisCountryModal(false)}
                    >
                        <TouchableOpacity
                            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
                            activeOpacity={1}
                            onPress={() => setShowCrisisCountryModal(false)}
                        >
                            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                                <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 32, maxHeight: 480 }}>
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, textAlign: "center", marginBottom: 12, paddingHorizontal: 16 }}>
                                        Select country for crisis resources
                                    </Text>
                                    <ScrollView showsVerticalScrollIndicator={false}>
                                        {CRISIS_COUNTRIES.map((c) => {
                                            const active = crisisCountry === c.code;
                                            return (
                                                <TouchableOpacity
                                                    key={c.code}
                                                    onPress={() => handleCrisisCountryChange(c.code)}
                                                    style={{
                                                        paddingVertical: 14, paddingHorizontal: 20,
                                                        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                                                        borderBottomWidth: 0.5, borderBottomColor: colors.border,
                                                        backgroundColor: active ? `${colors.primary}18` : "transparent",
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 14, color: active ? colors.primary : colors.textPrimary, fontWeight: active ? "600" : "400" }}>
                                                        {c.label}
                                                    </Text>
                                                    {active && <Text style={{ fontSize: 16, color: colors.primary }}>✓</Text>}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </Modal>
                </AppSurface>

                </View>
                )}

                {/* ── Mindset Analysis section ── */}
                <View ref={el => { sectionRefs.current["mindset"] = el; }} collapsable={false}>
                <AccordionHeader title="Mindset Analysis" open={sectionMindset} onPress={() => toggleSection(setSectionMindset)} />
                </View>
                {sectionMindset && (
                <View>
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Mindset Analysis
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>
                        Choose which time windows appear as psychological summaries on your History page.
                    </Text>
                    {([
                        { key: "today",   label: "Today's mindset analysis",      desc: "A psychological snapshot of today's conversations." },
                        { key: "week7",   label: "Last 7 days mindset analysis",  desc: "A 7-day emotional pattern overview." },
                        { key: "days30",  label: "Last 30 days mindset analysis", desc: "A 30-day mood trend summary." },
                        { key: "allTime", label: "All time mindset analysis",     desc: "A complete overview since you started." },
                    ] as { key: keyof MindsetPrefs; label: string; desc: string }[]).map(({ key, label, desc }, idx, arr) => (
                        <View
                            key={key}
                            style={{
                                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                                paddingVertical: 12,
                                borderTopWidth: idx === 0 ? 0 : 0.5,
                                borderTopColor: "rgba(255,255,255,0.08)",
                            }}
                        >
                            <View style={{ flex: 1, marginRight: 12 }}>
                                <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: "500" }}>{label}</Text>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{desc}</Text>
                            </View>
                            <Switch
                                value={mindsetPrefs[key]}
                                onValueChange={() => handleMindsetToggle(key)}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor="#ffffff"
                            />
                        </View>
                    ))}

                    <View style={{ borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)", marginTop: 8, paddingTop: 12 }}>
                        <SettingRow label="30-day mood chart" description="Show the 30-day mood trend chart on Trends tab">
                            <Switch value={moodChartEnabled} onValueChange={handleMoodChartToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#ffffff" />
                        </SettingRow>
                    </View>
                </AppSurface>
                </View>
                )}

                {/* ── Advanced section ── */}
                <View ref={el => { sectionRefs.current["advanced"] = el; }} collapsable={false}>
                <AccordionHeader title="Advanced" open={sectionAdvancedMobile} onPress={() => toggleSection(setSectionAdvancedMobile)} />
                </View>
                {sectionAdvancedMobile && (
                <View>

                {/* Emotional fingerprint */}
                {fingerprintShow && emotionalFingerprint && (
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
                                returnKeyType="default"
                                maxLength={MEMORY_MAX_LENGTH}
                                onFocus={() => setMemoryInputFocused(true)}
                                onBlur={() => setMemoryInputFocused(false)}
                                style={{ fontSize: 12, color: colors.textPrimary, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, minHeight: 40 }}
                            />
                            {(memoryInputFocused || newMemoryText.length > MEMORY_MAX_LENGTH * 0.8) && (
                                <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: "right", marginTop: -2 }}>
                                    {newMemoryText.length}/{MEMORY_MAX_LENGTH}
                                </Text>
                            )}
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
                                        returnKeyType="default"
                                        maxLength={MEMORY_MAX_LENGTH}
                                        onFocus={() => setEditMemoryInputFocused(true)}
                                        onBlur={() => setEditMemoryInputFocused(false)}
                                        style={{ fontSize: 12, color: colors.textPrimary, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, minHeight: 40 }}
                                    />
                                    {(editMemoryInputFocused || editingMemoryText.length > MEMORY_MAX_LENGTH * 0.8) && (
                                        <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: "right", marginTop: -2 }}>
                                            {editingMemoryText.length}/{MEMORY_MAX_LENGTH}
                                        </Text>
                                    )}
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


                {/* Teen Insights Mode card */}
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
                            Teen Insights Mode
                        </Text>
                        <Switch
                            value={teenMode}
                            onValueChange={setTeenMode}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#ffffff"
                        />
                    </View>

                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.textSecondary,
                            marginBottom: 4,
                        }}
                    >
                        Shows age-appropriate reflections with peer-supportive language and enhanced safety filters.
                    </Text>
                </AppSurface>

                {/* Child-safe mode — gated: Family/EDU/Enterprise */}
                <AppSurface style={{ marginBottom: 16, opacity: childSafeModeGate.enabled ? 1 : 0.6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>
                            Child-safe Mode
                        </Text>
                        <Switch
                            value={childSafeMode && childSafeModeGate.enabled}
                            onValueChange={(v) => { if (childSafeModeGate.enabled) setChildSafeMode(v); }}
                            trackColor={{ false: colors.border, true: "#10b981" }}
                            thumbColor="#ffffff"
                            disabled={!childSafeModeGate.enabled}
                        />
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
                        Applies strict content filters — removes adult themes, violence, and scary content from all reflections.
                    </Text>
                    {!childSafeModeGate.enabled && (
                        <Text style={{ fontSize: 11, color: "#fbbf24", marginTop: 2 }}>
                            {childSafeModeGate.reason ?? "Requires Family, EDU, or Enterprise plan."}
                        </Text>
                    )}
                </AppSurface>

                {/* Family Profiles — gated: Family plan */}
                <AppSurface style={{ marginBottom: 16, opacity: multiProfileGate.enabled ? 1 : 0.6 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Family Profiles
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
                        {multiProfileGate.enabled
                            ? "Manage separate profiles for each family member. Coming soon — full profile switcher with per-profile history."
                            : (multiProfileGate.reason ?? "Upgrade to the Family plan to create separate profiles for each family member.")}
                    </Text>
                </AppSurface>

                {/* NF-3: Family Snapshot card */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Family Snapshot
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
                        Share a private link showing your week&apos;s emotional tone with family. Encoded locally — nothing is sent to a server.
                    </Text>
                    <TouchableOpacity
                        onPress={shareFamilySnapshot}
                        style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "rgba(16,185,129,0.35)", backgroundColor: "rgba(16,185,129,0.1)" }}
                    >
                        <Ionicons name="share-outline" size={15} color="#6ee7b7" />
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#6ee7b7" }}>Share my snapshot</Text>
                    </TouchableOpacity>
                    {familySnapUrl && (
                        <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 8 }} numberOfLines={2}>
                            {familySnapUrl}
                        </Text>
                    )}
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
                                    paddingVertical: 9,
                                    borderRadius: 12,
                                    borderWidth: 1.5, minHeight: 40,
                                    borderColor: feedbackType === t ? colors.primary : colors.border,
                                    backgroundColor: feedbackType === t ? colors.primaryTint : "transparent",
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
                        returnKeyType="default"
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

                {/* O-1: Feature discovery reset */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>Feature discovery cards</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>Cards that introduce Trends, Offline mode, Companion, and more. Reset to see them again.</Text>
                    <TouchableOpacity
                        onPress={handleDiscoveryReset}
                        style={{ alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textPrimary }}>Reset discovery cards</Text>
                    </TouchableOpacity>
                    {discoveryResetMsg && (
                        <Text style={{ fontSize: 12, color: colors.primary, marginTop: 8 }}>{discoveryResetMsg}</Text>
                    )}
                </AppSurface>

                {/* C-3: Show timestamps toggle */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>Show message timestamps</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Display time sent on each chat bubble</Text>
                        </View>
                        <Switch
                            value={showChatTimestamps}
                            onValueChange={handleShowTimestampsToggle}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#ffffff"
                        />
                    </View>
                </AppSurface>

                {/* Companion emoji reactions toggle */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>Companion reactions</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Your companion reacts to your messages with mood-relevant emoji ❤️ 🌟 🤗</Text>
                        </View>
                        <Switch
                            value={companionReactionsEnabled}
                            onValueChange={setCompanionReactionsEnabled}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#ffffff"
                        />
                    </View>
                </AppSurface>

                {/* Sync status badge toggle */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>Show sync status</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Show reply source on messages</Text>
                        </View>
                        <Switch
                            value={showSyncBadge}
                            onValueChange={setShowSyncBadge}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#ffffff"
                        />
                    </View>
                </AppSurface>

                {/* Feature discovery tips toggle */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500" }}>Feature tips</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Show one feature tip per hour in the Trends tab to discover what Imotara can do</Text>
                        </View>
                        <Switch
                            value={featureTipsEnabled}
                            onValueChange={setFeatureTipsEnabled}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#ffffff"
                        />
                    </View>
                </AppSurface>

                {/* M-2: Auto-cleanup history */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>Auto-delete old history</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>Automatically remove emotion records older than:</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {AUTO_CLEANUP_OPTIONS.map((d) => (
                            <TouchableOpacity
                                key={d}
                                onPress={() => handleAutoCleanupChange(d)}
                                style={{
                                    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40,
                                    borderColor: autoCleanupDays === d ? colors.primary : colors.border,
                                    backgroundColor: autoCleanupDays === d ? colors.primaryTint : "transparent",
                                }}
                            >
                                <Text style={{ fontSize: 12, color: autoCleanupDays === d ? colors.primary : colors.textSecondary }}>
                                    {d === 0 ? "Never" : `${d} days`}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </AppSurface>

                {/* S-6: Chat thread auto-cleanup */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>Auto-delete old chat threads</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>Automatically remove chat threads older than:</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {(CHAT_CLEANUP_OPTIONS as readonly number[]).map((d) => (
                            <TouchableOpacity
                                key={d}
                                onPress={() => handleChatCleanupChange(d)}
                                style={{
                                    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, minHeight: 40,
                                    borderColor: chatCleanupDays === d ? colors.primary : colors.border,
                                    backgroundColor: chatCleanupDays === d ? colors.primaryTint : "transparent",
                                }}
                            >
                                <Text style={{ fontSize: 12, color: chatCleanupDays === d ? colors.primary : colors.textSecondary }}>
                                    {d === 0 ? "Never" : `${d} days`}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </AppSurface>

                {/* O-2: Restart onboarding */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>Restart onboarding</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>Show the onboarding walkthrough again next time you open Imotara. Your data is not affected.</Text>
                    <TouchableOpacity
                        onPress={handleRestartOnboarding}
                        style={{ alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textPrimary }}>Restart onboarding</Text>
                    </TouchableOpacity>
                    {onboardingResetMsg && (
                        <Text style={{ fontSize: 12, color: colors.primary, marginTop: 8 }}>{onboardingResetMsg}</Text>
                    )}
                </AppSurface>


                {/* M-3: Online status poll interval */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Connectivity check interval
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        How often the app checks for an active connection. Lower = faster detection, higher = less battery use.
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        {(STATUS_POLL_OPTIONS as readonly number[]).map((secs) => {
                            const active = statusPollInterval === secs;
                            const label = secs < 60 ? `${secs}s` : "60s";
                            return (
                                <TouchableOpacity
                                    key={secs}
                                    onPress={() => handleStatusPollChange(secs)}
                                    style={{
                                        flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", borderWidth: 1.5,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 13, color: active ? colors.primary : colors.textSecondary, fontWeight: active ? "700" : "400" }}>{label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </AppSurface>

                {/* M-6: API timeout */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: "500", marginBottom: 4 }}>
                        Response timeout
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                        How long to wait for a cloud response before falling back to on-device mode
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        {(API_TIMEOUT_OPTIONS as readonly number[]).map((secs) => {
                            const active = apiTimeoutSecs === secs;
                            return (
                                <TouchableOpacity
                                    key={secs}
                                    onPress={() => handleApiTimeoutChange(secs)}
                                    style={{
                                        flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", borderWidth: 1.5,
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primaryTint : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 13, color: active ? colors.primary : colors.textSecondary, fontWeight: active ? "700" : "400" }}>{secs}s</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
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

                </View>
                )}

                {/* ── Admin Tools (EDU / ENTERPRISE only) ──────────────────── */}
                {gate("ADMIN_DASHBOARD", licenseTier).enabled && (() => {
                    const adminUrl = `${process.env.EXPO_PUBLIC_IMOTARA_API_BASE_URL || "https://imotaraapp.vercel.app"}/admin`;
                    const messageCount = history.length;
                    return (
                        <AppSurface style={{ marginHorizontal: 16, marginBottom: 24 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 }}>
                                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>Admin Tools</Text>
                                <View style={{ marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: colors.primaryBorder }}>
                                    <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5 }}>{prettyTier(licenseTier)}</Text>
                                </View>
                            </View>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 }}>
                                Full admin controls — user management, license audits, payments — are available on the Imotara web admin panel.
                            </Text>
                            {[
                                { label: "Account tier", value: prettyTier(licenseTier) },
                                { label: "Messages stored", value: String(messageCount) },
                            ].map(({ label, value }) => (
                                <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>{label}</Text>
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>{value}</Text>
                                </View>
                            ))}
                            <TouchableOpacity
                                onPress={() => WebBrowser.openBrowserAsync(adminUrl)}
                                style={{ marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.primary }}
                                accessibilityRole="link"
                                accessibilityLabel="Open web admin panel"
                            >
                                <Ionicons name="open-outline" size={15} color="#fff" />
                                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Open Web Admin Panel</Text>
                            </TouchableOpacity>
                        </AppSurface>
                    );
                })()}

            </ScrollView>

            <HowItWorksModal visible={showHowItWorks} onClose={() => setShowHowItWorks(false)} />
            {showUpgradeSheet && (
                <UpgradeSheet
                    visible={true}
                    onClose={() => setShowUpgradeSheet(false)}
                    currentTier={licenseTier ?? null}
                    onPurchaseComplete={async () => {
                        await refreshLicense();
                        // refreshLicense writes the new tier to AsyncStorage but doesn't update
                        // HistoryContext's licenseTier state — read it back and sync so the
                        // tier label in Settings refreshes immediately without an app restart.
                        const raw = await AsyncStorage.getItem("imotara_license_tier_v1").catch(() => null);
                        const VALID: LicenseTier[] = ["FREE", "PLUS", "PREMIUM", "FAMILY", "EDU", "ENTERPRISE"];
                        if (raw && VALID.includes(raw as LicenseTier) && setLicenseTier) {
                            setLicenseTier(raw as LicenseTier);
                        }
                    }}
                />
            )}
        </KeyboardAvoidingView>
    );
}
