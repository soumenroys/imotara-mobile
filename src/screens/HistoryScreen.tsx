// src/screens/HistoryScreen.tsx
import React from "react";
import { View, Text, FlatList, TouchableOpacity, Alert, TextInput, Modal, ScrollView, RefreshControl, Animated, PanResponder, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useHistoryStore } from "../state/HistoryContext";
import type { HistoryItem as HistoryRecord } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";
import { fetchRemoteHistory } from "../api/historyClient";
import { useColors } from "../theme/ThemeContext";
import type { ColorPalette } from "../theme/colors";
import AppButton from "../components/ui/AppButton";
import AppChip from "../components/ui/AppChip";
import { DEBUG_UI_ENABLED } from "../config/debug";

// ✅ Licensing gates
import { gate } from "../licensing/featureGates";

// ✅ Multilingual emotion detection
import {
    BN_SAD_REGEX, BN_STRESS_REGEX, BN_ANGER_REGEX,
    HI_STRESS_REGEX,
    TA_SAD_REGEX, TA_STRESS_REGEX,
    GU_SAD_REGEX, GU_STRESS_REGEX, GU_ANGER_REGEX,
    KN_SAD_REGEX, KN_STRESS_REGEX, KN_ANGER_REGEX,
    ML_SAD_REGEX, ML_STRESS_REGEX, ML_ANGER_REGEX,
    PA_SAD_REGEX, PA_STRESS_REGEX, PA_ANGER_REGEX,
    OR_SAD_REGEX, OR_STRESS_REGEX, OR_ANGER_REGEX,
    MR_SAD_REGEX, MR_STRESS_REGEX, MR_ANGER_REGEX,
    GRATITUDE_REGEX,
    isConfusedText,
} from "../lib/emotion/keywordMaps";

const USER_BUBBLE_BG = "rgba(56, 189, 248, 0.35)";
const SESSION_GAP_MS = 45 * 60 * 1000;

function getMoodEmojiForText(text: string): string {
    const t = text || "";
    const lower = t.toLowerCase();

    // Confused / stuck (checked first — overlaps with sad)
    if (isConfusedText(t)) return "🟣";
    if (/\b(stuck|lost|confused|dont know|don't know|no idea|numb|unsure)\b/.test(lower)) return "🟣";

    // Sad — multilingual
    if (
        BN_SAD_REGEX.test(t) || TA_SAD_REGEX.test(t) ||
        GU_SAD_REGEX.test(t) || KN_SAD_REGEX.test(t) ||
        ML_SAD_REGEX.test(t) || PA_SAD_REGEX.test(t) ||
        OR_SAD_REGEX.test(t) || MR_SAD_REGEX.test(t) ||
        /\b(sad|down|lonely|tired|upset|hurt|empty|depressed|blue|cry|crying|low|hopeless|grieve)\b/.test(lower) ||
        /(udaas|dukhi|dukh|koshto|sogama|kashtama|mon kharap)\b/i.test(lower)
    ) return "💙";

    // Anxious / stress — multilingual
    if (
        HI_STRESS_REGEX.test(t) || BN_STRESS_REGEX.test(t) ||
        TA_STRESS_REGEX.test(t) || GU_STRESS_REGEX.test(t) ||
        KN_STRESS_REGEX.test(t) || ML_STRESS_REGEX.test(t) ||
        PA_STRESS_REGEX.test(t) || OR_STRESS_REGEX.test(t) ||
        MR_STRESS_REGEX.test(t) ||
        /\b(worry|worried|anxious|scared|panic|nervous|stressed|overwhelmed|afraid|fear|tension)\b/.test(lower)
    ) return "💛";

    // Angry — multilingual
    if (
        BN_ANGER_REGEX.test(t) || GU_ANGER_REGEX.test(t) ||
        KN_ANGER_REGEX.test(t) || ML_ANGER_REGEX.test(t) ||
        PA_ANGER_REGEX.test(t) || OR_ANGER_REGEX.test(t) ||
        MR_ANGER_REGEX.test(t) ||
        /\b(angry|mad|frustrated|annoyed|irritated|furious|rage|hate)\b/.test(lower) ||
        /(gussa|rag|rosh|kopa|kopam|deshyam)\b/i.test(lower)
    ) return "❤️";

    // Hopeful / grateful
    if (
        GRATITUDE_REGEX.test(t) ||
        /\b(hope|hopeful|better|relieved|excited|good mood|feeling good|happy|joyful|cheerful|grateful|thankful)\b/.test(lower)
    ) return "💚";

    return "⚪️";
}


function getMoodIconName(emoji: string): string {
    switch (emoji) {
        case "💙": return "sad-outline";
        case "💛": return "flash-outline";
        case "❤️": return "flame-outline";
        case "🟣": return "help-circle-outline";
        case "💚": return "leaf-outline";
        case "💜": return "happy-outline";
        default:   return "remove-circle-outline";
    }
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
        case "💜":
            return "Happy / Joyful moments";
        case "⚪️":
        default:
            return "Neutral / Mixed moments";
    }
}


function getMoodTintForTextBackground(text: string, colors: ColorPalette): string {
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
            return colors.surfaceSoft;
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

function getMoodEmojiForHistoryItem(item: HistoryRecord): string | null {
    // ✅ Prefer persisted emotion first (new rows),
    // then legacy moodHint.emotion,
    // then moodHint.primary (most reliable fallback for older/local rows)
    const primaryEmotion = (item as any)?.emotion;
    const hintEmotion = (item as any)?.moodHint?.emotion;
    const hintPrimary = (item as any)?.moodHint?.primary;

    const emotionCandidate =
        typeof primaryEmotion === "string" && primaryEmotion.trim()
            ? primaryEmotion
            : typeof hintEmotion === "string" && hintEmotion.trim()
                ? hintEmotion
                : typeof hintPrimary === "string" && hintPrimary.trim()
                    ? hintPrimary
                    : "";


    if (emotionCandidate) {
        const e = emotionCandidate.trim().toLowerCase();

        // Map stored emotion → EXISTING mood emoji system used across HistoryScreen
        if (e === "joy" || e === "happy") return "💜";
        if (e === "sadness" || e === "sad") return "💙";

        // ✅ Treat "stressed" as the same bucket as fear/anxiety
        if (e === "stressed") return "💛";
        if (e === "fear" || e === "anxiety" || e === "anxious") return "💛";

        if (e === "anger" || e === "angry") return "❤️";
        if (e === "hope" || e === "hopeful") return "💚";
        if (e === "confused") return "🟣";
        if (e === "neutral") return "⚪️";

        // Unknown-but-present emotion: keep neutral-safe (don't re-guess from text)
        return "⚪️";


    }

    // Legacy fallback (older rows): infer from text (includes emoji-only)
    const t = (item as any)?.text;
    if (typeof t === "string" && t.trim()) return getMoodEmojiForText(t);

    return null;
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

// RN/Android can be picky about locale options; this keeps it safe.
function formatTimeLabelSafe(timestamp: number): string {
    try {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        } as any);
    } catch {
        return new Date(timestamp).toLocaleTimeString();
    }
}

// ── Swipeable row (swipe left to reveal delete) ────────────────────────────────
const SWIPE_THRESHOLD = 110;

function SwipeableRow({
    children,
    onDelete,
}: {
    children: React.ReactNode;
    onDelete: () => void;
}) {
    const translateX = React.useRef(new Animated.Value(0)).current;
    const isOpen = React.useRef(false);

    const panResponder = React.useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_e, gs) =>
                Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
            onPanResponderMove: (_e, gs) => {
                if (gs.dx < 0) translateX.setValue(Math.max(gs.dx, -SWIPE_THRESHOLD - 20));
            },
            onPanResponderRelease: (_e, gs) => {
                if (gs.dx < -SWIPE_THRESHOLD) {
                    Animated.spring(translateX, { toValue: -SWIPE_THRESHOLD, useNativeDriver: true }).start();
                    isOpen.current = true;
                } else {
                    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
                    isOpen.current = false;
                }
            },
        }),
    ).current;

    function close() {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        isOpen.current = false;
    }

    return (
        <View style={{ overflow: "hidden" }}>
            {/* Delete action revealed underneath */}
            <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SWIPE_THRESHOLD, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 12 }}>
                <TouchableOpacity
                    onPress={() => { close(); onDelete(); }}
                    style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }}
                >
                    <Text style={{ fontSize: 18 }}>🗑</Text>
                    <Text style={{ fontSize: 10, color: "#ef4444", fontWeight: "600", marginTop: 2 }}>Delete</Text>
                </TouchableOpacity>
            </View>
            <Animated.View
                style={{ transform: [{ translateX }] }}
                accessibilityHint="Swipe left to reveal delete"
                {...panResponder.panHandlers}
            >
                {children}
            </Animated.View>
        </View>
    );
}

export default function HistoryScreen() {
    const colors = useColors();
    const navigation = useNavigation<any>();

    const {
        history,
        pushHistoryToRemote,
        deleteFromHistory,
        // Newly available in current checkpoint: deduped sync triggers.
        runSync,
        syncNow,
        mergeRemoteHistory,
        isSyncing,
        lastSyncResult,
        lastSyncAt: historyLastSyncAt,
        hasUnsyncedChanges,
        potentialDuplicates,

        // ✅ Licensing (stored in HistoryContext)
        licenseTier,
    } = useHistoryStore() as any;

    // ✅ Cloud sync gate (soft gating)
    const cloudGate = gate("CLOUD_SYNC", licenseTier);

    // 🚀 Launch Phase Override: Cloud sync free for all users
    const canCloudSync = true;

    // ✅ TS-safe: reason exists only when enabled === false
    const cloudGateReason =
        !cloudGate.enabled ? cloudGate.reason : undefined;

    const {
        lastSyncAt,
        lastSyncStatus,
        autoSyncDelaySeconds,
        showAssistantRepliesInHistory,
        setShowAssistantRepliesInHistory,
    } = useSettings();

    const scrollRef = React.useRef<FlatList>(null);
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

    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const handleRefresh = React.useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try { await pushHistoryToRemote?.(); } catch { /* ignore */ }
        finally { if (mountedRef.current) setIsRefreshing(false); }
    }, [isRefreshing, pushHistoryToRemote]);

    const handleExportJSON = React.useCallback(async () => {
        try {
            const exportable = history.map((h: HistoryRecord) => ({
                id: h.id,
                from: h.from,
                text: h.text,
                timestamp: h.timestamp,
                emotion: (h as any).emotion ?? null,
                isSynced: h.isSynced,
            }));
            await Share.share({
                message: JSON.stringify(exportable, null, 2),
                title: "Imotara history export",
            });
        } catch { /* user cancelled */ }
    }, [history]);

    // ✅ Avoid re-render churn on scroll by only setting state when value actually changes
    const showTopRef = React.useRef(false);
    const showLatestRef = React.useRef(false);

    const hasSyncError = React.useMemo(() => {
        if (lastSyncResult && !lastSyncResult.ok) return true;
        const lower = (lastSyncStatus || "").toLowerCase();
        return lower.includes("failed") || lower.includes("error");
    }, [lastSyncResult, lastSyncStatus]);

    const effectiveLastSyncAt = lastSyncAt || historyLastSyncAt || null;

    const formattedLastSync = effectiveLastSyncAt
        ? new Date(effectiveLastSyncAt).toLocaleString()
        : null;

    // --- Emotion summary (lightweight, non-diagnostic) ---
    const moodSummary = React.useMemo(() => {
        // Phase 3.2: Prefer authoritative stored emotion; fall back to legacy moodHint.emotion
        const userItems = history.filter((h: HistoryRecord) => {
            if (h.from !== "user") return false;

            const primaryEmotion = (h as any)?.emotion;
            const hintEmotion = (h as any)?.moodHint?.emotion;

            return (
                (typeof primaryEmotion === "string" && primaryEmotion.trim()) ||
                (typeof hintEmotion === "string" && hintEmotion.trim())
            );
        });


        // Require a minimum sample so the summary isn't misleading
        if (userItems.length < 2) return null;

        const emojis: string[] = [];
        for (const item of userItems) {
            const emoji = getMoodEmojiForHistoryItem(item);
            if (emoji) emojis.push(emoji);
        }


        if (emojis.length === 0) return null;

        const counts: Record<string, number> = {};
        for (const emoji of emojis) {
            counts[emoji] = (counts[emoji] || 0) + 1;
        }

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const [dominantEmoji, dominantCount] = sorted[0] || [];
        if (!dominantEmoji) return null;

        const total = emojis.length;
        const ratio = total > 0 ? dominantCount / total : 0;

        let note = "";
        if (ratio >= 0.6) {
            note = "This shows up the most lately.";
        } else if (ratio >= 0.4) {
            note = "This shows up often lately.";
        } else {
            note = "Your recent mood looks mixed.";
        }

        return {
            emoji: dominantEmoji,
            iconName: getMoodIconName(dominantEmoji),
            label: getEmotionSectionLabel(dominantEmoji),
            note,
            total,
        };
    }, [history]);



    // "On This Day" — pick up to 3 user messages from the same month/day in prior years
    const onThisDay = React.useMemo(() => {
        const now = new Date();
        const todayMonth = now.getMonth();
        const todayDate = now.getDate();
        const thisYear = now.getFullYear();

        return history
            .filter((h: HistoryRecord) => {
                if (h.from !== "user" || !h.timestamp) return false;
                const d = new Date(h.timestamp);
                return (
                    d.getMonth() === todayMonth &&
                    d.getDate() === todayDate &&
                    d.getFullYear() < thisYear
                );
            })
            .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
            .slice(0, 3);
    }, [history]);

    const unsyncedCount = React.useMemo(
        () => history.filter((h: HistoryRecord) => !h.isSynced).length,
        [history]
    );

    const topChip = React.useMemo(() => {
        // ✅ If cloud sync is not available (Premium-gated), never show scary sync errors
        if (!canCloudSync) {
            return {
                label: "Device-only · cloud sync is off",
                variant: "neutral" as const,
                iconName: "phone-portrait-outline",
            };
        }

        if (!effectiveLastSyncAt) {
            return {
                label: "Sync status: never synced",
                variant: "neutral" as const,
                iconName: "cloud-outline",
            };
        }

        const lower = (lastSyncStatus || "").toLowerCase();

        if (hasSyncError) {
            return {
                label: "Sync issue · history is only on this device",
                variant: "danger" as const,
                iconName: "warning-outline",
            };
        }

        if (
            lower.includes("pushed") ||
            lower.includes("merged") ||
            lower.includes("synced")
        ) {
            return {
                label: "Synced · recent history backed up",
                variant: "primary" as const,
                icon: "✓",
            };
        }

        return {
            label: "Sync checked recently",
            variant: "neutral" as const,
            iconName: "cloud-outline",
        };
    }, [effectiveLastSyncAt, lastSyncStatus, hasSyncError, canCloudSync]);

    const showPremiumAlert = React.useCallback(() => {
        Alert.alert(
            "Premium feature",
            cloudGateReason || "Cloud sync is available with Premium.",
            [{ text: "OK" }]
        );
    }, [cloudGateReason]);

    const handleLoadRemote = React.useCallback(async () => {
        // debug button is already gated, but keep this safe if called elsewhere
        if (!DEBUG_UI_ENABLED) return;

        // ✅ Soft gate
        if (!canCloudSync) {
            showPremiumAlert();
            return;
        }

        if (isLoadingRemote) return;
        setIsLoadingRemote(true);

        try {
            const remote = await fetchRemoteHistory();

            if (!Array.isArray(remote)) {
                Alert.alert("Remote fetch", "Unexpected response format.");
                return;
            }

            // This returns accurate added counts in the current checkpoint.
            const result = mergeRemoteHistory(remote);

            if (result.normalized === 0) {
                Alert.alert(
                    "Remote history",
                    remote.length === 0
                        ? "Backend returned 0 item(s) so far."
                        : "No valid items found on the backend yet."
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
    }, [isLoadingRemote, mergeRemoteHistory, canCloudSync, showPremiumAlert]);

    const handleRetrySync = React.useCallback(async () => {
        // ✅ Soft gate
        if (!canCloudSync) {
            showPremiumAlert();
            return;
        }

        if (isSyncing) return;

        try {
            // Prefer deduped trigger if available; fall back to existing function.
            const syncFn =
                typeof syncNow === "function"
                    ? syncNow
                    : typeof runSync === "function"
                        ? runSync
                        : pushHistoryToRemote;

            const result = await syncFn({ reason: "HistoryScreen: manual sync" });

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
            Alert.alert(
                "Sync error",
                "Could not sync right now. Please try again later."
            );
        }
    }, [
        isSyncing,
        pushHistoryToRemote,
        runSync,
        syncNow,
        canCloudSync,
        showPremiumAlert,
    ]);

    const handleGoToChat = React.useCallback(() => {
        // keep behavior safe across any route name differences
        try {
            navigation.navigate("Chat");
            return;
        } catch { }
        try {
            navigation.navigate("ChatScreen");
            return;
        } catch { }
    }, [navigation]);

    // Phase 2.4: hide assistant replies by default (toggleable + persisted)
    const showAssistantReplies = showAssistantRepliesInHistory;
    const setShowAssistantReplies = setShowAssistantRepliesInHistory;

    const [showSearch, setShowSearch] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [debouncedSearch, setDebouncedSearch] = React.useState("");
    const searchInputRef = React.useRef<TextInput>(null);

    React.useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // Conflict resolution state
    const [showConflictModal, setShowConflictModal] = React.useState(false);
    const [dismissedPairs, setDismissedPairs] = React.useState<Set<string>>(new Set());

    const activeDuplicates: Array<[HistoryRecord, HistoryRecord]> = React.useMemo(() => {
        if (!Array.isArray(potentialDuplicates)) return [];
        return (potentialDuplicates as Array<[HistoryRecord, HistoryRecord]>).filter(([a, b]) => {
            const key = [a.id, b.id].sort().join("|");
            return !dismissedPairs.has(key);
        });
    }, [potentialDuplicates, dismissedPairs]);

    const dismissPair = (a: HistoryRecord, b: HistoryRecord) => {
        const key = [a.id, b.id].sort().join("|");
        setDismissedPairs((prev) => new Set([...prev, key]));
    };

    const sortedHistory = React.useMemo(
        () => [...history].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)),
        [history]
    );

    // List-only filter (does NOT affect stored history; just controls what is shown)
    const visibleHistory = React.useMemo(() => {
        if (showAssistantReplies) return sortedHistory;
        return sortedHistory.filter((h: HistoryRecord) => h.from === "user");
    }, [sortedHistory, showAssistantReplies]);

    const searchFilteredHistory = React.useMemo(() => {
        const q = showSearch ? debouncedSearch.trim().toLowerCase() : "";
        if (!q) return visibleHistory;
        return visibleHistory.filter((h) => h.text?.toLowerCase().includes(q));
    }, [visibleHistory, showSearch, debouncedSearch]);

    const groupedHistory = React.useMemo(() => {
        const groups: { label: string; items: HistoryRecord[] }[] = [];

        let currentLabel: string | null = null;
        let currentItems: HistoryRecord[] = [];

        searchFilteredHistory.forEach((item) => {
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
    }, [searchFilteredHistory]);

    // Flat list data — list-header (stats/controls) + date headers + message items
    type FlatItem =
        | { kind: "list-header" }
        | { kind: "header"; label: string }
        | { kind: "msg"; item: HistoryRecord; siblings: HistoryRecord[]; idx: number };

    const flatItems = React.useMemo<FlatItem[]>(() => {
        const result: FlatItem[] = [{ kind: "list-header" }];
        for (const group of groupedHistory) {
            result.push({ kind: "header", label: group.label });
            group.items.forEach((item, idx) => {
                result.push({ kind: "msg", item, siblings: group.items, idx });
            });
        }
        return result;
    }, [groupedHistory]);

    const retryLabel = isSyncing
        ? "Syncing…"
        : !canCloudSync
            ? "Sync (Premium)"
            : !hasUnsyncedChanges && !hasSyncError
                ? "Up to date"
                : hasSyncError
                    ? "Try sync again now"
                    : "Sync now";

    const isEmpty = visibleHistory.length === 0;

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <FlatList
                ref={scrollRef}
                data={flatItems}
                keyExtractor={(fi) =>
                    fi.kind === "list-header" ? "__list-header__" : fi.kind === "header" ? `hdr-${fi.label}` : fi.item.id
                }
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    paddingBottom: 80,
                }}
                onScroll={(e) => {
                    const { contentOffset, contentSize, layoutMeasurement } =
                        e.nativeEvent;
                    const distanceFromBottom =
                        contentSize.height -
                        (contentOffset.y + layoutMeasurement.height);
                    const nextShowLatest = distanceFromBottom > 120;
                    const nextShowTop = contentOffset.y > 80;
                    if (nextShowLatest !== showLatestRef.current) {
                        showLatestRef.current = nextShowLatest;
                        setShowScrollToLatest(nextShowLatest);
                    }
                    if (nextShowTop !== showTopRef.current) {
                        showTopRef.current = nextShowTop;
                        setShowScrollToTop(nextShowTop);
                    }
                }}
                scrollEventThrottle={50}
                removeClippedSubviews
                maxToRenderPerBatch={12}
                windowSize={7}
                initialNumToRender={20}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor="#38bdf8"
                        colors={["#38bdf8"]}
                    />
                }
                ListEmptyComponent={isEmpty ? (
                    <View style={{ alignItems: "center", paddingTop: 40 }}>
                        <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.textSecondary} style={{ marginBottom: 16 }} />
                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, textAlign: "center", marginBottom: 8 }}>
                            Nothing here yet
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center" }}>
                            Start chatting and your history will appear here.
                        </Text>
                    </View>
                ) : null}
                renderItem={({ item: fi }) => {
                    if (fi.kind === "list-header") {
                        return (
                            <View style={{ marginBottom: 8 }}>
                                <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 4, color: colors.textPrimary }}>
                                    Emotion History
                                </Text>
                                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>
                                    Your recent conversations with Imotara on this device.
                                </Text>
                                <View style={{ marginTop: 4, marginBottom: 6 }}>
                                    <AppChip label={topChip.label} variant={topChip.variant} icon={(topChip as any).icon} iconName={(topChip as any).iconName} animate />
                                </View>
                                {moodSummary ? (
                                    <View style={{ marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12 }}>
                                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Quick mood summary</Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                            <Ionicons name={moodSummary.iconName as any} size={14} color={colors.textPrimary} />
                                            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>{moodSummary.label}</Text>
                                        </View>
                                        <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 16 }}>{moodSummary.note} (Based on your last {moodSummary.total} messages.)</Text>
                                    </View>
                                ) : (
                                    <View style={{ marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12 }}>
                                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Quick mood summary</Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                            <Ionicons name="remove-circle-outline" size={14} color={colors.textSecondary} />
                                            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>Not enough recent mood data yet</Text>
                                        </View>
                                        <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 16 }}>This appears after a few messages are captured with mood hints.</Text>
                                    </View>
                                )}
                                {onThisDay.length > 0 && (
                                    <View style={{ marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12 }}>
                                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: 6 }}>On This Day</Text>
                                        {onThisDay.map((item) => {
                                            const d = new Date(item.timestamp ?? 0);
                                            const year = d.getFullYear();
                                            const preview = (item.text ?? "").slice(0, 100);
                                            return (
                                                <View key={item.id} style={{ marginBottom: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: "rgba(99,102,241,0.4)" }}>
                                                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 2 }}>{year}</Text>
                                                    <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 18 }} numberOfLines={3}>{preview}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                                {activeDuplicates.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setShowConflictModal(true)}
                                        style={{ marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: "rgba(251,191,36,0.5)", backgroundColor: "rgba(251,191,36,0.10)", padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}
                                    >
                                        <Text style={{ fontSize: 18 }}>⚠</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
                                                {activeDuplicates.length} possible duplicate{activeDuplicates.length !== 1 ? "s" : ""} found
                                            </Text>
                                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                                                Tap to review and resolve
                                            </Text>
                                        </View>
                                        <Text style={{ fontSize: 12, color: "#fbbf24", fontWeight: "600" }}>Review →</Text>
                                    </TouchableOpacity>
                                )}
                                {formattedLastSync && (
                                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Last sync: {formattedLastSync}</Text>
                                )}
                                {(unsyncedCount > 0 || hasUnsyncedChanges) && (
                                    <View style={{ marginBottom: 8 }}>
                                        <Text style={{ fontSize: 11, color: hasSyncError ? "#fecaca" : colors.textSecondary, fontWeight: hasSyncError ? "600" : "400" }}>
                                            Unsynced messages on this device: {unsyncedCount}
                                        </Text>
                                        <Text style={{ marginTop: 2, fontSize: 11, color: hasSyncError ? "#fecaca" : colors.textSecondary }}>
                                            {hasSyncError
                                                ? "Couldn't reach the cloud recently. Messages are safe and will sync when connection recovers."
                                                : autoSyncDelaySeconds > 0
                                                    ? `Will auto-sync in ~${autoSyncDelaySeconds}s when online.`
                                                    : "Will sync when you tap Sync."}
                                        </Text>
                                        <AppButton title={retryLabel} onPress={handleRetrySync}
                                            disabled={isSyncing || !canCloudSync || (!hasUnsyncedChanges && !hasSyncError)}
                                            variant="primary" size="sm"
                                            style={{ alignSelf: "flex-start", marginTop: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, opacity: isSyncing || !canCloudSync ? 0.7 : 1 }}
                                            textStyle={{ fontSize: 11, fontWeight: "600", color: colors.textPrimary }}
                                        />
                                        <TouchableOpacity onPress={() => setShowAssistantReplies(!showAssistantReplies)}
                                            style={{ marginTop: 10, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: showAssistantReplies ? "rgba(56,189,248,0.14)" : "rgba(148,163,184,0.10)" }}>
                                            <Text style={{ fontSize: 12, color: colors.textPrimary }}>{showAssistantReplies ? "Hide assistant replies" : "Show assistant replies"}</Text>
                                        </TouchableOpacity>
                                        {!canCloudSync && (
                                            <Text style={{ marginTop: 6, fontSize: 11, color: colors.textSecondary }}>
                                                {!cloudGate.enabled ? (cloudGate as any).reason || "Cloud sync available with Premium." : null}
                                            </Text>
                                        )}
                                        {isSyncing && <Text style={{ marginTop: 4, fontSize: 11, color: colors.textSecondary, fontStyle: "italic" }}>Syncing in background…</Text>}
                                    </View>
                                )}
                                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 8, gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            const next = !showSearch;
                                            setShowSearch(next);
                                            if (!next) setSearchQuery("");
                                            else setTimeout(() => searchInputRef.current?.focus(), 120);
                                        }}
                                        style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: showSearch ? "rgba(99,102,241,0.18)" : "rgba(148,163,184,0.10)" }}>
                                        <Text style={{ fontSize: 12, color: colors.textPrimary }}>{showSearch ? "Close search" : "Search history"}</Text>
                                    </TouchableOpacity>
                                    {showSearch && searchQuery.trim().length > 0 && (
                                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                                            {searchFilteredHistory.length > 0 ? `${searchFilteredHistory.length} result(s)` : "No results"}
                                        </Text>
                                    )}
                                    <TouchableOpacity
                                        onPress={handleExportJSON}
                                        style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(148,163,184,0.10)" }}>
                                        <Text style={{ fontSize: 12, color: colors.textPrimary }}>Export JSON</Text>
                                    </TouchableOpacity>
                                </View>
                                {showSearch && (
                                    <TextInput
                                        ref={searchInputRef}
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        placeholder="Search messages…"
                                        placeholderTextColor={colors.textSecondary}
                                        style={{
                                            marginTop: 8,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            backgroundColor: colors.surface,
                                            color: colors.textPrimary,
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            fontSize: 14,
                                        }}
                                        returnKeyType="search"
                                        clearButtonMode="while-editing"
                                    />
                                )}
                                {DEBUG_UI_ENABLED && (
                                    <AppButton title={isLoadingRemote ? "Loading remote…" : !canCloudSync ? "Load Remote (Premium)" : "Load Remote History"}
                                        onPress={handleLoadRemote} disabled={isLoadingRemote || !canCloudSync} variant="success" size="sm"
                                        style={{ alignSelf: "flex-start", marginBottom: 16, opacity: isLoadingRemote || !canCloudSync ? 0.7 : 1 }}
                                    />
                                )}
                                {isEmpty && (
                                    <View style={{ marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, padding: 16 }}>
                                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 }}>Your story starts here ✨</Text>
                                        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 }}>
                                            When you chat with Imotara, your conversation appears here as an "Emotion History" so you can notice patterns, moods, and growth over time.
                                        </Text>
                                        <AppButton title="Start in Chat" onPress={handleGoToChat} variant="primary" style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 16 }} />
                                        <Text style={{ marginTop: 10, fontSize: 12, color: colors.textSecondary }}>Tip: long-press a message to see the timestamp.</Text>
                                    </View>
                                )}
                            </View>
                        );
                    }

                    if (fi.kind === "header") {
                        return (
                            <Text
                                style={{
                                    alignSelf: "center",
                                    marginBottom: 8,
                                    marginTop: 10,
                                    paddingHorizontal: 12,
                                    paddingVertical: 4,
                                    borderRadius: 999,
                                    fontSize: 12,
                                    color: colors.textSecondary,
                                    backgroundColor: colors.surfaceSoft,
                                }}
                            >
                                {fi.label}
                            </Text>
                        );
                    }

                    // fi.kind === "msg"
                    const { item, siblings, idx: index } = fi;
                    const isUser = item.from === "user";
                    const moodBaseText = getBaseTextForMood(siblings, index);

                    let emotionHeader: { iconName: string; label: string } | null = null;
                    if (!isUser) {
                        const emoji =
                            getMoodEmojiForHistoryItem(item) ??
                            getMoodEmojiForText(moodBaseText);
                        const label = getEmotionSectionLabel(emoji);
                        const hasPrevious = siblings
                            .slice(0, index)
                            .some((prev: HistoryRecord, prevIdx: number) => {
                                if (prev.from !== "bot") return false;
                                const prevEmoji =
                                    getMoodEmojiForHistoryItem(prev) ??
                                    getMoodEmojiForText(getBaseTextForMood(siblings, prevIdx));
                                return prevEmoji === emoji;
                            });
                        if (!hasPrevious) emotionHeader = { iconName: getMoodIconName(emoji), label };
                    }

                    let showSessionDivider = false;
                    if (index > 0) {
                        const prev = siblings[index - 1];
                        const gap = item.timestamp - (prev.timestamp ?? 0);
                        if (gap > SESSION_GAP_MS) showSessionDivider = true;
                    }

                    const bubbleBackground = isUser
                        ? USER_BUBBLE_BG
                        : getMoodTintForTextBackground(moodBaseText, colors);
                    const moodHaloColor = !isUser
                        ? getMoodHaloColor(moodBaseText)
                        : "transparent";
                    const itemHasSyncError = !item.isSynced && !item.isPending;
                    const chipVariant = item.isSynced
                        ? ("primary" as const)
                        : itemHasSyncError
                            ? ("danger" as const)
                            : ("warning" as const);
                    const chipLabel = item.isSynced
                        ? "Synced to cloud"
                        : itemHasSyncError
                            ? "Sync issue · device only"
                            : "On this device only";
                    const chipIconName = item.isSynced ? undefined : itemHasSyncError ? "warning-outline" : "phone-portrait-outline";
                    const chipIcon = item.isSynced ? "✓" : undefined;

                    return (
                        <SwipeableRow
                            key={item.id}
                            onDelete={() =>
                                Alert.alert("Delete message?", "This removes it from your device only.", [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Delete", style: "destructive", onPress: () => deleteFromHistory(item.id) },
                                ])
                            }
                        >
                        <View style={{ marginBottom: 10 }}>
                            {showSessionDivider && (
                                <View style={{ alignSelf: "center", marginVertical: 6, flexDirection: "row", alignItems: "center" }}>
                                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border, opacity: 0.5, marginRight: 8 }} />
                                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>New session</Text>
                                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border, opacity: 0.5, marginLeft: 8 }} />
                                </View>
                            )}
                            {emotionHeader && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, marginBottom: 2, alignSelf: "flex-start" }}>
                                    <Ionicons name={emotionHeader.iconName as any} size={11} color={colors.textSecondary} />
                                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>{emotionHeader.label}</Text>
                                </View>
                            )}
                            <View style={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "80%", padding: isUser ? 0 : 4, borderRadius: isUser ? 0 : 20, backgroundColor: moodHaloColor }}>
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onLongPress={() => Alert.alert("Message timestamp", new Date(item.timestamp).toLocaleString())}
                                    delayLongPress={250}
                                    style={{ alignSelf: "flex-start", maxWidth: "100%", backgroundColor: bubbleBackground, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 2 }}>
                                        {isUser ? "You" : "Imotara"}
                                    </Text>
                                    <Text style={{ fontSize: 14, color: colors.textPrimary }}>{item.text}</Text>
                                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                                        {formatTimeLabelSafe(item.timestamp)}
                                    </Text>
                                    <AppChip label={chipLabel} variant={chipVariant} icon={chipIcon} iconName={chipIconName} animate style={{ alignSelf: isUser ? "flex-end" : "flex-start", marginTop: 6 }} />
                                    {!isUser && typeof item.intensity === "number" && item.intensity > 0 && (
                                        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                            <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(148,163,184,0.2)" }}>
                                                <View style={{ width: `${Math.min(100, Math.round(item.intensity * 100))}%`, height: 3, borderRadius: 2, backgroundColor: getMoodTintForTextBackground(moodBaseText, colors) }} />
                                            </View>
                                            <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                                                {item.intensity >= 0.7 ? "high" : item.intensity >= 0.4 ? "mid" : "low"}
                                            </Text>
                                        </View>
                                    )}
                                    {!item.isSynced && (
                                        <AppButton
                                            title={isLoadingRemote ? "Checking cloud…" : !canCloudSync ? "Cloud copy (Premium)" : "Tap to check cloud copy"}
                                            onPress={() => { if (!canCloudSync) { showPremiumAlert(); return; } handleLoadRemote(); }}
                                            disabled={isLoadingRemote || !canCloudSync}
                                            variant="ghost"
                                            size="sm"
                                            style={{ alignSelf: isUser ? "flex-end" : "flex-start", marginTop: 4, borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0, opacity: isLoadingRemote || !canCloudSync ? 0.7 : 1 }}
                                            textStyle={{ fontSize: 11, fontWeight: "500", color: "#93c5fd", textDecorationLine: "underline" }}
                                        />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                        </SwipeableRow>
                    );
                }}
            />

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
                            onPress={() =>
                                scrollRef.current?.scrollToOffset({
                                    offset: 0,
                                    animated: true,
                                })
                            }
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
                            onPress={() =>
                                scrollRef.current?.scrollToEnd({
                                    animated: true,
                                })
                            }
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

            {/* ── Conflict Resolution Modal ─────────────────────────────────────── */}
            <Modal
                visible={showConflictModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowConflictModal(false)}
            >
                <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" }}>
                        {/* Header */}
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Review Duplicates</Text>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                    These messages look identical. Pick which to keep.
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowConflictModal(false)} style={{ padding: 8 }}>
                                <Text style={{ fontSize: 20, color: colors.textSecondary }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {activeDuplicates.length === 0 ? (
                                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                                    <Text style={{ fontSize: 28, marginBottom: 8 }}>✓</Text>
                                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>All duplicates resolved!</Text>
                                </View>
                            ) : (
                                activeDuplicates.map(([a, b], idx) => (
                                    <View key={`${a.id}|${b.id}`} style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, marginBottom: 12 }}>
                                        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
                                            Pair {idx + 1}
                                        </Text>

                                        {/* Version A */}
                                        <View style={{ borderRadius: 10, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)", backgroundColor: "rgba(99,102,241,0.06)", padding: 10, marginBottom: 6 }}>
                                            <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 4 }}>
                                                Version A · {new Date(a.timestamp).toLocaleString()} · {a.isSynced ? "☁ synced" : "📱 local"}
                                            </Text>
                                            <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 18 }} numberOfLines={4}>{a.text}</Text>
                                            <TouchableOpacity
                                                onPress={() => { if (typeof deleteFromHistory === "function") deleteFromHistory(b.id); dismissPair(a, b); }}
                                                style={{ marginTop: 8, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: "rgba(99,102,241,0.18)" }}
                                            >
                                                <Text style={{ fontSize: 12, color: "#818cf8", fontWeight: "600" }}>Keep A, delete B</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Version B */}
                                        <View style={{ borderRadius: 10, borderWidth: 1, borderColor: "rgba(52,211,153,0.3)", backgroundColor: "rgba(52,211,153,0.06)", padding: 10, marginBottom: 6 }}>
                                            <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 4 }}>
                                                Version B · {new Date(b.timestamp).toLocaleString()} · {b.isSynced ? "☁ synced" : "📱 local"}
                                            </Text>
                                            <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 18 }} numberOfLines={4}>{b.text}</Text>
                                            <TouchableOpacity
                                                onPress={() => { if (typeof deleteFromHistory === "function") deleteFromHistory(a.id); dismissPair(a, b); }}
                                                style={{ marginTop: 8, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: "rgba(52,211,153,0.18)" }}
                                            >
                                                <Text style={{ fontSize: 12, color: "#34d399", fontWeight: "600" }}>Keep B, delete A</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Keep both */}
                                        <TouchableOpacity
                                            onPress={() => dismissPair(a, b)}
                                            style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border }}
                                        >
                                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Keep both (dismiss)</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                            <View style={{ height: 24 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
