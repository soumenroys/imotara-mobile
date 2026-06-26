// src/screens/connect/ConnectScreen.tsx
// Imotara Connect — human consultancy marketplace for mobile.
// All sub-views are managed with local state to avoid a nested stack navigator.

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    View, Text, ScrollView, TouchableOpacity, TextInput, FlatList,
    ActivityIndicator, Alert, Modal, Linking, Platform, StyleSheet,
    KeyboardAvoidingView, Image, RefreshControl, BackHandler, AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useColors, useTheme } from "../../theme/ThemeContext";
import { useAuth } from "../../auth/AuthContext";
import { useSettings } from "../../state/SettingsContext";
import { buildApiUrl } from "../../config/api";
import { fetchWithTimeout } from "../../lib/fetchWithTimeout";
import { supabase } from "../../lib/supabase/client";

// Standard Connect API calls — 12-second timeout.
const cfetch = (url: string, init: RequestInit = {}) => fetchWithTimeout(url, init, 12_000);

// Payment API calls (Razorpay order creation + verify) — 30-second timeout.
// These hit the Razorpay external API (1-3 s) on top of Vercel cold start.
const pfetch = (url: string, init: RequestInit = {}) => fetchWithTimeout(url, init, 30_000);
import { useRoute, useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Consultant {
    id: string;
    display_name: string;
    gender: string | null;
    photo_url: string | null;
    bio: string | null;
    expertise_tags: string[];
    languages: string[];
    session_types: string[];
    role_category: string;
    rate_per_min: number;
    currency_code: string;
    is_online: boolean;
    is_busy: boolean;
    rating_avg: number;
    rating_count: number;
    sessions_completed: number;
    availability_note: string | null;
    availability_windows: Array<{ day: string; start: string; end: string }> | null;
    preferred_lang?: string;
}

interface Session {
    id: string;
    consultant_id: string;
    user_id: string;
    status: string;
    type: string;
    minutes_used: number;
    scheduled_note: string | null;
    currency_code: string | null;
    created_at: string;
    started_at: string | null;
    amount_charged: number | null;
    rate_per_min: number | null;
    user_timezone: string | null;
    consultant_timezone: string | null;
    translation_enabled?: boolean;
    user_lang?: string | null;
    consultant_lang?: string | null;
    review_submitted_at?: string | null;
    connect_consultants: { display_name: string; photo_url: string | null; rate_per_min?: number } | null;
}

function tzLabel(tz: string): string {
    try {
        const parts = Intl.DateTimeFormat("en", { timeZoneName: "short", timeZone: tz }).formatToParts(new Date());
        return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
    } catch { return tz; }
}

function formatMinutes(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr${h > 1 ? "s" : ""}`;
    return `${h} hr${h > 1 ? "s" : ""} ${m} min`;
}

function formatDuration(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function formatClock(date: Date, tz: string): string {
    try {
        return date.toLocaleString("en-IN", {
            timeZone: tz, weekday: "short", day: "numeric", month: "short",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        });
    } catch { return date.toLocaleString(); }
}

interface Message {
    id: string;
    sender_id: string;
    content: string;
    translated_content?: string | null;
    created_at: string;
}

interface WalletTx {
    id: string;
    type: "topup" | "deduction" | "refund" | "session" | "dormancy_marked";
    amount: number;
    currency_code: string;
    description: string;
    created_at: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", AUD: "A$",
    CAD: "CA$", NZD: "NZ$", CHF: "CHF ", JPY: "¥", CNY: "¥", HKD: "HK$",
    MYR: "RM", THB: "฿", IDR: "Rp", PHP: "₱", ZAR: "R", BRL: "R$",
};

const CHAT_LANGUAGES = [
    { code: "en", label: "English",    flag: "🇬🇧" },
    { code: "hi", label: "Hindi",      flag: "🇮🇳" },
    { code: "bn", label: "Bengali",    flag: "🇧🇩" },
    { code: "mr", label: "Marathi",    flag: "🇮🇳" },
    { code: "ta", label: "Tamil",      flag: "🇮🇳" },
    { code: "te", label: "Telugu",     flag: "🇮🇳" },
    { code: "gu", label: "Gujarati",   flag: "🇮🇳" },
    { code: "pa", label: "Punjabi",    flag: "🇮🇳" },
    { code: "kn", label: "Kannada",    flag: "🇮🇳" },
    { code: "ml", label: "Malayalam",  flag: "🇮🇳" },
    { code: "ur", label: "Urdu",       flag: "🇵🇰" },
    { code: "ar", label: "Arabic",     flag: "🇸🇦" },
    { code: "es", label: "Spanish",    flag: "🇪🇸" },
    { code: "fr", label: "French",     flag: "🇫🇷" },
    { code: "de", label: "German",     flag: "🇩🇪" },
    { code: "pt", label: "Portuguese", flag: "🇵🇹" },
] as const;

const CRISIS_LINES = [
    { country: "India", name: "iCall", phone: "9152987821" },
    { country: "India", name: "Vandrevala Foundation", phone: "18602662345" },
    { country: "India", name: "Snehi", phone: "04424640050" },
    { country: "USA", name: "988 Lifeline", phone: "988" },
    { country: "UK", name: "Samaritans", phone: "116123" },
    { country: "Australia", name: "Lifeline", phone: "131114" },
];

const SESSION_TYPE_OPTIONS = [
    { key: "chat",  label: "Text / Chat", icon: "💬", phase: 1 },
    { key: "audio", label: "Audio Call",  icon: "🎙️", phase: 3 },
    { key: "video", label: "Video Call",  icon: "📹", phase: 3 },
] as const;

const EXPERTISE_OPTIONS = [
    "Stress & Anxiety", "Loneliness", "Grief & Loss", "Relationship Issues",
    "Work & Career Pressure", "Self-Esteem", "Family Conflicts", "Life Transitions",
    "Emotional Regulation", "Mindfulness", "General Wellness",
];

const ROLE_CATEGORIES = [
    { key: "wellness_companion", label: "Wellness Companion", icon: "🧘", phase: 1 },
    { key: "friend",             label: "Friend",             icon: "🤝", phase: 2 },
    { key: "dad",                label: "Dad",                icon: "👨", phase: 2 },
    { key: "mom",                label: "Mom",                icon: "👩", phase: 2 },
    { key: "sister",             label: "Sister",             icon: "👧", phase: 2 },
    { key: "brother",            label: "Brother",            icon: "👦", phase: 2 },
    { key: "grandfather",        label: "Grandfather",        icon: "👴", phase: 2 },
    { key: "grandmother",        label: "Grandmother",        icon: "👵", phase: 2 },
    { key: "yoga_instructor",    label: "Yoga Instructor",    icon: "🧘", phase: 3 },
    { key: "fitness_companion",  label: "Fitness Companion",  icon: "💪", phase: 3 },
] as const;

const LANGUAGE_OPTIONS = [
    { code: "en", label: "English" },        { code: "hi", label: "Hindi" },
    { code: "bn", label: "Bengali" },        { code: "mr", label: "Marathi" },
    { code: "ta", label: "Tamil" },          { code: "te", label: "Telugu" },
    { code: "gu", label: "Gujarati" },       { code: "pa", label: "Punjabi" },
    { code: "kn", label: "Kannada" },        { code: "ml", label: "Malayalam" },
    { code: "or", label: "Odia" },           { code: "ur", label: "Urdu" },
    { code: "ar", label: "Arabic" },         { code: "he", label: "Hebrew" },
    { code: "ru", label: "Russian" },        { code: "zh", label: "Chinese" },
    { code: "ja", label: "Japanese" },       { code: "es", label: "Spanish" },
    { code: "fr", label: "French" },         { code: "de", label: "German" },
    { code: "pt", label: "Portuguese" },
];

// ── View type ──────────────────────────────────────────────────────────────────
type ConnectView =
    | { name: "browse" }
    | { name: "sessions" }
    | { name: "wallet" }
    | { name: "profile"; consultant: Consultant }
    | { name: "chat"; session: Session; origin?: "sessions" | "dashboard" | "browse" }
    | { name: "dashboard" }
    | { name: "register" };

export default function ConnectScreen() {
    const colors = useColors();
    const { isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { accessToken, user } = useAuth();
    const { toneContext } = useSettings();
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const [view, setView] = useState<ConnectView>({ name: "browse" });

    // Navigate directly to register when launched from "Join Imotara Movement" in Settings
    useEffect(() => {
        if (route.params?.startRegister) {
            setView({ name: "register" });
            navigation.setParams({ startRegister: undefined });
        }
    }, [route.params?.startRegister]);

    // Handle tap on a push notification for a new session request — open the dashboard.
    useEffect(() => {
        if (Platform.OS === "web") return;
        let sub: any;
        try {
            const Notifications = require("expo-notifications");
            sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
                const data = response?.notification?.request?.content?.data;
                if (data?.type === "session_request") {
                    // Don't eject the user from an active chat session — a background push
                    // notification arriving during a live call must not navigate away.
                    setView((prev: any) => {
                        if (prev.name === "chat") return prev;
                        return { name: "dashboard" };
                    });
                }
            });
        } catch { /* expo-notifications unavailable */ }
        return () => { sub?.remove?.(); };
    }, []);

    // Auto-return to an active session on cold launch. If the user closed the app while a
    // session was running, the billing tick stops (no ticks without ChatView mounted) but
    // the consultant remains marked is_busy=true. Navigating to ChatView automatically
    // on next open lets the user end or resume the session and unblocks the consultant.
    // Only navigates if still on the default "browse" view — respects any other navigation
    // already set (e.g., by a push notification tap on the same launch).
    useEffect(() => {
        if (!accessToken) return;
        let mounted = true;
        cfetch(buildApiUrl("/api/connect/sessions"), {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
            .then((r) => r.json())
            .then((d) => {
                if (!mounted || !d.ok) return;
                // Return to an active OR pending session — pending means the consultant
                // hasn't accepted yet; the ChatView shows a "Waiting…" state in that case.
                const live = (d.sessions ?? []).find((s: any) => s.status === "active" || s.status === "pending");
                if (live) setView((prev: any) => (prev.name === "browse" ? { name: "chat", session: live } : prev));
            })
            .catch(() => {});
        return () => { mounted = false; };
    }, [accessToken]);

    const s = styles(colors);

    // Age gate — mirrors web /connect/age-restricted redirect.
    // Connect is a paid adult counselling marketplace; under-18 access is blocked.
    const userAgeRange = toneContext?.user?.ageRange;
    if (userAgeRange === "under_13" || userAgeRange === "13_17") {
        return (
            <View style={[s.container, { paddingTop: insets.top + 32, alignItems: "center", justifyContent: "center", padding: 32 }]}>
                <Text style={{ fontSize: 40, marginBottom: 16 }}>🔒</Text>
                <Text style={[s.cardName, { fontSize: 20, textAlign: "center", marginBottom: 12 }]}>
                    Age Restriction
                </Text>
                <Text style={[s.cardBio, { textAlign: "center", lineHeight: 22 }]}>
                    Imotara Connect is available for users 18 and older.{"\n\n"}
                    Please explore the rest of the Imotara app for AI wellness support.
                </Text>
            </View>
        );
    }

    function header(title: string, onBack?: () => void) {
        return (
            <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                {onBack ? (
                    <TouchableOpacity onPress={onBack} style={s.backBtn}>
                        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                ) : <View style={{ width: 36 }} />}
                <Text style={s.headerTitle}>{title}</Text>
                <View style={{ width: 36 }} />
            </View>
        );
    }

    // Route to sub-views
    if (view.name === "profile") {
        return <ProfileView consultant={view.consultant} colors={colors} insets={insets}
            accessToken={accessToken} userId={user?.id ?? null}
            onBack={() => setView({ name: "browse" })}
            onStartSession={(s) => setView({ name: "chat", session: s, origin: "browse" })} />;
    }
    if (view.name === "chat") {
        const chatOrigin = view.origin;
        return <ChatView session={view.session} colors={colors} insets={insets}
            accessToken={accessToken} userId={user?.id ?? null}
            onBack={() => setView(chatOrigin === "dashboard" ? { name: "dashboard" } : chatOrigin === "browse" ? { name: "browse" } : { name: "sessions" })} />;
    }
    if (view.name === "dashboard") {
        return <DashboardView colors={colors} insets={insets}
            accessToken={accessToken}
            onBack={() => setView({ name: "browse" })}
            onJoinSession={(s) => setView({ name: "chat", session: s, origin: "dashboard" })}
            onRegister={() => setView({ name: "register" })} />;
    }
    if (view.name === "register") {
        return <RegisterView colors={colors} insets={insets}
            accessToken={accessToken}
            userEmail={user?.email ?? null}
            onBack={() => setView({ name: "browse" })}
            onSuccess={() => setView({ name: "dashboard" })} />;
    }

    // Main tabbed view
    const tab = view.name as "browse" | "sessions" | "wallet";

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={s.header}>
                <Text style={s.headerTitle}>Connect</Text>
                <TouchableOpacity onPress={() => setView({ name: "dashboard" })} style={s.headerAction}>
                    <Ionicons name="person-circle-outline" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={s.tabBar}>
                {(["browse", "sessions", "wallet"] as const).map((t) => (
                    <TouchableOpacity key={t} style={[s.tabItem, tab === t && s.tabItemActive]}
                        onPress={() => setView({ name: t } as ConnectView)}>
                        <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
                            {t === "browse" ? "Browse" : t === "sessions" ? "Sessions" : "Wallet"}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {tab === "browse" && <BrowseTab colors={colors} accessToken={accessToken}
                onSelectConsultant={(c) => setView({ name: "profile", consultant: c })}
                onOpenWallet={() => setView({ name: "wallet" })} />}
            {tab === "sessions" && <SessionsTab colors={colors} accessToken={accessToken}
                onSelectSession={(s) => setView({ name: "chat", session: s })} />}
            {tab === "wallet" && <WalletTab colors={colors} accessToken={accessToken} />}

        </View>
    );
}

// ── Browse Tab ─────────────────────────────────────────────────────────────────
function BrowseTab({ colors, accessToken, onSelectConsultant, onOpenWallet }: {
    colors: any; accessToken: string | null;
    onSelectConsultant: (c: Consultant) => void;
    onOpenWallet: () => void;
}) {
    const { signInWithGoogle, signInWithApple, appleSignInAvailable } = useAuth();
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [filterOnline, setFilterOnline] = useState(false);
    const [filterTag, setFilterTag] = useState("");
    const [filterCategory, setFilterCategory] = useState("");
    const [sort, setSort] = useState<"rating" | "price_asc" | "price_desc" | "sessions">("rating");
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [favLoading, setFavLoading] = useState<string | null>(null);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [walletCurrency, setWalletCurrency] = useState("INR");
    const [fetchFailed, setFetchFailed] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const s = styles(colors);

    useEffect(() => {
        // Reset pagination state synchronously so loadMoreConsultants won't fire
        // with a stale page number while the new filter result is loading.
        setHasMore(false);
        setPage(1);
        const params = new URLSearchParams();
        if (filterOnline)   params.set("online", "true");
        if (filterCategory) params.set("category", filterCategory);
        const authHeaders: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        setLoading(true);
        setFetchFailed(false);
        Promise.allSettled([
            cfetch(buildApiUrl(`/api/connect/consultants?${params}`), { headers: authHeaders }).then((r) => r.json()),
            accessToken
                ? cfetch(buildApiUrl("/api/connect/favorites"), { headers: authHeaders }).then((r) => r.json())
                : Promise.resolve({ ok: false, favorites: [] }),
            accessToken
                ? cfetch(buildApiUrl("/api/connect/wallet"), { headers: authHeaders }).then((r) => r.json())
                : Promise.resolve({ ok: false }),
        ])
            .then(([cdR, fdR, wdR]) => {
                const cd = cdR.status === "fulfilled" ? cdR.value : { ok: false };
                const fd = fdR.status === "fulfilled" ? fdR.value : { ok: false, favorites: [] };
                const wd = wdR.status === "fulfilled" ? wdR.value : { ok: false };
                if (cd.ok) {
                    setConsultants(cd.consultants ?? []);
                    setHasMore(1 < (cd.totalPages ?? 1));
                    setPage(1);
                } else {
                    setFetchFailed(true);
                }
                if (fd.ok) setFavorites(new Set(fd.favorites ?? []));
                if (wd.ok) { setWalletBalance(Math.max(0, Number(wd.wallet_balance ?? 0))); setWalletCurrency(wd.wallet_currency ?? "INR"); }
            })
            .finally(() => { setLoading(false); setRefreshing(false); });
    }, [accessToken, filterOnline, filterCategory, refreshKey]);

    async function loadMoreConsultants() {
        if (!hasMore || loadingMore) return;
        const nextPage = page + 1;
        setLoadingMore(true);
        const params = new URLSearchParams();
        if (filterOnline)   params.set("online", "true");
        if (filterCategory) params.set("category", filterCategory);
        params.set("page", String(nextPage));
        const authHeaders: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        try {
            const r = await cfetch(buildApiUrl(`/api/connect/consultants?${params}`), { headers: authHeaders });
            const cd = await r.json();
            if (cd.ok) {
                setConsultants((prev) => [...prev, ...(cd.consultants ?? [])]);
                setHasMore(nextPage < (cd.totalPages ?? 1));
                setPage(nextPage);
            }
        } catch { /* silent */ }
        finally { setLoadingMore(false); }
    }

    // Keep is_online and is_busy accurate in real-time so browse cards reflect
    // whether a consultant is live-online and whether they are in an active session.
    useEffect(() => {
        const channel = supabase
            .channel("connect:consultants:online")
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "connect_consultants", filter: undefined },
                (payload) => {
                    const updated = payload.new as { id?: string; is_online?: boolean; is_busy?: boolean };
                    if (!updated?.id) return;
                    setConsultants((prev) =>
                        prev.map((c) => {
                            if (c.id !== updated.id) return c;
                            const patch: Partial<typeof c> = {};
                            if (typeof updated.is_online === "boolean") patch.is_online = updated.is_online;
                            if (typeof updated.is_busy   === "boolean") patch.is_busy   = updated.is_busy;
                            return Object.keys(patch).length ? { ...c, ...patch } : c;
                        })
                    );
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    async function toggleFavorite(consultantId: string) {
        if (!accessToken) return;
        if (favLoading === consultantId) return;
        const isFav = favorites.has(consultantId);
        setFavLoading(consultantId);
        try {
            const res = await cfetch(buildApiUrl("/api/connect/favorites"), {
                method: isFav ? "DELETE" : "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ consultant_id: consultantId }),
            });
            const d = await res.json().catch(() => null);
            if (!res.ok || !d?.ok) {
                Alert.alert("Error", d?.error ?? "Could not update favourite. Please try again.");
                return;
            }
            setFavorites((prev) => {
                const next = new Set(prev);
                if (isFav) next.delete(consultantId); else next.add(consultantId);
                return next;
            });
        } catch {
            Alert.alert("Error", "Could not update favourite. Please try again.");
        } finally { setFavLoading(null); }
    }

    const displayed = consultants
        .filter((c) => !filterTag || c.expertise_tags.includes(filterTag))
        .sort((a, b) => {
            if (sort === "rating")     return (b.rating_avg || 0) - (a.rating_avg || 0);
            if (sort === "price_asc")  return (a.rate_per_min ?? 0) - (b.rate_per_min ?? 0);
            if (sort === "price_desc") return (b.rate_per_min ?? 0) - (a.rate_per_min ?? 0);
            if (sort === "sessions")   return b.sessions_completed - a.sessions_completed;
            return 0;
        });

    const sym = CURRENCY_SYMBOLS[walletCurrency] ?? "₹";

    if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;
    if (consultants.length === 0) return (
        <View style={s.center}>
            {fetchFailed ? (
                <>
                    <Text style={s.emptyText}>Could not load companions.</Text>
                    <Text style={[s.emptyText, { marginTop: 4, fontSize: 12, opacity: 0.6 }]}>Check your connection and try again.</Text>
                    <TouchableOpacity onPress={() => { setLoading(true); setRefreshKey((k) => k + 1); }} style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(139,92,246,0.2)", borderWidth: 1, borderColor: "rgba(139,92,246,0.4)" }}>
                        <Text style={{ color: "#a78bfa", fontSize: 13, fontWeight: "600" }}>Retry</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    <Text style={s.emptyText}>No companions online right now.</Text>
                    <Text style={[s.emptyText, { marginTop: 4, fontSize: 12, opacity: 0.6 }]}>Check back soon.</Text>
                </>
            )}
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            {/* Wallet balance bar */}
            {accessToken && walletBalance !== null && (
                <TouchableOpacity
                    onPress={onOpenWallet}
                    style={{ marginHorizontal: 12, marginTop: 10, marginBottom: 2, borderRadius: 12, borderWidth: 1, borderColor: "rgba(139,92,246,0.3)", backgroundColor: "rgba(139,92,246,0.08)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 9 }}>
                    <Text style={{ fontSize: 13, color: "#a78bfa" }}>💰 Wallet balance</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#a78bfa" }}>{sym}{walletBalance.toFixed(2)}</Text>
                        <Text style={{ fontSize: 11, color: "#a78bfa", opacity: 0.7 }}>+ Add →</Text>
                    </View>
                </TouchableOpacity>
            )}

            {/* Sign-in banner for unauthenticated users */}
            {!accessToken && (
                <View style={{ marginHorizontal: 12, marginTop: 10, marginBottom: 4, borderRadius: 12, borderWidth: 1, borderColor: "rgba(139,92,246,0.35)", backgroundColor: "rgba(139,92,246,0.12)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text style={{ fontSize: 13, color: "#c4b5fd", flex: 1 }}>🔒 Sign in to book a session</Text>
                    <View style={{ flexDirection: "row", gap: 8, marginLeft: 10 }}>
                        <TouchableOpacity
                            disabled={isSigningIn}
                            onPress={async () => { setIsSigningIn(true); try { await signInWithGoogle(); } catch { Alert.alert("Sign in failed", "Please try again."); } finally { setIsSigningIn(false); } }}
                            style={{ backgroundColor: "rgba(139,92,246,0.7)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, opacity: isSigningIn ? 0.5 : 1 }}>
                            {isSigningIn ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>Google</Text>}
                        </TouchableOpacity>
                        {appleSignInAvailable && (
                            <TouchableOpacity
                                disabled={isSigningIn}
                                onPress={async () => { setIsSigningIn(true); try { await signInWithApple(); } catch { Alert.alert("Sign in failed", "Please try again."); } finally { setIsSigningIn(false); } }}
                                style={{ backgroundColor: "#000", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, opacity: isSigningIn ? 0.5 : 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>Apple</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}

            {/* Row 1: Category */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, gap: 8, flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                    style={[s.filterChip, !filterCategory && s.filterChipActive]}
                    onPress={() => setFilterCategory("")}>
                    <Text style={[s.filterChipText, !filterCategory && s.filterChipTextActive]}>All</Text>
                </TouchableOpacity>
                {ROLE_CATEGORIES.map((rc) => (
                    <TouchableOpacity key={rc.key} disabled={rc.phase > 1}
                        style={[s.filterChip, filterCategory === rc.key && s.filterChipActive, rc.phase > 1 && { opacity: 0.4 }]}
                        onPress={() => rc.phase === 1 && setFilterCategory((v) => (v === rc.key ? "" : rc.key))}>
                        <Text style={[s.filterChipText, filterCategory === rc.key && s.filterChipTextActive]}>
                            {rc.icon} {rc.label}{rc.phase > 1 ? " · Soon" : ""}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Divider between filter rows */}
            <View style={{ height: 1, marginHorizontal: 16, backgroundColor: "rgba(255,255,255,0.06)" }} />

            {/* Row 2: Online + Sort + Topic */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 14, gap: 8, flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                    style={[s.filterChip, s.filterChipRow, filterOnline && s.filterChipActive]}
                    onPress={() => setFilterOnline((v) => !v)}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#34d399", marginRight: 6 }} />
                    <Text style={[s.filterChipText, filterOnline && s.filterChipTextActive]}>Online only</Text>
                </TouchableOpacity>
                {([
                    { key: "rating",     label: "Top rated" },
                    { key: "price_asc",  label: "Price ↑" },
                    { key: "price_desc", label: "Price ↓" },
                    { key: "sessions",   label: "Most sessions" },
                ] as const).map((opt) => (
                    <TouchableOpacity key={opt.key}
                        style={[s.filterChip, sort === opt.key && s.filterChipActive]}
                        onPress={() => setSort(opt.key)}>
                        <Text style={[s.filterChipText, sort === opt.key && s.filterChipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                ))}
                {["Stress & Anxiety", "Loneliness", "Grief & Loss", "Relationship Issues", "Work & Career Pressure", "Mindfulness"].map((tag) => (
                    <TouchableOpacity key={tag}
                        style={[s.filterChip, filterTag === tag && s.filterChipActive]}
                        onPress={() => setFilterTag((v) => (v === tag ? "" : tag))}>
                        <Text style={[s.filterChipText, filterTag === tag && s.filterChipTextActive]}>{tag}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <FlatList
                data={displayed}
                keyExtractor={(c) => c.id}
                contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 20, gap: 12 }}
                onEndReached={loadMoreConsultants}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={
                    consultants.length > 0 ? (
                        <View style={[s.center, { paddingTop: 40 }]}>
                            <Text style={s.emptyText}>No companions match this filter.</Text>
                            <Text style={[s.emptyText, { marginTop: 4, fontSize: 12, opacity: 0.6 }]}>Try a different specialty or remove filters.</Text>
                        </View>
                    ) : null
                }
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setRefreshKey((k) => k + 1); }} tintColor={colors.primary} />}
                renderItem={({ item: c }) => (
                    <TouchableOpacity style={s.card} onPress={() => onSelectConsultant(c)} activeOpacity={0.78}>
                        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                            <View style={{ position: "relative" }}>
                                <View style={s.avatar}>
                                    {c.photo_url
                                        ? <Image source={{ uri: c.photo_url }} style={s.avatarImg} />
                                        : <Text style={{ fontSize: 28 }}>{c.gender === "female" ? "👩" : "👨"}</Text>}
                                </View>
                                {c.is_online && <View style={s.onlineDot} />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                    <Text style={s.cardName}>{c.display_name}</Text>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                        <Text style={s.rateText}>{CURRENCY_SYMBOLS[c.currency_code] ?? c.currency_code}{c.rate_per_min ?? "—"}/min</Text>
                                        {/* Favorite heart button */}
                                        <TouchableOpacity onPress={() => toggleFavorite(c.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Text style={{ fontSize: 16, opacity: favLoading === c.id ? 0.4 : 1 }}>
                                                {favorites.has(c.id) ? "❤️" : "🤍"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                {c.role_category && (() => {
                                    const rc = ROLE_CATEGORIES.find(r => r.key === c.role_category);
                                    return rc ? (
                                        <Text style={{ fontSize: 10, color: "#a78bfa", marginTop: 2 }} numberOfLines={1}>
                                            {rc.icon} {rc.label}
                                        </Text>
                                    ) : null;
                                })()}
                                <Text style={[s.ratingText, { marginTop: 2 }]}>
                                    ★ {c.rating_avg > 0 ? c.rating_avg.toFixed(1) : "New"} · {c.sessions_completed} sessions
                                </Text>
                                {c.bio && (
                                    <Text style={[s.cardBio, { marginTop: 4 }]} numberOfLines={2}>{c.bio}</Text>
                                )}
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                                    {c.expertise_tags.slice(0, 3).map((t) => (
                                        <Text key={t} style={s.tag}>{t}</Text>
                                    ))}
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.is_online ? "#34d399" : "#475569" }} />
                                    <Text style={{ fontSize: 12, color: c.is_online ? "#34d399" : "#64748b", fontWeight: "500" }}>
                                        {c.is_online ? "Online" : "Offline"}
                                        {c.is_busy ? " · In session" : ""}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListFooterComponent={
                    <>
                        {loadingMore && <ActivityIndicator color={colors.primary} style={{ paddingVertical: 16 }} />}
                        <Text style={{ fontSize: 11, color: "#64748b", textAlign: "center", paddingVertical: 16, paddingHorizontal: 16 }}>
                            Peer wellness support only — not a substitute for professional mental health care.
                        </Text>
                    </>
                }
            />
        </View>
    );
}

// ── Sessions Tab ───────────────────────────────────────────────────────────────
function SessionsTab({ colors, accessToken, onSelectSession }: {
    colors: any; accessToken: string | null;
    onSelectSession: (s: Session) => void;
}) {
    const { signInWithGoogle, signInWithApple, appleSignInAvailable } = useAuth();
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchFailed, setFetchFailed] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [summaryCopied, setSummaryCopied] = useState<string | null>(null);
    const s = styles(colors);

    async function refreshSessions() {
        if (!accessToken) return;
        setRefreshing(true);
        try {
            const r = await cfetch(buildApiUrl("/api/connect/sessions"), { headers: { Authorization: `Bearer ${accessToken}` } });
            const d = await r.json();
            if (d.ok && d.sessions) { setSessions(d.sessions); setFetchFailed(false); }
            else setFetchFailed(true);
        } catch { setFetchFailed(true); }
        finally { setRefreshing(false); }
    }

    function buildSummary(item: Session) {
        const companion = item.connect_consultants?.display_name ?? "Companion";
        const date = new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
        const duration = item.minutes_used > 0 ? `${Math.round(item.minutes_used)} min` : "< 1 min";
        const sym = CURRENCY_SYMBOLS[item.currency_code ?? "INR"] ?? "₹";
        const cost = item.amount_charged != null ? `${sym}${Number(item.amount_charged).toFixed(2)}` : "—";
        return [
            `Imotara Connect — Session Summary`,
            `Date: ${date}`,
            `Companion: ${companion}`,
            `Type: ${item.type === "instant" ? "Instant" : "Scheduled"}`,
            `Duration: ${duration}`,
            `Cost: ${cost}`,
            ``,
            `Imotara — Mindful wellness with human connection`,
        ].join("\n");
    }

    async function shareSummary(item: Session) {
        const { Share } = require("react-native");
        try {
            await Share.share({ message: buildSummary(item), title: "Session Summary" });
        } catch {
            /* user cancelled */
        }
    }

    useEffect(() => {
        if (!accessToken) { setLoading(false); return; }
        cfetch(buildApiUrl("/api/connect/sessions"), {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
            .then((r) => r.json())
            .then((d) => { if (d.ok && d.sessions) setSessions(d.sessions); else setFetchFailed(true); })
            .catch(() => setFetchFailed(true))
            .finally(() => setLoading(false));
    }, [accessToken]);

    async function cancelSession(id: string) {
        if (!accessToken) return;
        setCancelling(id);
        try {
            const res = await cfetch(buildApiUrl(`/api/connect/sessions/${id}`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ action: "cancel" }),
            });
            const d = await res.json();
            if (d.ok) setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: "cancelled" } : s));
            else {
                Alert.alert("Error", d.error ?? "Could not cancel");
                if (res.status === 409) {
                    // Re-fetch to get the true session state (may now be active if consultant accepted)
                    const r2 = await cfetch(buildApiUrl("/api/connect/sessions"), { headers: { Authorization: `Bearer ${accessToken}` } });
                    const d2 = await r2.json();
                    if (d2.ok && d2.sessions) setSessions(d2.sessions);
                }
            }
        } catch {
            Alert.alert("Error", "Network error");
        } finally {
            setCancelling(null);
        }
    }

    if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;
    if (!accessToken) return (
        <View style={[s.center, { paddingHorizontal: 32 }]}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>🔒</Text>
            <Text style={[s.emptyText, { marginBottom: 6 }]}>Sign in to view your sessions</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", marginBottom: 24, opacity: 0.7 }}>Your past and upcoming sessions with companions will appear here.</Text>
            <TouchableOpacity
                disabled={isSigningIn}
                onPress={async () => { setIsSigningIn(true); try { await signInWithGoogle(); } catch { Alert.alert("Sign in failed", "Please try again."); } finally { setIsSigningIn(false); } }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, paddingHorizontal: 20, paddingVertical: 12, width: "100%", opacity: isSigningIn ? 0.5 : 1 }}>
                {isSigningIn ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ fontSize: 18 }}>G</Text>}
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, flex: 1, textAlign: "center" }}>{isSigningIn ? "Signing in…" : "Continue with Google"}</Text>
            </TouchableOpacity>
            {appleSignInAvailable && (
                <TouchableOpacity
                    disabled={isSigningIn}
                    onPress={async () => { setIsSigningIn(true); try { await signInWithApple(); } catch { Alert.alert("Sign in failed", "Please try again."); } finally { setIsSigningIn(false); } }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, paddingHorizontal: 20, paddingVertical: 12, width: "100%", marginTop: 10, opacity: isSigningIn ? 0.5 : 1 }}>
                    <Text style={{ fontSize: 18 }}></Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, flex: 1, textAlign: "center" }}>Continue with Apple</Text>
                </TouchableOpacity>
            )}
        </View>
    );
    if (fetchFailed) return (
        <View style={s.center}>
            <Text style={s.emptyText}>Could not load sessions. Check your connection.</Text>
            <TouchableOpacity onPress={() => { setFetchFailed(false); setLoading(true); refreshSessions().finally(() => setLoading(false)); }} style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: "#7c3aed" }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Retry</Text>
            </TouchableOpacity>
        </View>
    );
    if (sessions.length === 0) return (
        <View style={s.center}><Text style={s.emptyText}>No sessions yet. Browse companions to start.</Text></View>
    );

    const STATUS_COLORS: Record<string, string> = {
        active: "#34d399", pending: "#fbbf24", completed: colors.textSecondary,
        cancelled: "#f87171", declined: "#f87171",
    };

    const STATUS_ORDER: Record<string, number> = { active: 0, pending: 1 };
    const sortedSessions = [...sessions].sort((a, b) => (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2));

    return (
        <FlatList
            data={sortedSessions}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshSessions} tintColor={colors.primary} />}
            renderItem={({ item }) => (
                <View style={s.card}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => onSelectSession(item)} activeOpacity={0.75}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={s.cardName}>
                                {item.connect_consultants?.display_name ?? "Companion"}
                            </Text>
                            <Text style={[s.badge, { backgroundColor: "transparent", color: STATUS_COLORS[item.status] ?? colors.textSecondary }]}>
                                {item.status}
                            </Text>
                        </View>
                        <Text style={[s.cardBio, { marginTop: 2 }]}>
                            {new Date(item.created_at).toLocaleDateString()} · {(item.minutes_used ?? 0).toFixed(0)} min used
                        </Text>
                        {item.scheduled_note && <Text style={[s.cardBio, { opacity: 0.7, fontStyle: "italic" }]} numberOfLines={1}>{item.scheduled_note}</Text>}
                    </TouchableOpacity>
                    {item.status === "pending" && (
                        <TouchableOpacity
                            style={{ marginTop: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(248,113,113,0.4)", alignItems: "center" }}
                            onPress={() => {
                                Alert.alert("Cancel Session", "Cancel this pending session request?", [
                                    { text: "No" },
                                    { text: "Yes, Cancel", style: "destructive", onPress: () => cancelSession(item.id) },
                                ]);
                            }}
                            disabled={cancelling === item.id}>
                            {cancelling === item.id
                                ? <ActivityIndicator color="#f87171" size="small" />
                                : <Text style={{ color: "#f87171", fontWeight: "600", fontSize: 13 }}>Cancel Request</Text>}
                        </TouchableOpacity>
                    )}
                    {item.status === "active" && (
                        <TouchableOpacity
                            style={{ marginTop: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(52,211,153,0.5)", alignItems: "center", backgroundColor: "rgba(52,211,153,0.08)" }}
                            onPress={() => onSelectSession(item)}>
                            <Text style={{ color: "#34d399", fontWeight: "700", fontSize: 13 }}>🔴 Session Active — Return Now</Text>
                        </TouchableOpacity>
                    )}
                    {item.status === "completed" && (
                        <TouchableOpacity
                            style={{ marginTop: 8, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(139,92,246,0.4)", alignItems: "center", backgroundColor: "rgba(139,92,246,0.08)" }}
                            onPress={() => shareSummary(item)}
                        >
                            <Text style={{ color: "#a78bfa", fontWeight: "600", fontSize: 12 }}>📋 Share Session Summary</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        />
    );
}

// ── Wallet Tab ─────────────────────────────────────────────────────────────────
const TOPUP_PRESETS = [1000, 2000, 5000, 10000];

// Defined at module scope so React sees a stable component type and does NOT unmount/remount
// the TextInput inside on every WalletTab re-render (which would lose keyboard focus).
function TopUpForm({ label, colors, s, topupAmount, setTopupAmount, isCustom, setIsCustom, customAmount,
    setCustomAmount, ageConfirmed, setAgeConfirmed, termsAccepted, setTermsAccepted, topupError, setTopupError, topupLoading, handleTopUp, isDormant }: {
    label: string; colors: any; s: any;
    topupAmount: number; setTopupAmount: (v: number) => void;
    isCustom: boolean; setIsCustom: (v: boolean | ((p: boolean) => boolean)) => void;
    customAmount: string; setCustomAmount: (v: string) => void;
    ageConfirmed: boolean; setAgeConfirmed: (v: boolean | ((p: boolean) => boolean)) => void;
    termsAccepted: boolean; setTermsAccepted: (v: boolean | ((p: boolean) => boolean)) => void;
    topupError: string; setTopupError: (v: string) => void;
    topupLoading: boolean; handleTopUp: () => void; isDormant: boolean;
}) {
    return (
        <View style={s.card}>
            <Text style={[s.cardName, { marginBottom: 12 }]}>{label}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {TOPUP_PRESETS.map((p) => (
                    <TouchableOpacity key={p}
                        style={[s.durationBtn, !isCustom && topupAmount === p && s.durationBtnActive, { flex: 0, paddingHorizontal: 16 }]}
                        onPress={() => { setIsCustom(false); setTopupAmount(p); setTopupError(""); }}>
                        <Text style={[s.durationBtnText, !isCustom && topupAmount === p && s.durationBtnTextActive]} numberOfLines={1}>
                            ₹{p.toLocaleString("en-IN")}
                        </Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity
                    style={[s.durationBtn, isCustom && s.durationBtnActive, { flex: 0, paddingHorizontal: 16 }]}
                    onPress={() => { setIsCustom(true); setTopupError(""); }}>
                    <Text style={[s.durationBtnText, isCustom && s.durationBtnTextActive]} numberOfLines={1}>Custom</Text>
                </TouchableOpacity>
            </View>
            {isCustom && (
                <TextInput
                    style={[s.messageInput, { marginBottom: 10 }]}
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    placeholder="Enter amount (₹)"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                />
            )}
            {/* Age confirmation */}
            <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}
                onPress={() => setAgeConfirmed((v) => !v)}
                activeOpacity={0.7}>
                <View style={{
                    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
                    borderColor: ageConfirmed ? colors.primary : colors.border,
                    backgroundColor: ageConfirmed ? colors.primary : "transparent",
                    alignItems: "center", justifyContent: "center",
                }}>
                    {ageConfirmed && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                </View>
                <Text style={[s.cardBio, { fontSize: 12, flex: 1 }]}>
                    I confirm I am 18 years of age or older.
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 }}
                onPress={() => setTermsAccepted((v) => !v)}
                activeOpacity={0.7}>
                <View style={{
                    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
                    borderColor: termsAccepted ? colors.primary : colors.border,
                    backgroundColor: termsAccepted ? colors.primary : "transparent",
                    alignItems: "center", justifyContent: "center", marginTop: 2,
                }}>
                    {termsAccepted && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                </View>
                <Text style={[s.cardBio, { fontSize: 12, flex: 1 }]}>
                    I accept the{" "}
                    <Text style={{ color: colors.primary, textDecorationLine: "underline" }}
                        onPress={() => Linking.openURL("https://imotara.com/connect/wallet-terms")}>
                        Wallet Terms & Policy
                    </Text>
                    {" "}including the 2-year inactivity and dormancy rules.
                </Text>
            </TouchableOpacity>
            {topupError !== "" && <Text style={[s.errorText, { marginBottom: 8 }]}>{topupError}</Text>}
            <TouchableOpacity
                style={[s.primaryBtn, (topupLoading || !ageConfirmed || !termsAccepted || (isCustom && (!customAmount || parseFloat(customAmount) < 1))) && { opacity: 0.5 }]}
                onPress={handleTopUp}
                disabled={topupLoading || !ageConfirmed || !termsAccepted || (isCustom && (!customAmount || parseFloat(customAmount) < 1))}>
                {topupLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.primaryBtnText}>
                        {isDormant ? "Reactivate & Add " : "Add "}
                        ₹{isCustom ? (customAmount || "0") : topupAmount.toLocaleString("en-IN")} to Wallet
                    </Text>}
            </TouchableOpacity>
        </View>
    );
}

function WalletTab({ colors, accessToken }: { colors: any; accessToken: string | null }) {
    const { signInWithGoogle, signInWithApple, appleSignInAvailable } = useAuth();
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [walletBalance, setWalletBalance] = useState(0);
    const [walletStatus, setWalletStatus] = useState("active");
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [walletFetchFailed, setWalletFetchFailed] = useState(false);

    const [topupAmount, setTopupAmount] = useState(1000);
    const [customAmount, setCustomAmount] = useState("");
    const [isCustom, setIsCustom] = useState(false);
    const [ageConfirmed, setAgeConfirmed] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [topupLoading, setTopupLoading] = useState(false);
    const [topupError, setTopupError] = useState("");

    const [showRefund, setShowRefund] = useState(false);
    const [refundMethod, setRefundMethod] = useState<"upi" | "bank">("upi");
    const [refundUpi, setRefundUpi] = useState("");
    const [refundBank, setRefundBank] = useState({ name: "", account: "", ifsc: "", holder: "" });
    const [refundLoading, setRefundLoading] = useState(false);
    const [refundResult, setRefundResult] = useState<{ ok: boolean; ref?: string; error?: string } | null>(null);

    const [transactions, setTransactions] = useState<WalletTx[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);

    const s = styles(colors);

    useEffect(() => {
        if (!accessToken) { setLoading(false); return; }
        cfetch(buildApiUrl("/api/connect/wallet"), {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
            .then((r) => r.json())
            .then((d) => {
                if (!d.ok) return;
                setWalletBalance(Math.max(0, Number(d.wallet_balance ?? 0)));
                setWalletStatus(d.wallet_status ?? "active");
                setExpiresAt(d.expires_at ?? null);
                setDaysUntilExpiry(d.days_until_expiry ?? null);
            })
            .catch(() => setWalletFetchFailed(true))
            .finally(() => setLoading(false));
    }, [accessToken]);

    async function loadHistory() {
        if (showHistory) { setShowHistory(false); return; }
        if (transactions.length > 0) { setShowHistory(true); return; }
        setShowHistory(true);
        setHistoryLoading(true);
        try {
            const res = await cfetch(buildApiUrl("/api/connect/wallet/history"), {
                headers: { Authorization: `Bearer ${accessToken ?? ""}` },
            });
            const d = await res.json();
            if (!res.ok || !d.ok) {
                setShowHistory(false);
                Alert.alert("Error", d?.error ?? "Could not load transaction history. Please try again.");
                return;
            }
            setTransactions(d.transactions ?? []);
        } catch {
            setShowHistory(false);
            Alert.alert("Error", "Could not load transaction history. Please try again.");
        }
        finally { setHistoryLoading(false); }
    }

    async function handleTopUp() {
        const amt = isCustom ? parseFloat(customAmount) : topupAmount;
        if (!accessToken || isNaN(amt) || amt < 1) { setTopupError("Enter a valid amount"); return; }
        if (!ageConfirmed) { setTopupError("Please confirm you are 18 or older to continue"); return; }
        if (!termsAccepted) { setTopupError("Please accept the Wallet Terms to continue"); return; }
        setTopupLoading(true); setTopupError("");
        try {
            const res = await pfetch(buildApiUrl("/api/connect/wallet/topup/create"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ amount: amt, terms_accepted: true }),
            });
            const d = await res.json();
            if (!d.ok) { setTopupError(d.error ?? "Failed to create order"); return; }

            const RazorpayCheckout = require("react-native-razorpay").default;
            const paymentData = await RazorpayCheckout.open({
                key: d.razorpay_key_id ?? process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
                order_id: d.razorpay_order_id,
                amount: String(d.amount_paise),
                currency: "INR",
                name: "Imotara Wallet",
                description: `Add ₹${amt} to your wallet`,
                theme: { color: "#6366f1" },
            });

            const verifyRes = await pfetch(buildApiUrl("/api/connect/wallet/topup/verify"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({
                    razorpay_order_id:   paymentData.razorpay_order_id,
                    razorpay_payment_id: paymentData.razorpay_payment_id,
                    razorpay_signature:  paymentData.razorpay_signature,
                }),
            });
            const v = await verifyRes.json();
            if (!v.ok) { setTopupError(v.error ?? "Verification failed"); return; }
            setWalletBalance(Math.max(0, Number(v.new_balance ?? 0)));
            setWalletStatus("active");
            // Refresh expiry data — topup resets the wallet expiry on the server but the
            // verify response only includes new_balance. Fetch fresh wallet data so the
            // expiry banner immediately reflects the new expiry date.
            void cfetch(buildApiUrl("/api/connect/wallet"), {
                headers: { Authorization: `Bearer ${accessToken}` },
            }).then((r) => r.json()).then((d) => {
                if (!d.ok) return;
                setExpiresAt(d.expires_at ?? null);
                setDaysUntilExpiry(d.days_until_expiry ?? null);
            }).catch(() => {});
            setTransactions([]);
            setShowHistory(false);
            Alert.alert("Success", `₹${v.amount_credited ?? "?"} added to your wallet!`);
        } catch (err: any) {
            if (err?.code !== 0 && !String(err?.description ?? "").toLowerCase().includes("cancel")) {
                setTopupError(String(err?.message ?? "Payment failed"));
            }
        } finally {
            setTopupLoading(false);
        }
    }

    async function handleRefundRequest() {
        if (!accessToken) return;
        const isUpi = refundMethod === "upi";
        if (isUpi && !refundUpi.trim()) { Alert.alert("Error", "Please enter your UPI ID"); return; }
        if (!isUpi && (!refundBank.account || !refundBank.ifsc || !refundBank.holder)) {
            Alert.alert("Error", "Please fill in all bank details"); return;
        }
        setRefundLoading(true);
        try {
            const body = isUpi
                ? { upi_id: refundUpi }
                : { bank_name: refundBank.name, account_number: refundBank.account, ifsc_code: refundBank.ifsc, account_holder: refundBank.holder };
            const res = await pfetch(buildApiUrl("/api/connect/wallet/refund-request"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify(body),
            });
            const d = await res.json();
            setRefundResult({ ok: d.ok, ref: d.reference_number, error: d.error });
            if (d.ok) setWalletStatus("refund_requested");
        } catch {
            setRefundResult({ ok: false, error: "Request failed. Please try again." });
        } finally {
            setRefundLoading(false);
        }
    }

    if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;
    if (walletFetchFailed) return (
        <View style={s.center}>
            <Text style={s.emptyText}>Could not load wallet. Check your connection.</Text>
            <TouchableOpacity onPress={() => { setWalletFetchFailed(false); setLoading(true); cfetch(buildApiUrl("/api/connect/wallet"), { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json()).then((d) => { if (!d.ok) return; setWalletBalance(Math.max(0, Number(d.wallet_balance ?? 0))); setWalletStatus(d.wallet_status ?? "active"); setExpiresAt(d.expires_at ?? null); setDaysUntilExpiry(d.days_until_expiry ?? null); }).catch(() => setWalletFetchFailed(true)).finally(() => setLoading(false)); }} style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: "#7c3aed" }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Retry</Text>
            </TouchableOpacity>
        </View>
    );
    if (!accessToken) return (
        <View style={[s.center, { paddingHorizontal: 32 }]}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>🔒</Text>
            <Text style={[s.emptyText, { marginBottom: 6 }]}>Sign in to use your Wallet</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", marginBottom: 24, opacity: 0.7 }}>Add funds and pay for sessions with your Imotara Wallet.</Text>
            <TouchableOpacity
                disabled={isSigningIn}
                onPress={async () => { setIsSigningIn(true); try { await signInWithGoogle(); } catch { Alert.alert("Sign in failed", "Please try again."); } finally { setIsSigningIn(false); } }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, paddingHorizontal: 20, paddingVertical: 12, width: "100%", opacity: isSigningIn ? 0.5 : 1 }}>
                {isSigningIn ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ fontSize: 18 }}>G</Text>}
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, flex: 1, textAlign: "center" }}>{isSigningIn ? "Signing in…" : "Continue with Google"}</Text>
            </TouchableOpacity>
            {appleSignInAvailable && (
                <TouchableOpacity
                    disabled={isSigningIn}
                    onPress={async () => { setIsSigningIn(true); try { await signInWithApple(); } catch { Alert.alert("Sign in failed", "Please try again."); } finally { setIsSigningIn(false); } }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, paddingHorizontal: 20, paddingVertical: 12, width: "100%", marginTop: 10, opacity: isSigningIn ? 0.5 : 1 }}>
                    <Text style={{ fontSize: 18 }}></Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, flex: 1, textAlign: "center" }}>Continue with Apple</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    const isDormant = walletStatus === "dormant";
    const isRefundRequested = walletStatus === "refund_requested";

    return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {/* Balance card */}
            <View style={[s.card, { padding: 20, alignItems: "center" }]}>
                <Text style={[s.cardBio, { marginBottom: 4 }]}>Imotara Wallet Balance</Text>
                <Text style={[s.cardName, { fontSize: 36, color: colors.primary }]}>
                    ₹{walletBalance.toFixed(2)}
                </Text>
                {expiresAt && !isDormant && (
                    <Text style={[s.cardBio, { fontSize: 11, marginTop: 4 }]}>
                        Active until {new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </Text>
                )}
            </View>

            {/* Expiry warning (≤30 days) */}
            {daysUntilExpiry !== null && daysUntilExpiry <= 30 && !isDormant && (
                <View style={[s.card, { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.35)", borderWidth: 1 }]}>
                    <Text style={{ color: "#f59e0b", fontWeight: "700", fontSize: 13 }}>
                        ⚠ Wallet expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""}
                    </Text>
                    <Text style={[s.cardBio, { fontSize: 12, marginTop: 4 }]}>
                        Top up or book a session to reset the 2-year inactivity clock.
                    </Text>
                </View>
            )}

            {/* Dormant notice */}
            {isDormant && (
                <View style={[s.card, { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)", borderWidth: 1 }]}>
                    <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 13 }}>Wallet Dormant</Text>
                    <Text style={[s.cardBio, { fontSize: 12, marginTop: 4 }]}>
                        2 years of inactivity. Your ₹{walletBalance.toFixed(2)} is safe — reactivate with a top-up or request a cash refund below.
                    </Text>
                </View>
            )}

            {/* Refund-requested notice */}
            {isRefundRequested && (
                <View style={[s.card, { backgroundColor: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.3)", borderWidth: 1 }]}>
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Refund Request Submitted</Text>
                    <Text style={[s.cardBio, { fontSize: 12, marginTop: 4 }]}>
                        Processing in progress. You'll receive an email confirmation within 7 business days.
                    </Text>
                </View>
            )}

            {/* Top-up form */}
            {!isRefundRequested && (
                <TopUpForm
                    label={isDormant ? "Reactivate Wallet" : "Add Money to Wallet"}
                    colors={colors} s={s}
                    topupAmount={topupAmount} setTopupAmount={setTopupAmount}
                    isCustom={isCustom} setIsCustom={setIsCustom}
                    customAmount={customAmount} setCustomAmount={setCustomAmount}
                    ageConfirmed={ageConfirmed} setAgeConfirmed={setAgeConfirmed}
                    termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted}
                    topupError={topupError} setTopupError={setTopupError}
                    topupLoading={topupLoading} handleTopUp={handleTopUp}
                    isDormant={isDormant}
                />
            )}

            {/* Dormant refund panel */}
            {isDormant && !isRefundRequested && (
                <View style={s.card}>
                    <TouchableOpacity
                        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                        onPress={() => setShowRefund((v) => !v)}
                        activeOpacity={0.7}>
                        <Text style={[s.cardName, { fontSize: 14 }]}>💸 Request Refund Instead</Text>
                        <Text style={s.cardBio}>{showRefund ? "▲" : "▼"}</Text>
                    </TouchableOpacity>

                    {showRefund && (
                        <View style={{ marginTop: 12 }}>
                            {refundResult ? (
                                refundResult.ok ? (
                                    <View style={{ alignItems: "center", gap: 8 }}>
                                        <Text style={{ color: "#34d399", fontWeight: "700", fontSize: 15 }}>Refund Request Sent!</Text>
                                        <Text style={s.cardBio}>Reference: {refundResult.ref}</Text>
                                        <Text style={[s.cardBio, { textAlign: "center", fontSize: 12 }]}>
                                            We'll process your refund within 7 business days.
                                        </Text>
                                    </View>
                                ) : (
                                    <Text style={s.errorText}>{refundResult.error}</Text>
                                )
                            ) : (
                                <>
                                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                                        {(["upi", "bank"] as const).map((m) => (
                                            <TouchableOpacity key={m}
                                                style={[s.durationBtn, refundMethod === m && s.durationBtnActive, { flex: 1 }]}
                                                onPress={() => setRefundMethod(m)}>
                                                <Text style={[s.durationBtnText, refundMethod === m && s.durationBtnTextActive]}>
                                                    {m === "upi" ? "UPI" : "Bank Transfer"}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    {refundMethod === "upi" ? (
                                        <TextInput
                                            style={[s.messageInput, { marginBottom: 10 }]}
                                            value={refundUpi}
                                            onChangeText={setRefundUpi}
                                            placeholder="UPI ID (e.g. name@bank)"
                                            placeholderTextColor={colors.textSecondary}
                                            autoCapitalize="none"
                                        />
                                    ) : (
                                        <>
                                            <TextInput style={[s.messageInput, { marginBottom: 8 }]} value={refundBank.name} onChangeText={(v) => setRefundBank((b) => ({ ...b, name: v }))} placeholder="Bank name" placeholderTextColor={colors.textSecondary} />
                                            <TextInput style={[s.messageInput, { marginBottom: 8 }]} value={refundBank.account} onChangeText={(v) => setRefundBank((b) => ({ ...b, account: v }))} placeholder="Account number" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                                            <TextInput style={[s.messageInput, { marginBottom: 8 }]} value={refundBank.ifsc} onChangeText={(v) => setRefundBank((b) => ({ ...b, ifsc: v.toUpperCase() }))} placeholder="IFSC code" placeholderTextColor={colors.textSecondary} autoCapitalize="characters" />
                                            <TextInput style={[s.messageInput, { marginBottom: 10 }]} value={refundBank.holder} onChangeText={(v) => setRefundBank((b) => ({ ...b, holder: v }))} placeholder="Account holder name" placeholderTextColor={colors.textSecondary} />
                                        </>
                                    )}
                                    <TouchableOpacity
                                        style={[s.primaryBtn, refundLoading && { opacity: 0.6 }]}
                                        onPress={handleRefundRequest}
                                        disabled={refundLoading}>
                                        {refundLoading
                                            ? <ActivityIndicator color="#fff" />
                                            : <Text style={s.primaryBtnText}>Submit Refund Request</Text>}
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )}
                </View>
            )}

            {/* Policy summary */}
            <View style={[s.card, { padding: 14 }]}>
                <Text style={[s.cardBio, { fontSize: 12 }]}>
                    ✦ Balance active for 2 years from last top-up or session{"\n"}
                    ✦ 6 email reminders before dormancy{"\n"}
                    ✦ Dormant balance preserved — never zeroed{"\n"}
                    ✦ 1-year grace refund period after dormancy
                </Text>
                <Text style={{ color: colors.primary, fontSize: 11, marginTop: 6, textDecorationLine: "underline" }}
                    onPress={() => Linking.openURL("https://imotara.com/connect/wallet-terms")}>
                    Full Wallet Terms & Policy →
                </Text>
            </View>

            {/* Transaction history */}
            <TouchableOpacity style={s.card} onPress={loadHistory} activeOpacity={0.75}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[s.cardName, { fontSize: 14 }]}>🕓 Transaction History</Text>
                    <Text style={s.cardBio}>{showHistory ? "▲" : "▼"}</Text>
                </View>
            </TouchableOpacity>

            {showHistory && (
                <View>
                    {historyLoading ? (
                        <View style={{ paddingVertical: 20, alignItems: "center" }}>
                            <ActivityIndicator color={colors.primary} />
                        </View>
                    ) : transactions.length === 0 ? (
                        <Text style={[s.cardBio, { textAlign: "center", paddingVertical: 16 }]}>No transactions yet.</Text>
                    ) : (
                        transactions.map((t) => {
                            const isCredit = t.type === "topup" || t.type === "refund";
                            const isDormantEvt = t.type === "dormancy_marked";
                            return (
                                <View key={t.id} style={[s.card, { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }]}>
                                    <View style={{
                                        width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
                                        backgroundColor: isCredit ? "rgba(52,211,153,0.15)" : isDormantEvt ? "rgba(245,158,11,0.15)" : "rgba(248,113,113,0.15)",
                                    }}>
                                        <Text style={{ fontSize: 13 }}>
                                            {t.type === "topup" ? "↑" : t.type === "refund" ? "↩" : isDormantEvt ? "⏸" : "↓"}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.cardName, { fontSize: 13 }]}>{t.description}</Text>
                                        <Text style={[s.cardBio, { fontSize: 11 }]}>
                                            {new Date(t.created_at).toLocaleDateString("en-IN")}
                                        </Text>
                                    </View>
                                    <Text style={{
                                        fontSize: 13, fontWeight: "700",
                                        color: isCredit ? "#34d399" : isDormantEvt ? "#f59e0b" : "#f87171",
                                    }}>
                                        {isCredit ? "+" : isDormantEvt ? "" : "-"}₹{t.amount.toFixed(2)}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </View>
            )}
        </ScrollView>
    );
}

// ── Profile View ───────────────────────────────────────────────────────────────
function ProfileView({ consultant: c, colors, insets, accessToken, userId, onBack, onStartSession }: {
    consultant: Consultant; colors: any; insets: any;
    accessToken: string | null; userId: string | null;
    onBack: () => void; onStartSession: (s: Session) => void;
}) {
    const { isDark } = useTheme();
    const [topUpVisible, setTopUpVisible] = useState(false);
    const [rechargeBeforeStartVisible, setRechargeBeforeStartVisible] = useState(false);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [walletCurrency, setWalletCurrency] = useState("INR");
    const [loading, setLoading] = useState(false);
    const [scheduleVisible, setScheduleVisible] = useState(false);
    const [scheduleNote, setScheduleNote] = useState("");
    const [scheduleDateObj, setScheduleDateObj] = useState<Date | null>(null);
    const [scheduleTimeObj, setScheduleTimeObj] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [scheduleDuration, setScheduleDuration] = useState(30);
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [userLang, setUserLang] = useState("en");
    const [translationEnabled, setTranslationEnabled] = useState(false);
    const [pendingTranslation, setPendingTranslation] = useState(false);
    const [pendingSessionType, setPendingSessionType] = useState<"instant" | "scheduled">("instant");
    const [pendingNote, setPendingNote] = useState<string | undefined>(undefined);
    const s = styles(colors);
    const sym = CURRENCY_SYMBOLS[c.currency_code] ?? c.currency_code;
    const consultantLang = c.preferred_lang ?? "en";
    const langsMatch = userLang === consultantLang;
    const translationSurcharge = (translationEnabled && !langsMatch) ? c.rate_per_min * 0.10 : 0;
    const effectiveRate = c.rate_per_min + translationSurcharge;
    // Local online status — re-fetched on mount so stale browse-list data
    // doesn't leave Talk Now enabled for an offline consultant.
    const [isOnline, setIsOnline] = useState(c.is_online);
    const [isBusy, setIsBusy] = useState(c.is_busy ?? false);
    useEffect(() => {
        let mounted = true;
        cfetch(buildApiUrl(`/api/connect/consultants/${c.id}`))
            .then((r) => r.json())
            .then((d) => {
                if (mounted && d.ok && d.consultant) {
                    setIsOnline(!!d.consultant.is_online);
                    setIsBusy(!!d.consultant.is_busy);
                }
            })
            .catch(() => {});
        return () => { mounted = false; };
    }, [c.id]);

    useEffect(() => {
        if (!accessToken) return;
        cfetch(buildApiUrl("/api/connect/wallet"), { headers: { Authorization: `Bearer ${accessToken}` } })
            .then((r) => r.json())
            .then((d) => { if (d.ok) { setWalletBalance(Math.max(0, Number(d.wallet_balance ?? 0))); setWalletCurrency(d.wallet_currency ?? "INR"); } })
            .catch(() => {});
    }, [accessToken]);

    async function startSession(sessionType: "instant" | "scheduled" = "instant", note?: string, translationRequested = false) {
        if (!accessToken) { Alert.alert("Sign in required", "Please sign in to start a session."); return; }
        if (loading || scheduleLoading) return;
        if (sessionType === "instant") setLoading(true);
        else setScheduleLoading(true);
        try {
            const body: Record<string, unknown> = {
                consultant_id: c.id,
                type: sessionType,
                user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                user_lang: userLang,
                translation_requested: translationRequested,
            };
            if (note) body.scheduled_note = note;
            const scheduleDateStr = scheduleDateObj
                ? `${scheduleDateObj.getFullYear()}-${String(scheduleDateObj.getMonth()+1).padStart(2,"0")}-${String(scheduleDateObj.getDate()).padStart(2,"0")}`
                : "";
            const scheduleTimeStr = scheduleTimeObj
                ? `${String(scheduleTimeObj.getHours()).padStart(2,"0")}:${String(scheduleTimeObj.getMinutes()).padStart(2,"0")}`
                : "";
            if (sessionType === "scheduled" && scheduleDateStr) {
                const dateTimeStr = scheduleTimeStr
                    ? `${scheduleDateStr}T${scheduleTimeStr}`
                    : scheduleDateStr;
                const parsed = new Date(dateTimeStr);
                if (!isNaN(parsed.getTime())) {
                    body.scheduled_at = parsed.toISOString();
                    body.scheduled_duration_min = scheduleDuration;
                }
            }
            const res = await cfetch(buildApiUrl("/api/connect/sessions"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify(body),
            });
            const d = await res.json();
            if (!d.ok) {
                if (d.needs_recharge || res.status === 402 || d.error?.includes("Insufficient balance")) {
                    setPendingTranslation(translationRequested);
                    setPendingSessionType(sessionType);
                    setPendingNote(note);
                    setRechargeBeforeStartVisible(true);
                } else if (d.redirect && d.existing_session_id) {
                    // Fetch full session so rate_per_min and translation_enabled are correct
                    try {
                        const sr = await cfetch(buildApiUrl(`/api/connect/sessions/${d.existing_session_id}`), {
                            headers: { Authorization: `Bearer ${accessToken}` },
                        });
                        const sd = await sr.json();
                        if (sd.ok && sd.session) {
                            onStartSession(sd.session);
                        } else {
                            Alert.alert("Error", "Could not resume existing session.");
                        }
                    } catch {
                        Alert.alert("Error", "Network error resuming session.");
                    }
                } else {
                    Alert.alert("Error", d.error ?? "Could not start session");
                }
                return;
            }
            setScheduleVisible(false);
            onStartSession(d.session);
        } catch {
            Alert.alert("Error", "Network error — please try again.");
        } finally {
            setLoading(false);
            setScheduleLoading(false);
        }
    }

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={onBack} style={s.backBtn} disabled={loading || scheduleLoading}>
                    <Ionicons name="arrow-back" size={20} color={loading || scheduleLoading ? colors.textSecondary : colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>{c.display_name}</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                {/* Avatar + name */}
                <View style={{ alignItems: "center", gap: 10 }}>
                    <View style={{ position: "relative" }}>
                        <View style={[s.avatar, { width: 80, height: 80, borderRadius: 40 }]}>
                            {c.photo_url
                                ? <Image source={{ uri: c.photo_url }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                                : <Text style={{ fontSize: 44 }}>{c.gender === "female" ? "👩" : "👨"}</Text>
                            }
                        </View>
                        {isOnline && <View style={[s.onlineDot, { width: 14, height: 14, bottom: 2, right: 2 }]} />}
                    </View>
                    <Text style={[s.cardName, { fontSize: 20 }]}>{c.display_name}</Text>
                    {c.role_category && (() => {
                        const rc = ROLE_CATEGORIES.find(r => r.key === c.role_category);
                        return rc ? (
                            <Text style={{ fontSize: 12, color: "#a78bfa", marginTop: 2 }} numberOfLines={1}>
                                {rc.icon} {rc.label}
                            </Text>
                        ) : null;
                    })()}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                        {isBusy ? (
                            <Text style={{ fontSize: 12, color: "#fb923c", backgroundColor: "rgba(251,146,60,0.15)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>In Session</Text>
                        ) : isOnline ? (
                            <Text style={{ fontSize: 12, color: "#34d399", backgroundColor: "rgba(52,211,153,0.12)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>● Online now</Text>
                        ) : (
                            <Text style={{ fontSize: 12, color: "#94a3b8", backgroundColor: "rgba(148,163,184,0.1)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>Offline</Text>
                        )}
                    </View>
                    <Text style={[s.ratingText, { fontSize: 13, marginTop: 4 }]}>
                        ★ {c.rating_avg > 0 ? c.rating_avg.toFixed(1) : "New"} · {c.sessions_completed} sessions
                    </Text>
                </View>

                {c.bio && <View style={s.card}><Text style={s.cardBio}>{c.bio}</Text></View>}

                {/* Rate + wallet balance */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={[s.card, { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                        <Text style={s.cardName}>Rate</Text>
                        <Text style={[s.rateText, { fontSize: 18 }]}>{sym}{c.rate_per_min}/min</Text>
                    </View>
                    {accessToken && walletBalance !== null && (
                        <TouchableOpacity
                            onPress={() => setTopUpVisible(true)}
                            style={{ borderRadius: 14, borderWidth: 1, borderColor: "rgba(139,92,246,0.3)", backgroundColor: "rgba(139,92,246,0.08)", paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center", gap: 2 }}>
                            <Text style={{ fontSize: 10, color: "#a78bfa", fontWeight: "700" }}>Wallet</Text>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: "#a78bfa" }}>{CURRENCY_SYMBOLS[walletCurrency] ?? "₹"}{walletBalance.toFixed(0)}</Text>
                            <Text style={{ fontSize: 9, color: "#a78bfa", opacity: 0.7 }}>+ Add</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tags */}
                {c.expertise_tags.length > 0 && (
                    <View style={s.card}>
                        <Text style={[s.cardBio, { marginBottom: 8, fontWeight: "600" }]}>Specialties</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {c.expertise_tags.map((t) => <Text key={t} style={s.tag}>{t}</Text>)}
                        </View>
                    </View>
                )}

                {/* Languages */}
                {c.languages.length > 0 && (
                    <View style={s.card}>
                        <Text style={[s.cardBio, { marginBottom: 4, fontWeight: "600" }]}>Languages</Text>
                        <Text style={s.cardBio}>{c.languages.map(code => LANGUAGE_OPTIONS.find(l => l.code === code)?.label ?? code).join(", ")}</Text>
                    </View>
                )}

                {/* Session types */}
                {(c.session_types ?? []).length > 0 && (
                    <View style={s.card}>
                        <Text style={[s.cardBio, { marginBottom: 8, fontWeight: "600" }]}>Session Types</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            {(c.session_types ?? []).map((t) => (
                                <View key={t} style={{
                                    flexDirection: "row", alignItems: "center", gap: 6,
                                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                                    borderWidth: 1,
                                    borderColor: t === "chat" ? "rgba(96,165,250,0.4)" : t === "audio" ? "rgba(251,191,36,0.4)" : "rgba(167,139,250,0.4)",
                                    backgroundColor: t === "chat" ? "rgba(96,165,250,0.1)" : t === "audio" ? "rgba(251,191,36,0.1)" : "rgba(167,139,250,0.1)",
                                }}>
                                    <Text style={{ fontSize: 13 }}>
                                        {t === "chat" ? "💬" : t === "audio" ? "🎙️" : "📹"}
                                    </Text>
                                    <Text style={{
                                        fontSize: 12, fontWeight: "600",
                                        color: t === "chat" ? "#60a5fa" : t === "audio" ? "#fbbf24" : "#a78bfa",
                                    }}>
                                        {t === "chat" ? "Text / Chat" : t === "audio" ? "Audio Call" : "Video Call"}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {(c.availability_windows?.length || c.availability_note) && (
                    <View style={s.card}>
                        <Text style={[s.cardBio, { marginBottom: 8, fontWeight: "600" }]}>Availability</Text>
                        {c.availability_windows && c.availability_windows.length > 0 ? (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                {c.availability_windows.map((w: { day: string; start: string; end: string }, i: number) => (
                                    <View key={i} style={{ backgroundColor: "rgba(139,92,246,0.12)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4 }}>
                                        <Text style={[s.cardBio, { fontSize: 12, color: colors.primary }]}>🕐</Text>
                                        <Text style={[s.cardBio, { fontSize: 12 }]}>{w.day} {w.start}–{w.end}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={s.cardBio}>{c.availability_note}</Text>
                        )}
                    </View>
                )}

                <Text style={[s.disclaimer, { textAlign: "center" }]}>
                    Peer wellness support only — not a substitute for professional mental health care.
                </Text>

                {/* Talk Now */}
                <TouchableOpacity
                    style={[s.primaryBtn, (loading || !isOnline || isBusy || rechargeBeforeStartVisible) && { opacity: 0.6 }]}
                    onPress={() => {
                        if ((walletBalance ?? 0) < c.rate_per_min) {
                            setRechargeBeforeStartVisible(true);
                            return;
                        }
                        if (!langsMatch) {
                            Alert.alert(
                                "Enable Translation?",
                                `Your language and your counselor's language differ. Enable auto-translation for this session?\n\n+10% per-minute rate · 1–3s delay · Machine translation`,
                                [
                                    { text: "No, English only", style: "cancel", onPress: () => startSession("instant", undefined, false) },
                                    { text: "Yes, enable (+10%)", onPress: () => startSession("instant", undefined, true) },
                                ]
                            );
                        } else {
                            startSession("instant");
                        }
                    }}
                    disabled={loading || !isOnline || isBusy || rechargeBeforeStartVisible}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={s.primaryBtnText}>{!isOnline ? "Companion Offline" : isBusy ? "In a Session" : "Talk Now"}</Text>
                    }
                </TouchableOpacity>

                {/* Request Meeting (scheduled session) */}
                <TouchableOpacity
                    style={[s.primaryBtn, { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary }, (loading || scheduleLoading) && { opacity: 0.5 }]}
                    onPress={() => setScheduleVisible(true)}
                    disabled={loading || scheduleLoading}
                >
                    <Text style={[s.primaryBtnText, { color: colors.primary }]}>Request Meeting</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Wallet top-up modal (general INR wallet — triggered by "+" button only) */}
            <WalletTopUpModal
                visible={topUpVisible}
                accessToken={accessToken}
                walletBalance={walletBalance ?? 0}
                walletCurrency={walletCurrency}
                onClose={() => { setTopUpVisible(false); }}
                onSuccess={(newBal) => {
                    setWalletBalance(newBal);
                    setTopUpVisible(false);
                }}
                colors={colors}
            />

            {/* Per-consultant minute recharge — shown when session creation returns 402.
                Uses connect_recharges (not imotara_wallets); retry startSession on success. */}
            <SessionRechargeModal
                visible={rechargeBeforeStartVisible}
                accessToken={accessToken}
                consultantId={c.id}
                consultantName={c.display_name}
                currencyCode={c.currency_code ?? "INR"}
                ratePerMin={c.rate_per_min}
                onClose={() => { setRechargeBeforeStartVisible(false); }}
                onSuccess={() => {
                    setRechargeBeforeStartVisible(false);
                    startSession(pendingSessionType, pendingNote, pendingTranslation);
                }}
                colors={colors}
            />

            {/* Schedule session modal — keyboard-aware bottom sheet */}
            <Modal visible={scheduleVisible} transparent animationType="slide" onRequestClose={scheduleLoading ? undefined : () => setScheduleVisible(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    {/* Tap-to-dismiss backdrop — blocked during in-flight request to prevent ghost navigation */}
                    <TouchableOpacity
                        activeOpacity={1}
                        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}
                        onPress={scheduleLoading ? undefined : () => setScheduleVisible(false)}
                    />
                    <View style={[s.modalSheet, { backgroundColor: colors.surface, maxHeight: "90%" }]}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <Text style={[s.cardName, { fontSize: 18 }]}>Request a Meeting</Text>
                            <TouchableOpacity onPress={scheduleLoading ? undefined : () => setScheduleVisible(false)} disabled={scheduleLoading}>
                                <Ionicons name="close" size={20} color={scheduleLoading ? colors.textSecondary : colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            {/* Date */}
                            <Text style={[s.cardBio, { marginBottom: 6, fontWeight: "600" }]}>Preferred Date</Text>
                            <TouchableOpacity
                                style={[s.messageInput, { marginBottom: 12, flex: 0, minHeight: 52, justifyContent: "center" }]}
                                onPress={() => { setShowDatePicker(true); setShowTimePicker(false); }}>
                                <Text style={{ fontSize: 15, color: scheduleDateObj ? colors.textPrimary : colors.textSecondary }}>
                                    {scheduleDateObj
                                        ? scheduleDateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })
                                        : "Tap to select date"}
                                </Text>
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={scheduleDateObj ?? new Date(Date.now() + 86_400_000)}
                                    mode="date"
                                    display={Platform.OS === "ios" ? "spinner" : "default"}
                                    minimumDate={new Date()}
                                    themeVariant={isDark ? "dark" : "light"}
                                    onChange={(_, date) => {
                                        setShowDatePicker(Platform.OS === "ios");
                                        if (date) setScheduleDateObj(date);
                                        if (Platform.OS !== "ios") setShowDatePicker(false);
                                    }}
                                />
                            )}
                            {showDatePicker && Platform.OS === "ios" && (
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}
                                    style={{ alignSelf: "flex-end", marginBottom: 8 }}>
                                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>Done</Text>
                                </TouchableOpacity>
                            )}

                            {/* Time */}
                            <Text style={[s.cardBio, { marginBottom: 6, fontWeight: "600" }]}>Preferred Time</Text>
                            <TouchableOpacity
                                style={[s.messageInput, { marginBottom: 12, flex: 0, minHeight: 52, justifyContent: "center" }]}
                                onPress={() => { setShowTimePicker(true); setShowDatePicker(false); }}>
                                <Text style={{ fontSize: 15, color: scheduleTimeObj ? colors.textPrimary : colors.textSecondary }}>
                                    {scheduleTimeObj
                                        ? scheduleTimeObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                                        : "Tap to select time"}
                                </Text>
                            </TouchableOpacity>
                            {showTimePicker && (
                                <DateTimePicker
                                    value={scheduleTimeObj ?? new Date()}
                                    mode="time"
                                    display={Platform.OS === "ios" ? "spinner" : "default"}
                                    themeVariant={isDark ? "dark" : "light"}
                                    onChange={(_, time) => {
                                        if (time) setScheduleTimeObj(time);
                                        if (Platform.OS !== "ios") setShowTimePicker(false);
                                    }}
                                />
                            )}
                            {showTimePicker && Platform.OS === "ios" && (
                                <TouchableOpacity onPress={() => setShowTimePicker(false)}
                                    style={{ alignSelf: "flex-end", marginBottom: 8 }}>
                                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>Done</Text>
                                </TouchableOpacity>
                            )}

                            {/* Duration slider — 15 min to 4 hrs in 15-min steps */}
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                                <Text style={[s.cardBio, { fontWeight: "600" }]}>Duration</Text>
                                <Text style={{ fontSize: 22, fontWeight: "700", color: colors.primary }}>
                                    {formatMinutes(scheduleDuration)}
                                </Text>
                            </View>
                            <Slider
                                style={{ width: "100%", height: 40, marginHorizontal: -4 }}
                                minimumValue={15}
                                maximumValue={240}
                                step={15}
                                value={scheduleDuration}
                                onValueChange={(v) => setScheduleDuration(Math.round(v))}
                                minimumTrackTintColor={colors.primary}
                                maximumTrackTintColor={colors.border}
                                thumbTintColor={colors.primary}
                            />
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12, marginTop: -4 }}>
                                {[15, 60, 120, 180, 240].map((m) => (
                                    <TouchableOpacity key={m} onPress={() => setScheduleDuration(m)}>
                                        <Text style={{ fontSize: 11, color: scheduleDuration === m ? colors.primary : colors.textSecondary, fontWeight: scheduleDuration === m ? "700" : "400" }}>
                                            {formatMinutes(m)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Language & Translation */}
                            <Text style={[s.cardBio, { marginBottom: 6, fontWeight: "600" }]}>Your Language</Text>
                            <LangDropdown
                                value={userLang}
                                onChange={(code) => { setUserLang(code); setTranslationEnabled(false); }}
                                colors={colors}
                                style={{ marginBottom: 8 }}
                            />
                            {!langsMatch && (
                                <TouchableOpacity
                                    onPress={() => setTranslationEnabled((v) => !v)}
                                    style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}
                                >
                                    <View style={{
                                        width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
                                        borderColor: translationEnabled ? "#a78bfa" : "rgba(255,255,255,0.3)",
                                        backgroundColor: translationEnabled ? "rgba(139,92,246,0.3)" : "transparent",
                                        alignItems: "center", justifyContent: "center",
                                    }}>
                                        {translationEnabled && <Text style={{ color: "#a78bfa", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                                    </View>
                                    <Text style={[s.cardBio, { flex: 1 }]}>Enable auto-translation (+10% per-minute rate)</Text>
                                </TouchableOpacity>
                            )}
                            {translationEnabled && !langsMatch && (
                                <View style={{ backgroundColor: "rgba(245,158,11,0.1)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(245,158,11,0.25)", padding: 10, marginBottom: 12 }}>
                                    <Text style={[s.cardBio, { fontSize: 11, color: "#fbbf24", lineHeight: 16 }]}>
                                        Machine translation · 1–3s delay per message · Nuance may be lost · Adds 10% to session cost
                                    </Text>
                                </View>
                            )}

                            {/* Cost estimate */}
                            {scheduleDateObj != null && (
                                <View style={[s.card, { gap: 4, marginBottom: 12 }]}>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                        <Text style={s.cardBio}>{sym}{c.rate_per_min}/min × {scheduleDuration} min</Text>
                                        <Text style={[s.cardBio, { fontWeight: "700" }]}>{sym}{(c.rate_per_min * scheduleDuration).toFixed(0)}</Text>
                                    </View>
                                    {translationEnabled && !langsMatch && (
                                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                            <Text style={[s.cardBio, { fontSize: 11, color: "#a78bfa" }]}>Translation (+10%)</Text>
                                            <Text style={[s.cardBio, { fontSize: 11, color: "#a78bfa" }]}>{sym}{(translationSurcharge * scheduleDuration).toFixed(0)}</Text>
                                        </View>
                                    )}
                                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                        <Text style={[s.cardBio, { opacity: 0.6, fontSize: 11 }]}>Est. cost (max)</Text>
                                        <Text style={[s.cardBio, { opacity: 0.6, fontSize: 11 }]}>{sym}{(effectiveRate * scheduleDuration).toFixed(0)}</Text>
                                    </View>
                                </View>
                            )}

                            {/* Note */}
                            <Text style={[s.cardBio, { marginBottom: 6, fontWeight: "600" }]}>Message</Text>
                            <TextInput
                                style={[s.messageInput, { minHeight: 88, marginBottom: 16, flex: 0 }]}
                                value={scheduleNote}
                                onChangeText={setScheduleNote}
                                placeholder="e.g. Would love to talk about anxiety management…"
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                maxLength={800}
                                textAlignVertical="top"
                            />
                            <TouchableOpacity
                                style={[s.primaryBtn, { marginBottom: 8 }, scheduleLoading && { opacity: 0.6 }]}
                                onPress={() => {
                                    if (!scheduleDateObj) {
                                        Alert.alert("Date required", "Please pick a date for the session.");
                                        return;
                                    }
                                    if (!scheduleTimeObj) {
                                        Alert.alert("Time required", "Please select a time for the session.");
                                        return;
                                    }
                                    {
                                        const dStr = `${scheduleDateObj.getFullYear()}-${String(scheduleDateObj.getMonth()+1).padStart(2,"0")}-${String(scheduleDateObj.getDate()).padStart(2,"0")}`;
                                        const tStr = `${String(scheduleTimeObj.getHours()).padStart(2,"0")}:${String(scheduleTimeObj.getMinutes()).padStart(2,"0")}`;
                                        const combined = new Date(`${dStr}T${tStr}`);
                                        if (combined.getTime() <= Date.now()) {
                                            Alert.alert("Invalid time", "Please choose a future date and time.");
                                            return;
                                        }
                                    }
                                    if (!scheduleNote.trim()) {
                                        Alert.alert("Message required", "Please add a message describing what you would like to discuss.");
                                        return;
                                    }
                                    if ((walletBalance ?? 0) < c.rate_per_min) {
                                        setScheduleVisible(false);
                                        setRechargeBeforeStartVisible(true);
                                        return;
                                    }
                                    startSession("scheduled", scheduleNote, translationEnabled && !langsMatch);
                                }}
                                disabled={scheduleLoading}>
                                {scheduleLoading
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={s.primaryBtnText}>Send Request</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

// ── Wallet Top-Up Modal ────────────────────────────────────────────────────────
function WalletTopUpModal({ visible, accessToken, walletBalance, walletCurrency, onClose, onSuccess, colors }: {
    visible: boolean;
    accessToken: string | null;
    walletBalance: number;
    walletCurrency: string;
    onClose: () => void;
    onSuccess: (newBalance: number) => void;
    colors: any;
}) {
    const [selectedAmt, setSelectedAmt]   = useState(1000);
    const [customAmt, setCustomAmt]       = useState("");
    const [isCustom, setIsCustom]         = useState(false);
    const [ageConfirmed, setAgeConfirmed] = useState(false);
    const [termsAccepted, setTerms]       = useState(false);
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState("");
    const s = styles(colors);
    const sym = CURRENCY_SYMBOLS[walletCurrency] ?? "₹";
    // Max(0, ...) — NOT Max(1, ...) — so an empty custom field gives 0 and
    // the Pay button stays disabled via the topupAmt < 1 guard below.
    const topupAmt = isCustom ? Math.max(0, parseFloat(customAmt) || 0) : selectedAmt;

    // Reset all form state when the modal opens so stale errors / accepted terms
    // from a prior open don't carry over to a new payment attempt.
    useEffect(() => {
        if (visible) {
            setSelectedAmt(1000); setCustomAmt(""); setIsCustom(false);
            setAgeConfirmed(false); setTerms(false); setError("");
        }
    }, [visible]);

    // Ref-based guard prevents double-tap from launching two Razorpay flows before the
    // async setLoading(true) re-render has propagated and disabled the button.
    const payingRef = React.useRef(false);
    async function handlePay() {
        if (payingRef.current) return;
        if (!accessToken) return;
        if (topupAmt < 1) { setError("Please enter a valid amount"); return; }
        if (!ageConfirmed) { setError("Please confirm you are 18 or older to continue"); return; }
        if (!termsAccepted) { setError("Please accept the Wallet Terms to continue"); return; }
        payingRef.current = true;
        setLoading(true); setError("");
        try {
            const res = await pfetch(buildApiUrl("/api/connect/wallet/topup/create"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ amount: topupAmt, terms_accepted: true }),
            });
            const d = await res.json();
            if (!d.ok) { setError(d.error ?? "Failed to create order"); return; }

            const RazorpayCheckout = require("react-native-razorpay").default;
            const paymentData = await RazorpayCheckout.open({
                key: d.razorpay_key_id ?? process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
                order_id: d.razorpay_order_id,
                amount: String(d.amount_paise),
                currency: "INR",
                name: "Imotara Wallet",
                description: `Add ${sym}${topupAmt} to your wallet`,
                theme: { color: "#6366f1" },
            });

            const vRes = await pfetch(buildApiUrl("/api/connect/wallet/topup/verify"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({
                    razorpay_order_id:   paymentData.razorpay_order_id,
                    razorpay_payment_id: paymentData.razorpay_payment_id,
                    razorpay_signature:  paymentData.razorpay_signature,
                }),
            });
            const v = await vRes.json();
            if (!v.ok) { setError(v.error ?? "Verification failed"); return; }
            Alert.alert("Success", `${sym}${v.amount_credited ?? "?"} added to your wallet!`);
            onSuccess(Math.max(0, Number(v.new_balance ?? 0)));
        } catch (err: any) {
            if (err?.code !== 0 && !String(err?.description ?? "").toLowerCase().includes("cancel")) {
                setError(String(err?.message ?? "Payment failed"));
            }
        } finally {
            payingRef.current = false;
            setLoading(false);
        }
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={loading ? undefined : onClose}>
            <View style={s.modalBackdrop}>
                <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
                    {/* Header */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <View>
                            <Text style={[s.cardBio, { fontSize: 10, color: "#a78bfa", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }]}>
                                Imotara Wallet
                            </Text>
                            <Text style={[s.cardName, { fontSize: 18 }]}>Add Balance</Text>
                        </View>
                        <TouchableOpacity onPress={loading ? undefined : onClose} disabled={loading}>
                            <Ionicons name="close" size={20} color={loading ? "transparent" : colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Current balance */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "rgba(139,92,246,0.25)", backgroundColor: "rgba(139,92,246,0.08)", paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 }}>
                        <Text style={[s.cardBio, { color: "#a78bfa" }]}>💰 Current balance</Text>
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#a78bfa" }}>{sym}{walletBalance.toFixed(2)}</Text>
                    </View>

                    {/* Preset amounts */}
                    <Text style={[s.cardBio, { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }]}>Choose amount</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                        {TOPUP_PRESETS.map((p) => (
                            <TouchableOpacity key={p}
                                style={[s.durationBtn, !isCustom && selectedAmt === p && s.durationBtnActive, { flex: 0, paddingHorizontal: 16 }]}
                                onPress={() => { setIsCustom(false); setSelectedAmt(p); setError(""); }}>
                                <Text style={[s.durationBtnText, !isCustom && selectedAmt === p && s.durationBtnTextActive]} numberOfLines={1}>
                                    {sym}{(p / 1000).toFixed(0)}K
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[s.durationBtn, isCustom && s.durationBtnActive, { flex: 0, paddingHorizontal: 16 }]}
                            onPress={() => { setIsCustom(true); setError(""); }}>
                            <Text style={[s.durationBtnText, isCustom && s.durationBtnTextActive]} numberOfLines={1}>Custom</Text>
                        </TouchableOpacity>
                    </View>

                    {isCustom && (
                        <TextInput
                            style={[s.messageInput, { marginBottom: 10 }]}
                            value={customAmt}
                            onChangeText={setCustomAmt}
                            placeholder={`Amount in ${walletCurrency}`}
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                        />
                    )}

                    {/* Summary */}
                    <View style={[s.card, { gap: 4, marginBottom: 12 }]}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={s.cardBio}>Top-up amount</Text>
                            <Text style={[s.cardBio, { fontWeight: "700", color: colors.textPrimary }]}>{sym}{topupAmt.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={[s.cardBio, { opacity: 0.6, fontSize: 11 }]}>New balance after top-up</Text>
                            <Text style={[s.cardBio, { opacity: 0.6, fontSize: 11 }]}>{sym}{(walletBalance + topupAmt).toFixed(2)}</Text>
                        </View>
                    </View>

                    {/* Age confirmation */}
                    <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}
                        onPress={() => setAgeConfirmed((v) => !v)}
                        activeOpacity={0.7}>
                        <View style={{
                            width: 18, height: 18, borderRadius: 3, borderWidth: 1.5,
                            borderColor: ageConfirmed ? colors.primary : colors.border,
                            backgroundColor: ageConfirmed ? colors.primary : "transparent",
                            alignItems: "center", justifyContent: "center",
                        }}>
                            {ageConfirmed && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text>}
                        </View>
                        <Text style={[s.cardBio, { fontSize: 11, flex: 1 }]}>
                            I confirm I am 18 years of age or older.
                        </Text>
                    </TouchableOpacity>

                    {/* Consent */}
                    <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 }}
                        onPress={() => setTerms((v) => !v)}
                        activeOpacity={0.7}>
                        <View style={{
                            width: 18, height: 18, borderRadius: 3, borderWidth: 1.5,
                            borderColor: termsAccepted ? colors.primary : colors.border,
                            backgroundColor: termsAccepted ? colors.primary : "transparent",
                            alignItems: "center", justifyContent: "center", marginTop: 2,
                        }}>
                            {termsAccepted && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text>}
                        </View>
                        <Text style={[s.cardBio, { fontSize: 11, flex: 1 }]}>
                            I agree to the{" "}
                            <Text style={{ color: colors.primary, textDecorationLine: "underline" }}
                                onPress={() => Linking.openURL("https://imotara.com/connect/wallet-terms")}>
                                Wallet Terms
                            </Text>
                            . Balance is valid for 2 years of inactivity and is non-transferable.
                        </Text>
                    </TouchableOpacity>

                    {error !== "" && <Text style={[s.errorText, { marginBottom: 8 }]}>{error}</Text>}

                    <TouchableOpacity
                        style={[s.primaryBtn, (loading || topupAmt < 1 || !ageConfirmed || !termsAccepted) && { opacity: 0.5 }]}
                        onPress={handlePay}
                        disabled={loading || topupAmt < 1 || !ageConfirmed || !termsAccepted}>
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.primaryBtnText}>Add {sym}{topupAmt.toFixed(0)} to Wallet</Text>
                        }
                    </TouchableOpacity>

                    <Text style={[s.cardBio, { fontSize: 10, textAlign: "center", marginTop: 8, opacity: 0.5 }]}>
                        Secured by Razorpay · Balance used across all Connect sessions
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

// ── Session Recharge Modal ──────────────────────────────────────────────────────
// Adds more per-consultant session minutes mid-session via Razorpay.
// This is the correct mid-session "add time" flow — NOT the general INR wallet topup.
function SessionRechargeModal({ visible, accessToken, consultantId, consultantName, currencyCode, ratePerMin, onClose, onSuccess, colors }: {
    visible: boolean;
    accessToken: string | null;
    consultantId: string;
    consultantName: string;
    currencyCode: string;
    ratePerMin: number;
    onClose: () => void;
    onSuccess: (minutesAdded: number) => void;
    colors: any;
}) {
    const PRESETS = [15, 30, 60];
    const [selectedMin, setSelectedMin] = useState(30);
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState("");
    const s   = styles(colors);
    // Fall back to the raw currency code (e.g. "CAD ") for unlisted currencies so
    // the user sees a readable label instead of the wrong INR symbol.
    const sym = CURRENCY_SYMBOLS[currencyCode] ?? `${currencyCode} `;

    const rechargePayingRef = React.useRef(false);
    async function handlePay() {
        if (rechargePayingRef.current) return;
        if (!accessToken) return;
        rechargePayingRef.current = true;
        setLoading(true); setError("");
        try {
            const res = await pfetch(buildApiUrl("/api/connect/wallet/recharge/create"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ consultant_id: consultantId, minutes: selectedMin }),
            });
            const d = await res.json();
            if (!d.ok) { setError(d.error ?? "Failed to create order"); return; }

            const RazorpayCheckout = require("react-native-razorpay").default;
            const paymentData = await RazorpayCheckout.open({
                key:      d.razorpay_key_id ?? process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
                order_id: d.razorpay_order_id,
                amount:   String(d.amount_paise),
                currency: currencyCode,
                name:     "Imotara Connect",
                description: `Add ${selectedMin} min with ${consultantName}`,
                theme: { color: "#6366f1" },
            });

            const vRes = await pfetch(buildApiUrl("/api/connect/wallet/recharge/verify"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({
                    razorpay_order_id:   paymentData.razorpay_order_id,
                    razorpay_payment_id: paymentData.razorpay_payment_id,
                    razorpay_signature:  paymentData.razorpay_signature,
                }),
            });
            const v = await vRes.json();
            if (!v.ok) { setError(v.error ?? "Verification failed"); return; }
            Alert.alert("Time Added", `${selectedMin} minutes added to your session!`);
            onSuccess(Number(v.minutes_credited ?? selectedMin));
        } catch (err: any) {
            if (err?.code !== 0 && !String(err?.description ?? "").toLowerCase().includes("cancel")) {
                setError(String(err?.message ?? "Payment failed"));
            }
        } finally {
            rechargePayingRef.current = false;
            setLoading(false);
        }
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={loading ? undefined : onClose}>
            <View style={s.modalBackdrop}>
                <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <View>
                            <Text style={[s.cardBio, { fontSize: 10, color: "#f87171", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }]}>
                                Add Session Time
                            </Text>
                            <Text style={[s.cardName, { fontSize: 18 }]}>Extend with {consultantName}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} disabled={loading}>
                            <Ionicons name="close" size={20} color={loading ? colors.textSecondary + "55" : colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[s.cardBio, { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }]}>Choose duration</Text>
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                        {PRESETS.map((min) => {
                            const cost = (min * ratePerMin).toFixed(2);
                            const active = selectedMin === min;
                            return (
                                <TouchableOpacity key={min}
                                    onPress={() => setSelectedMin(min)}
                                    style={{ flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: active ? "#6366f1" : "rgba(255,255,255,0.12)", backgroundColor: active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)", paddingVertical: 12, alignItems: "center" }}>
                                    <Text style={{ fontSize: 16, fontWeight: "700", color: active ? "#818cf8" : colors.textPrimary }}>{min} min</Text>
                                    <Text style={{ fontSize: 11, color: active ? "#a5b4fc" : colors.textSecondary, marginTop: 2 }}>{sym}{cost}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={{ borderRadius: 10, borderWidth: 1, borderColor: "rgba(248,113,113,0.25)", backgroundColor: "rgba(248,113,113,0.08)", padding: 12, marginBottom: 14 }}>
                        <Text style={{ color: "#f87171", fontSize: 13, fontWeight: "600" }}>
                            Total: {sym}{(selectedMin * ratePerMin).toFixed(2)} for {selectedMin} minutes
                        </Text>
                        <Text style={[s.cardBio, { fontSize: 11, marginTop: 4 }]}>
                            Payment goes directly to your consultant's session balance. Minutes are available immediately after payment.
                        </Text>
                    </View>

                    {error !== "" && <Text style={[s.errorText, { marginBottom: 8 }]}>{error}</Text>}
                    <TouchableOpacity
                        style={[s.primaryBtn, loading && { opacity: 0.5 }]}
                        onPress={handlePay}
                        disabled={loading}>
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.primaryBtnText}>Pay {sym}{(selectedMin * ratePerMin).toFixed(2)} via Razorpay</Text>}
                    </TouchableOpacity>
                    <Text style={[s.cardBio, { fontSize: 10, textAlign: "center", marginTop: 8, opacity: 0.5 }]}>
                        Secured by Razorpay · Extends your time with this companion
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

// ── Chat View ──────────────────────────────────────────────────────────────────
function ChatView({ session, colors, insets, accessToken, userId, onBack }: {
    session: Session; colors: any; insets: any;
    accessToken: string | null; userId: string | null;
    onBack: () => void;
}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [remaining, setRemaining] = useState<number | null>(null);
    const [displaySeconds, setDisplaySeconds] = useState<number | null>(null);
    const [status, setStatus] = useState(session.status);
    const [showEmergency, setShowEmergency] = useState(false);
    const [showReview, setShowReview] = useState(false);
    // Init from session data so revisiting a completed session doesn't show the review form again
    const [reviewSubmitted, setReviewSubmitted] = useState(!!session.review_submitted_at);
    const [submittingReview, setSubmittingReview] = useState(false);
    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState("");
    // Dual panel state — walletBal removed (was showing unrelated general INR wallet)
    const [showRecharge, setShowRecharge] = useState(false);
    useEffect(() => { if (status !== "active") setShowRecharge(false); }, [status]);
    const [elapsedSecs, setElapsedSecs] = useState(0);
    const [amountCharged, setAmountCharged] = useState<number | null>(session.amount_charged ?? null);
    const [startedAt, setStartedAt] = useState<string | null>(session.started_at ?? null);
    const [minutesUsed, setMinutesUsed] = useState<number>(session.minutes_used);
    const [endingSession, setEndingSession] = useState(false);
    const [nowTick, setNowTick] = useState(() => new Date());
    const [panelOpen, setPanelOpen] = useState(true);
    const [tickPaused, setTickPaused] = useState(false);
    // Translation state
    const [chatLang, setChatLang] = useState("");
    const [translations, setTranslations] = useState<Map<string, string>>(new Map());
    const [translating, setTranslating] = useState<Set<string>>(new Set());
    const [showLangPicker, setShowLangPicker] = useState(false);
    const chatLangRef = useRef("");
    const flatRef = useRef<FlatList>(null);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastTickAtRef = useRef<number>(Date.now());
    const tickInFlightRef = useRef(false);
    const tickMountedRef = useRef(true);
    const userPushTokenRegistered = useRef(false);
    const s = styles(colors);

    // Scroll to bottom only when new messages arrive (not on keyboard show/hide)
    useEffect(() => {
        if (flatRef.current && messages.length > 0) {
            flatRef.current.scrollToEnd({ animated: messages.length > 1 });
        }
    }, [messages.length]);

    // Re-fetch session on mount — the session prop from SessionsTab may be stale (captured
    // at list-fetch time). This corrects status, started_at, minutes_used, and amount_charged
    // so the elapsed clock, billing panel, and CTA buttons are immediately accurate when the
    // user returns to an active session via "Return Now".
    useEffect(() => {
        if (!accessToken) return;
        let active = true;
        cfetch(buildApiUrl(`/api/connect/sessions/${session.id}`), {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
            .then((r) => r.json())
            .then((d) => {
                if (!active || !d.ok || !d.session) return;
                if (d.session.status) setStatus(d.session.status);
                if (d.session.started_at) setStartedAt(d.session.started_at);
                if (d.session.minutes_used != null) setMinutesUsed(Number(d.session.minutes_used));
                if (d.session.amount_charged != null) setAmountCharged(Number(d.session.amount_charged));
            })
            .catch(() => {});
        return () => { active = false; };
    }, [session.id, accessToken]);

    // Load messages
    useEffect(() => {
        let active = true;
        supabase.from("connect_messages")
            .select("id, sender_id, content, translated_content, created_at")
            .eq("session_id", session.id)
            .order("created_at", { ascending: true })
            .then(({ data }) => { if (active && data) setMessages(data as Message[]); });
        return () => { active = false; };
    }, [session.id]);

    // Translation helpers
    async function translateMessage(msgId: string, text: string, lang: string) {
        if (!accessToken) return;
        const key = `${msgId}::${lang}`;
        setTranslating((prev) => { const s = new Set(prev); s.add(msgId); return s; });
        try {
            const res = await cfetch(buildApiUrl("/api/connect/translate"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken ?? ""}` },
                body: JSON.stringify({ text, targetLang: lang }),
            });
            const d = await res.json();
            if (d.ok && d.translatedText && d.translatedText.trim() !== text.trim()) {
                setTranslations((prev) => new Map(prev).set(key, d.translatedText));
            }
        } catch { /* silent */ }
        finally {
            setTranslating((prev) => { const s = new Set(prev); s.delete(msgId); return s; });
        }
    }

    function handleLangChange(lang: string) {
        chatLangRef.current = lang;
        setChatLang(lang);
        setShowLangPicker(false);
        if (lang) {
            // Trigger translations outside setMessages updater — calling setState
            // from inside another state updater violates React's rules.
            messages.forEach((m: any) => {
                if (!translations.has(`${m.id}::${lang}`)) translateMessage(m.id, m.content, lang);
            });
        }
    }

    // Realtime subscription + network-recovery re-sync
    useEffect(() => {
        let cancelled = false;
        let prevRealtimeStatus = "";
        const channel = supabase.channel(`connect:session:${session.id}`)
            .on("postgres_changes", {
                event: "INSERT", schema: "public",
                table: "connect_messages", filter: `session_id=eq.${session.id}`,
            }, (payload) => {
                const msg = payload.new as Message;
                setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
                if (chatLangRef.current) {
                    const lang = chatLangRef.current;
                    const key = `${msg.id}::${lang}`;
                    cfetch(buildApiUrl("/api/connect/translate"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken ?? ""}` },
                        body: JSON.stringify({ text: msg.content, targetLang: lang }),
                    }).then((r) => r.json()).then((d) => {
                        if (d.ok && d.translatedText && d.translatedText.trim() !== msg.content.trim()) {
                            setTranslations((prev) => new Map(prev).set(key, d.translatedText));
                        }
                    }).catch(() => {});
                }
            })
            .on("postgres_changes", {
                event: "UPDATE", schema: "public",
                table: "connect_sessions", filter: `id=eq.${session.id}`,
            }, (payload) => {
                if (!tickMountedRef.current) return;
                const updated = payload.new as { status?: string; amount_charged?: number; started_at?: string; minutes_used?: number };
                if (updated.status) {
                    setStatus(updated.status);
                    // Alert the user when a session is declined or cancelled so they
                    // aren't left in the chat view with just a raw status change in the
                    // header subtitle and no call-to-action.
                    if (updated.status === "declined") {
                        Alert.alert(
                            "Request Declined",
                            "The companion is unavailable right now. Try another or check back later.",
                            [{ text: "OK", onPress: onBack }]
                        );
                    } else if (updated.status === "cancelled") {
                        Alert.alert(
                            "Session Cancelled",
                            "This session has been cancelled.",
                            [{ text: "OK", onPress: onBack }]
                        );
                    }
                }
                if (updated.amount_charged != null) setAmountCharged(updated.amount_charged);
                if (updated.started_at) setStartedAt(updated.started_at);
                if (updated.minutes_used != null) setMinutesUsed(Number(updated.minutes_used));
            })
            .subscribe((status) => {
                // On reconnect after a channel error (network drop/recovery), fire a tick
                // immediately to re-sync session state. AppState only fires on app background/
                // foreground — it doesn't cover foreground network recovery (e.g. WiFi drops
                // while screen is on). Without this, remaining/minutesUsed drift until the
                // next 60s tick, and a server-side completion may not reach the client.
                if (
                    status === "SUBSCRIBED" &&
                    (prevRealtimeStatus === "CHANNEL_ERROR" || prevRealtimeStatus === "TIMED_OUT") &&
                    !cancelled && accessToken && !tickInFlightRef.current
                ) {
                    if (Date.now() - lastTickAtRef.current < 55_000) {
                        // Network blip shorter than 55s — re-anchor the countdown interval to
                        // prevent display drift without billing an extra minute.
                        if (!cancelled) { stopTick(); startTick(); }
                    } else {
                    tickInFlightRef.current = true;
                    void (async () => {
                        try {
                            const res = await cfetch(buildApiUrl(`/api/connect/sessions/${session.id}/tick`), {
                                method: "POST",
                                headers: { Authorization: `Bearer ${accessToken}` },
                            }).catch(() => null);
                            if (cancelled || !res || !tickMountedRef.current) return;
                            // Stamp after confirming fetch succeeded so the AppState handler
                            // cannot fire a second billing tick within 55s of this reconnect tick.
                            lastTickAtRef.current = Date.now();
                            const d = await res.json().catch(() => null);
                            if (cancelled || !tickMountedRef.current) return;
                            if (d?.remaining_minutes != null) setRemaining(d.remaining_minutes);
                            if (d?.amount_charged != null) setAmountCharged(d.amount_charged);
                            if (d?.minutes_used != null) setMinutesUsed(Number(d.minutes_used));
                            if (d?.status === "completed") setStatus("completed");
                            if (!cancelled && d?.status !== "completed") { stopTick(); startTick(); }
                        } finally {
                            tickInFlightRef.current = false;
                        }
                    })();
                    } // end >= 55s branch
                }
                prevRealtimeStatus = status;
            });

        return () => { cancelled = true; supabase.removeChannel(channel); };
    // accessToken must be in deps: the translate API calls inside the Realtime
    // INSERT handler capture it in a closure. Without it, a token refresh mid-session
    // would leave the handler calling translate with an expired token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.id, accessToken]);

    // Tick helpers — stop/start the 60s billing interval
    function stopTick() {
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    }
    function startTick() {
        stopTick();
        tickRef.current = setInterval(async () => {
            if (!accessToken || tickInFlightRef.current) return;
            tickInFlightRef.current = true;
            try {
                const res = await cfetch(buildApiUrl(`/api/connect/sessions/${session.id}/tick`), {
                    method: "POST",
                    headers: { Authorization: `Bearer ${accessToken}` },
                }).catch(() => null);
                if (!res) { console.warn("[tick] network error — billing tick missed"); return; }
                if (res.status === 401) { stopTick(); setTickPaused(true); return; }
                const d = await res.json().catch(() => null);
                if (d?.error === "Authentication required") { stopTick(); setTickPaused(true); return; }
                // 402 guard must come before state updates — if the server includes
                // status:"completed" in a 402 body both the review modal and the recharge
                // modal would open simultaneously (inconsistent UI).
                if (d?.needs_recharge === true || res.status === 402) { stopTick(); setShowRecharge(true); return; }
                if (!res.ok && res.status !== 402) {
                    console.warn("[tick] server error", res.status, d?.error);
                    // Alert once only — stopTick so the interval doesn't spam the user.
                    // The orphan cron will auto-complete the session within 15 minutes.
                    stopTick();
                    Alert.alert("Billing Paused", "There was a problem processing your session billing. The session will auto-close shortly if connectivity doesn't restore.", [{ text: "OK" }]);
                    return;
                }
                // Stamp only after a confirmed successful billing tick (not on 401/402).
                // Stamping on 401 would delay AppState/reconnect re-sync by up to 55s.
                lastTickAtRef.current = Date.now();
                if (!tickMountedRef.current) return;
                if (d?.remaining_minutes != null) {
                    setRemaining(d.remaining_minutes);
                    // Proactively stop the interval when balance is exhausted — the server
                    // always returns status:"completed" in this case, but calling stopTick()
                    // here avoids waiting one full render cycle + useEffect before the
                    // interval clears, which matters when Realtime is reconnecting.
                    if (Number(d.remaining_minutes) <= 0) stopTick();
                }
                if (d?.amount_charged != null) setAmountCharged(d.amount_charged);
                if (d?.minutes_used != null) setMinutesUsed(Number(d.minutes_used));
                if (d?.status === "completed") setStatus("completed");
            } finally {
                tickInFlightRef.current = false;
            }
        }, 60_000);
    }

    // 60s billing tick
    useEffect(() => {
        if (status !== "active") {
            stopTick();
            return;
        }
        tickMountedRef.current = true;
        startTick();
        return () => { tickMountedRef.current = false; stopTick(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session.id, accessToken]);

    // AppState foreground-resume: re-fire a tick immediately if >= 55s elapsed while backgrounded.
    // React Native pauses JS execution when backgrounded, causing setInterval to miss ticks.
    useEffect(() => {
        if (status !== "active") return;
        let cancelled = false;
        const sub = AppState.addEventListener("change", (nextState) => {
            if (nextState !== "active") return;
            void (async () => {
                if (cancelled || !accessToken || tickInFlightRef.current) return;
                // Elapsed-time guard: brief backgrounds (< 55s) must NOT trigger a billing tick —
                // the user hasn't used another minute. Re-anchor the interval so the countdown
                // display self-corrects without billing. Only bill when >= 55s have elapsed
                // (JS timers typically miss a full tick cycle when backgrounded).
                if (Date.now() - lastTickAtRef.current < 55_000) {
                    if (!cancelled) { stopTick(); startTick(); }
                    return;
                }
                tickInFlightRef.current = true;
                try {
                    const res = await cfetch(buildApiUrl(`/api/connect/sessions/${session.id}/tick`), {
                        method: "POST",
                        headers: { Authorization: `Bearer ${accessToken}` },
                    }).catch(() => null);
                    if (cancelled || !res) return;
                    if (res.status === 401) { stopTick(); setTickPaused(true); return; }
                    const d = await res.json().catch(() => null);
                    if (cancelled) return;
                    if (d?.error === "Authentication required") { stopTick(); setTickPaused(true); return; }
                    if (d?.needs_recharge === true || res.status === 402) { stopTick(); setShowRecharge(true); return; }
                    // Guard non-401/402 server errors — same treatment as regular interval.
                    if (!res.ok) {
                        console.warn("[AppState tick] server error", res.status, d?.error);
                        stopTick();
                        if (tickMountedRef.current) {
                            Alert.alert("Billing Paused", "There was a problem processing your session billing. The session will auto-close shortly if connectivity doesn't restore.", [{ text: "OK" }]);
                        }
                        return;
                    }
                    // Stamp only after a confirmed successful billing tick (not on 401/402).
                    // Guard tickMountedRef before state updates — ChatView may have unmounted
                    // while this async IIFE was in flight (user tapped End Session).
                    lastTickAtRef.current = Date.now();
                    if (!tickMountedRef.current) return;
                    if (d?.remaining_minutes != null) setRemaining(d.remaining_minutes);
                    if (d?.amount_charged != null) setAmountCharged(d.amount_charged);
                    if (d?.minutes_used != null) setMinutesUsed(Number(d.minutes_used));
                    if (d?.status === "completed") setStatus("completed");
                    // Reset the interval so the next scheduled tick fires 60s from this
                    // AppState tick, not from whenever the interval was last scheduled.
                    // Guard on `cancelled` prevents startTick() from creating an orphaned
                    // interval if the component unmounted while this async IIFE was in flight.
                    if (!cancelled && d?.status !== "completed") { stopTick(); startTick(); }
                } finally {
                    tickInFlightRef.current = false;
                }
            })();
        });
        return () => { cancelled = true; sub.remove(); };
    }, [status, session.id, accessToken]);

    // Register user push token on session entry so the server can notify on accept/decline/force-close
    useEffect(() => {
        if (session.user_id !== userId || !accessToken || userPushTokenRegistered.current) return;
        userPushTokenRegistered.current = true;
        void registerUserPushToken(accessToken);
    }, [session.user_id, userId, accessToken]);

    // Android hardware back button: warn user before leaving an active session
    useEffect(() => {
        if (Platform.OS !== "android") return;
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            if (status === "active") {
                Alert.alert(
                    "Leave active session?",
                    "Billing will continue until the session is ended. Are you sure you want to leave?",
                    [
                        { text: "Stay", style: "cancel" },
                        { text: "Leave", style: "destructive", onPress: onBack },
                    ]
                );
                return true; // consume the back event
            }
            return false; // allow normal back navigation when not active
        });
        return () => sub.remove();
    }, [status, onBack]);

    // Per-second visual countdown synced from API tick
    useEffect(() => {
        if (remaining === null) { setDisplaySeconds(null); return; }
        // Clamp to 0 — server may return negative remaining_minutes (e.g. -0.5) when
        // balance is exactly zero; a negative value would render "-1:-30" in the timer.
        const secs = Math.max(0, Math.round(remaining * 60));
        setDisplaySeconds(secs);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
            setDisplaySeconds((prev) => (prev === null || prev <= 0 ? 0 : prev - 1));
        }, 1000);
        return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
    }, [remaining]);

    // Wallet balance fetch removed — session billing is per-consultant recharge minutes,
    // not the general imotara_wallets INR balance. Balance shown via `remaining * rate`.

    // Live 1-second clock + elapsed counter
    useEffect(() => {
        clockRef.current = setInterval(() => {
            const tick = new Date();
            setNowTick(tick);
            if (startedAt && status === "active") {
                setElapsedSecs(Math.max(0, Math.floor((tick.getTime() - new Date(startedAt).getTime()) / 1000)));
            }
        }, 1000);
        return () => { if (clockRef.current) { clearInterval(clockRef.current); clockRef.current = null; } };
    }, [startedAt, status]);

    async function send() {
        const text = input.trim();
        if (!text || sending) return;
        if (status !== "active") return; // guard: don't send to completed/cancelled sessions
        if (session.translation_enabled && !accessToken) {
            Alert.alert("Signed out", "Please sign in again to continue.");
            return;
        }
        setSending(true); setInput("");
        try {
            if (session.translation_enabled) {
                if (!accessToken) { setInput(text); return; }
                const res = await cfetch(buildApiUrl(`/api/connect/sessions/${session.id}/messages`), {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({ content: text }),
                });
                const d = await res.json();
                if (!res.ok || !d.ok) {
                    setInput(text);
                    Alert.alert("Message not sent", d?.error ?? "Please try again.");
                } else if (d.message) {
                    // Append immediately with translated_content populated.
                    // Realtime dedup (prev.find by id) prevents the Realtime INSERT from doubling it.
                    setMessages((prev: any[]) =>
                        prev.find((m: any) => m.id === d.message.id) ? prev : [...prev, d.message]
                    );
                } else {
                    // ok:true but message missing (server-side serialization edge case)
                    setInput(text);
                    Alert.alert("Message not sent", "Server error — please try again.");
                }
            } else {
                if (!userId) { setInput(text); return; }
                const { data: sentMsg, error } = await supabase
                    .from("connect_messages")
                    .insert({ session_id: session.id, sender_id: userId, content: text })
                    .select("id, session_id, sender_id, content, translated_content, created_at")
                    .single();
                if (error) {
                    setInput(text);
                    Alert.alert("Message not sent", "Please try again.");
                } else if (sentMsg) {
                    // Optimistic append: prevents the message being invisible if the Realtime
                    // INSERT event is dropped (network partition, WebSocket reconnect lag).
                    // Realtime dedup (prev.find by id) prevents doubling when the event does arrive.
                    setMessages((prev: any[]) =>
                        prev.find((m: any) => m.id === sentMsg.id) ? prev : [...prev, sentMsg]
                    );
                }
            }
        } catch {
            setInput(text);
            Alert.alert("Message not sent", "Network error — please try again.");
        }
        finally { setSending(false); }
    }

    async function submitReview() {
        if (rating === 0 || !accessToken || submittingReview) return;
        setSubmittingReview(true);
        try {
            const res = await cfetch(buildApiUrl(`/api/connect/sessions/${session.id}/review`), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ rating, review_text: reviewText || null }),
            });
            const d = await res.json();
            if (d.ok) { setShowReview(false); setReviewSubmitted(true); }
            else { Alert.alert("Error", d.error ?? "Could not submit review."); }
        } catch {
            Alert.alert("Network error", "Please check your connection and try again.");
        } finally {
            setSubmittingReview(false);
        }
    }

    const isActive = status === "active";
    const isCompleted = status === "completed";
    const isPending = status === "pending";
    const isConsultantView = session.user_id !== userId;
    const sym = CURRENCY_SYMBOLS[session.currency_code ?? "INR"] ?? "₹";
    const rate = Number(session.rate_per_min ?? session.connect_consultants?.rate_per_min ?? 0);
    // Use server-confirmed amount_charged; fall back to local clock estimate between ticks
    const consumed = amountCharged ?? (elapsedSecs / 60) * rate;
    const isLow = displaySeconds !== null && displaySeconds <= 120 && isActive;

    const userTz = session.user_timezone || "Asia/Kolkata";
    const consultantTz = session.consultant_timezone || "Asia/Kolkata";
    const myTz = isConsultantView ? consultantTz : userTz;
    const theirTz = isConsultantView ? userTz : consultantTz;
    const theirLabel = isConsultantView ? "User" : (session.connect_consultants?.display_name ?? "Companion");

    return (
        <KeyboardAvoidingView
            style={[s.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
        >
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity
                    onPress={() => {
                        if (status === "active") {
                            Alert.alert(
                                "Leave active session?",
                                "Billing will continue until the session is ended.",
                                [
                                    { text: "Stay", style: "cancel" },
                                    { text: "Leave", style: "destructive", onPress: onBack },
                                ]
                            );
                        } else {
                            onBack();
                        }
                    }}
                    style={s.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={s.headerTitle}>{session.connect_consultants?.display_name ?? "Companion"}</Text>
                    <Text style={[s.cardBio, { fontSize: 11 }]}>{isActive ? "Active" : isPending ? "Waiting…" : status}</Text>
                </View>
                {isActive && (
                    <TouchableOpacity
                        onPress={() => setPanelOpen((v) => !v)}
                        style={{ backgroundColor: isLow ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={{ color: isLow ? "#f87171" : "#34d399", fontSize: 11, fontWeight: "600" }}>
                            {formatDuration(elapsedSecs)}
                        </Text>
                        <Text style={{ color: isLow ? "#f87171" : "#34d399", fontSize: 9 }}>{panelOpen ? "▲" : "▼"}</Text>
                    </TouchableOpacity>
                )}
                {/* Language picker button — hidden when session-level translation is active */}
                {!session.translation_enabled && (
                    <TouchableOpacity
                        onPress={() => setShowLangPicker(true)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5, borderWidth: 1, borderColor: chatLang ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.1)", backgroundColor: chatLang ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.04)" }}>
                        <Text style={{ fontSize: 13 }}>🌐</Text>
                        {chatLang && <Text style={{ fontSize: 10, fontWeight: "700", color: "#60a5fa" }}>{chatLang.toUpperCase()}</Text>}
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={s.emergencyBtn} onPress={() => setShowEmergency(true)}>
                    <Ionicons name="call" size={16} color="#f87171" />
                </TouchableOpacity>
            </View>

            {/* ── Dual session panel ── */}
            {(isActive || isCompleted) && panelOpen && (
                <View style={{ backgroundColor: "rgba(9,9,11,0.85)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", padding: 10 }}>
                    {/* Metrics */}
                    <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                        {[
                            { label: "Elapsed",   value: formatDuration(elapsedSecs),                          bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)",  text: "#f59e0b" },
                            { label: "Remaining", value: displaySeconds !== null ? formatDuration(displaySeconds) : "—", bg: isLow ? "rgba(248,113,113,0.12)" : "rgba(52,211,153,0.12)", border: isLow ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)", text: isLow ? "#f87171" : "#34d399" },
                            { label: "Used",      value: `${sym}${consumed.toFixed(2)}`,                       bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", text: "#f87171" },
                            { label: "Balance",   value: remaining !== null ? `${sym}${(Math.max(0, remaining) * rate).toFixed(2)}` : "—", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)", text: "#a78bfa" },
                        ].map((m) => (
                            <View key={m.label} style={{ flex: 1, backgroundColor: m.bg, borderWidth: 1, borderColor: m.border, borderRadius: 10, padding: 6, alignItems: "center" }}>
                                <Text style={{ fontSize: 8, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: m.text, opacity: 0.7, marginBottom: 2 }}>{m.label}</Text>
                                <Text style={{ fontSize: 12, fontWeight: "700", color: m.text, fontVariant: ["tabular-nums"] }}>{m.value}</Text>
                            </View>
                        ))}
                    </View>
                    {/* Dual clocks */}
                    {[
                        { emoji: "🙋", label: `You · ${tzLabel(myTz)}`,        tz: myTz    },
                        { emoji: isConsultantView ? "👤" : "🧑‍💼", label: `${theirLabel} · ${tzLabel(theirTz)}`, tz: theirTz },
                    ].map((c) => (
                        <View key={c.tz} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 4 }}>
                            <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 8, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: colors.textSecondary, marginBottom: 1 }}>{c.label}</Text>
                                <Text style={{ fontSize: 11, color: colors.textPrimary, fontVariant: ["tabular-nums"] }}>{formatClock(nowTick, c.tz)}</Text>
                            </View>
                        </View>
                    ))}
                    {/* Show the user's session topic so the consultant can see it
                        without leaving the chat — only for scheduled sessions */}
                    {session.type === "scheduled" && !!session.scheduled_note && (
                        <View style={{ marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: colors.textSecondary, marginBottom: 3 }}>Session Topic</Text>
                            <Text style={{ fontSize: 11, color: colors.textPrimary, lineHeight: 16 }}>{session.scheduled_note}</Text>
                        </View>
                    )}
                </View>
            )}

            <Text style={[s.disclaimer, { textAlign: "center", paddingVertical: 6 }]}>
                Peer wellness support — not professional care
            </Text>
            {session.translation_enabled && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(59,130,246,0.08)", borderBottomWidth: 1, borderBottomColor: "rgba(59,130,246,0.15)", paddingVertical: 6 }}>
                    <Text style={{ fontSize: 10, color: "#60a5fa" }}>🌐 Auto-translation active — 1–3s delay · Machine translation</Text>
                </View>
            )}

            {isPending && (
                <Text style={{ textAlign: "center", color: "#fbbf24", fontSize: 12, padding: 8, backgroundColor: "rgba(251,191,36,0.08)" }}>
                    Waiting for companion to accept…
                </Text>
            )}
            {tickPaused && isActive && (
                <View style={{ backgroundColor: "#92400e22", borderBottomWidth: 1, borderColor: "#f59e0b44", paddingVertical: 6, paddingHorizontal: 16 }}>
                    <Text style={{ color: "#fbbf24", fontSize: 11, textAlign: "center" }}>
                        Billing paused (connection issue).{" "}
                        <Text
                            style={{ textDecorationLine: "underline" }}
                            onPress={() => { setTickPaused(false); startTick(); }}
                        >
                            Reconnect
                        </Text>
                    </Text>
                </View>
            )}
            {isActive && displaySeconds !== null && displaySeconds <= 120 && displaySeconds > 0 && (
                <TouchableOpacity
                    style={{ backgroundColor: "rgba(248,113,113,0.08)", padding: 10 }}
                    onPress={() => setShowRecharge(true)}>
                    <Text style={{ textAlign: "center", color: "#f87171", fontSize: 12, fontWeight: "600" }}>
                        Less than 2 minutes remaining — tap to add more time
                    </Text>
                </TouchableOpacity>
            )}
            {isCompleted && (
                <View style={{ padding: 10, alignItems: "center", backgroundColor: "rgba(148,163,184,0.08)" }}>
                    <Text style={s.cardBio}>Session completed · {minutesUsed} min</Text>
                    {!showReview && !reviewSubmitted && !isConsultantView && (
                        <TouchableOpacity onPress={() => setShowReview(true)}>
                            <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4 }}>Leave a review</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Messages */}
            <FlatList
                ref={flatRef}
                data={messages}
                keyExtractor={(m) => m.id}
                contentContainerStyle={{ padding: 12, gap: 8 }}
                renderItem={({ item: m }) => {
                    const isMe = m.sender_id === userId;

                    // Session-level translation: show pre-translated content from DB
                    if (session.translation_enabled) {
                        const primaryText   = isMe ? m.content : (m.translated_content || m.content);
                        const secondaryText = isMe ? m.translated_content : m.content;
                        return (
                            <View style={{ alignItems: isMe ? "flex-end" : "flex-start" }}>
                                <View style={{
                                    maxWidth: "78%",
                                    backgroundColor: isMe ? colors.primary : colors.surfaceSoft,
                                    borderRadius: 16,
                                    borderBottomRightRadius: isMe ? 4 : 16,
                                    borderBottomLeftRadius: isMe ? 16 : 4,
                                    paddingHorizontal: 14, paddingVertical: 10,
                                }}>
                                    <Text style={{ color: isMe ? "#fff" : colors.textPrimary, fontSize: 14, lineHeight: 20 }}>{primaryText}</Text>
                                    {secondaryText && secondaryText !== primaryText && (
                                        <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: isMe ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)" }}>
                                            <Text style={{ fontSize: 10, color: isMe ? "rgba(255,255,255,0.45)" : colors.textSecondary, marginBottom: 2 }}>
                                                🌐 {isMe ? "Their language" : "Original"}
                                            </Text>
                                            <Text style={{ fontSize: 13, lineHeight: 18, fontStyle: "italic", color: isMe ? "rgba(255,255,255,0.8)" : colors.textPrimary, opacity: 0.8 }}>
                                                {secondaryText}
                                            </Text>
                                        </View>
                                    )}
                                    <Text style={{ fontSize: 10, opacity: 0.6, color: isMe ? "#fff" : colors.textSecondary, marginTop: 4 }}>
                                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </Text>
                                </View>
                            </View>
                        );
                    }

                    // Standard (manual) translation via globe picker
                    const transKey = chatLang ? `${m.id}::${chatLang}` : null;
                    const translatedText = transKey ? translations.get(transKey) : undefined;
                    const isTranslating  = chatLang ? translating.has(m.id) : false;
                    const langLabel      = CHAT_LANGUAGES.find((l) => l.code === chatLang);
                    return (
                        <View style={{ alignItems: isMe ? "flex-end" : "flex-start" }}>
                            <View style={{
                                maxWidth: "78%",
                                backgroundColor: isMe ? colors.primary : colors.surfaceSoft,
                                borderRadius: 16,
                                borderBottomRightRadius: isMe ? 4 : 16,
                                borderBottomLeftRadius: isMe ? 16 : 4,
                                paddingHorizontal: 14, paddingVertical: 10,
                            }}>
                                <Text style={{ color: isMe ? "#fff" : colors.textPrimary, fontSize: 14, lineHeight: 20 }}>
                                    {m.content}
                                </Text>

                                {chatLang && (
                                    <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: isMe ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)" }}>
                                        {isTranslating && !translatedText ? (
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                                <ActivityIndicator size={10} color={isMe ? "rgba(255,255,255,0.5)" : colors.textSecondary} />
                                                <Text style={{ fontSize: 10, color: isMe ? "rgba(255,255,255,0.5)" : colors.textSecondary }}>Translating…</Text>
                                            </View>
                                        ) : translatedText ? (
                                            <>
                                                <Text style={{ fontSize: 10, color: isMe ? "rgba(255,255,255,0.45)" : colors.textSecondary, marginBottom: 2 }}>
                                                    🌐 {langLabel?.flag} {langLabel?.label}
                                                </Text>
                                                <Text style={{ fontSize: 13, lineHeight: 18, fontStyle: "italic", color: isMe ? "rgba(255,255,255,0.88)" : colors.textPrimary, opacity: 0.85 }}>
                                                    {translatedText}
                                                </Text>
                                            </>
                                        ) : (
                                            <Text style={{ fontSize: 10, color: isMe ? "rgba(255,255,255,0.35)" : colors.textSecondary }}>
                                                — same language
                                            </Text>
                                        )}
                                    </View>
                                )}

                                <Text style={{ fontSize: 10, opacity: 0.6, color: isMe ? "#fff" : colors.textSecondary, marginTop: 4 }}>
                                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </Text>
                            </View>
                        </View>
                    );
                }}
            />

            {/* Input */}
            {isActive && (
                <View style={[s.inputRow, { paddingBottom: insets.bottom + 8 }]}>
                    <TextInput
                        style={s.messageInput}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Type a message…"
                        placeholderTextColor={colors.textSecondary}
                        returnKeyType="send"
                        onSubmitEditing={send}
                        multiline
                        maxLength={2000}
                    />
                    <TouchableOpacity style={[s.sendBtn, sending && { opacity: 0.5 }]} onPress={send} disabled={sending || !input.trim()}>
                        <Ionicons name="send" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            {/* End session button — only shown to consultant */}
            {isActive && isConsultantView && (
                <TouchableOpacity
                    style={{ alignItems: "center", paddingVertical: 8, paddingBottom: insets.bottom || 4, opacity: endingSession ? 0.5 : 1 }}
                    disabled={endingSession}
                    onPress={async () => {
                        stopTick();
                        // If a billing tick POST is still in-flight, wait for it to finish
                        // before sending the complete PATCH. The server's optimistic lock
                        // (eq status=active, eq minutes_used=N) prevents double-completion,
                        // but the safest path is to drain the in-flight request first so the
                        // RETURNING minutes_used value is authoritative.
                        if (tickInFlightRef.current) {
                            await new Promise<void>((resolve) => {
                                const poll = setInterval(() => {
                                    if (!tickInFlightRef.current) { clearInterval(poll); resolve(); }
                                }, 50);
                            });
                        }
                        setEndingSession(true);
                        try {
                            const res = await cfetch(buildApiUrl(`/api/connect/sessions/${session.id}`), {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                                body: JSON.stringify({ action: "complete" }),
                            });
                            const d = await res.json().catch(() => null);
                            if (d?.ok) { onBack(); }
                            else { Alert.alert("Error", d?.error ?? "Could not end session"); }
                        } catch {
                            Alert.alert("Network error", "Please check your connection and try again.");
                        } finally {
                            setEndingSession(false);
                        }
                    }}>
                    {endingSession
                        ? <ActivityIndicator size="small" color={colors.textSecondary} />
                        : <Text style={{ color: colors.textSecondary, fontSize: 12 }}>End session</Text>}
                </TouchableOpacity>
            )}

            {/* End session early — shown to the user side only */}
            {isActive && !isConsultantView && (
                <TouchableOpacity
                    style={{ alignItems: "center", paddingVertical: 8, paddingBottom: insets.bottom || 4, opacity: endingSession ? 0.5 : 1 }}
                    disabled={endingSession}
                    onPress={async () => {
                        stopTick();
                        if (tickInFlightRef.current) {
                            await new Promise<void>((resolve) => {
                                const poll = setInterval(() => {
                                    if (!tickInFlightRef.current) { clearInterval(poll); resolve(); }
                                }, 50);
                            });
                        }
                        setEndingSession(true);
                        try {
                            const res = await cfetch(buildApiUrl(`/api/connect/sessions/${session.id}`), {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                                body: JSON.stringify({ action: "userEnd" }),
                            });
                            const d = await res.json().catch(() => null);
                            if (d?.ok) { onBack(); }
                            else { Alert.alert("Error", d?.error ?? "Could not end session"); }
                        } catch {
                            Alert.alert("Network error", "Please check your connection and try again.");
                        } finally {
                            setEndingSession(false);
                        }
                    }}>
                    {endingSession
                        ? <ActivityIndicator size="small" color={colors.textSecondary} />
                        : <Text style={{ color: colors.textSecondary, fontSize: 12 }}>End session early</Text>}
                </TouchableOpacity>
            )}

            {/* Language picker modal */}
            <Modal visible={showLangPicker} transparent animationType="slide" onRequestClose={() => setShowLangPicker(false)}>
                <View style={s.modalBackdrop}>
                    <View style={[s.modalSheet, { backgroundColor: colors.surface, maxHeight: "80%" }]}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <View>
                                <Text style={[s.cardBio, { fontSize: 10, color: "#60a5fa", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }]}>
                                    🌐 Chat Translation
                                </Text>
                                <Text style={[s.cardName, { fontSize: 17 }]}>Choose your language</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowLangPicker(false)}>
                                <Ionicons name="close" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[s.cardBio, { marginBottom: 10, fontSize: 12 }]}>
                            Messages will show original text + your language translation side by side.
                        </Text>

                        {/* Off option */}
                        <TouchableOpacity
                            style={[s.card, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }]}
                            onPress={() => handleLangChange("")}>
                            <Text style={s.cardBio}>Off — show original only</Text>
                            {!chatLang && <Text style={{ color: colors.primary, fontWeight: "700" }}>✓</Text>}
                        </TouchableOpacity>

                        {/* Language grid */}
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                {CHAT_LANGUAGES.map((l) => (
                                    <TouchableOpacity
                                        key={l.code}
                                        onPress={() => handleLangChange(l.code)}
                                        style={{
                                            flexDirection: "row", alignItems: "center", gap: 6,
                                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: chatLang === l.code ? "#60a5fa" : colors.border,
                                            backgroundColor: chatLang === l.code ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.04)",
                                        }}>
                                        <Text style={{ fontSize: 16 }}>{l.flag}</Text>
                                        <Text style={{ fontSize: 13, color: chatLang === l.code ? "#60a5fa" : colors.textPrimary, fontWeight: chatLang === l.code ? "700" : "400" }}>
                                            {l.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Emergency modal */}
            <EmergencyModal visible={showEmergency} onClose={() => setShowEmergency(false)} colors={colors} />

            {/* Review modal */}
            <Modal visible={showReview} transparent animationType="fade" onRequestClose={() => setShowReview(false)}>
                <View style={s.modalBackdrop}>
                    <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
                        <Text style={[s.cardName, { fontSize: 18, marginBottom: 16 }]}>How was the session?</Text>
                        <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 16 }}>
                            {[1, 2, 3, 4, 5].map((n) => (
                                // hitSlop expands the tap area to ≥48dp on Android — without it
                                // emoji glyph bounding boxes are ~20×20pt, silently eating taps.
                                <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                    <Text style={{ fontSize: 28, opacity: n <= rating ? 1 : 0.25 }}>⭐</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput
                            style={[s.messageInput, { minHeight: 80, marginBottom: 16 }]}
                            value={reviewText}
                            onChangeText={setReviewText}
                            placeholder="Optional feedback (max 200 chars)"
                            placeholderTextColor={colors.textSecondary}
                            maxLength={200}
                            multiline
                        />
                        <TouchableOpacity style={[s.primaryBtn, (rating === 0 || submittingReview) && { opacity: 0.5 }]}
                            onPress={submitReview} disabled={rating === 0 || submittingReview}>
                            {submittingReview ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryBtnText}>Submit Review</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Mid-session per-consultant minute recharge — extends session time */}
            <SessionRechargeModal
                visible={showRecharge}
                accessToken={accessToken}
                consultantId={session.consultant_id}
                consultantName={session.connect_consultants?.display_name ?? "Companion"}
                currencyCode={session.currency_code ?? "INR"}
                ratePerMin={rate}
                onClose={() => setShowRecharge(false)}
                onSuccess={(minutesAdded) => {
                    setShowRecharge(false);
                    setRemaining((prev) => (prev ?? 0) + minutesAdded);
                    lastTickAtRef.current = Date.now();
                    // Only restart tick if the session is still active — the consultant may have
                    // ended the session while the Razorpay payment was in-flight. Starting
                    // the interval on a completed session creates an orphaned interval that
                    // fires one spurious POST to the tick endpoint before the component unmounts.
                    if (status === "active") startTick();
                }}
                colors={colors}
            />
        </KeyboardAvoidingView>
    );
}

// ── Emergency Modal ────────────────────────────────────────────────────────────
function EmergencyModal({ visible, onClose, colors }: { visible: boolean; onClose: () => void; colors: any }) {
    const s = styles(colors);
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={s.modalBackdrop}>
                <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                        <Text style={[s.cardName, { color: "#f87171" }]}>Crisis Support</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <Text style={[s.cardBio, { marginBottom: 12 }]}>
                        If you're in crisis, please reach out to a professional helpline immediately.
                    </Text>
                    {CRISIS_LINES.map((line) => (
                        <TouchableOpacity key={line.phone} style={[s.card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }]}
                            onPress={() => Linking.openURL(`tel:${line.phone}`)}>
                            <View>
                                <Text style={s.cardName}>{line.name}</Text>
                                <Text style={[s.cardBio, { fontSize: 11 }]}>{line.country}</Text>
                            </View>
                            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>{line.phone}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={{ marginTop: 8, alignItems: "center" }}
                        onPress={() => Linking.openURL("https://findahelpline.com")}>
                        <Text style={{ color: colors.primary, fontSize: 13 }}>Find a helpline near you →</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// Registers the device's Expo push token with the server so the consultant
// receives push notifications when a new session request arrives.
async function registerUserPushToken(accessToken: string) {
    if (Platform.OS === "web") return;
    try {
        const Notifications = require("expo-notifications");
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;
        const Constants = require("expo-constants");
        const projectId = Constants.default?.expoConfig?.extra?.eas?.projectId
            ?? Constants.expoConfig?.extra?.eas?.projectId;
        const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
        );
        if (!pushToken) return;
        await pfetch(buildApiUrl("/api/connect/user/push-token"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ token: pushToken }),
        });
    } catch { /* non-critical — push is best-effort */ }
}

async function registerConnectPushToken(token: string | null) {
    if (!token || Platform.OS === "web") return;
    try {
        const Notifications = require("expo-notifications");
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;
        const Constants = require("expo-constants");
        const projectId = Constants.default?.expoConfig?.extra?.eas?.projectId
            ?? Constants.expoConfig?.extra?.eas?.projectId;
        const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
        );
        if (!pushToken) return;
        await pfetch(buildApiUrl("/api/connect/consultant/profile"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ expo_push_token: pushToken }),
        });
    } catch { /* non-critical — push is best-effort */ }
}

// ── Dashboard View ─────────────────────────────────────────────────────────────
function DashboardView({ colors, insets, accessToken, onBack, onJoinSession, onRegister }: {
    colors: any; insets: any; accessToken: string | null;
    onBack: () => void;
    onJoinSession: (session: Session) => void;
    onRegister?: () => void;
}) {
    const [profile, setProfile]             = useState<any>(null);
    const [earnings, setEarnings]           = useState<any>(null);
    const [incoming, setIncoming]           = useState<any[]>([]);
    const [history, setHistory]             = useState<any[]>([]);
    const [showHistory, setShowHistory]     = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [loading, setLoading]             = useState(true);
    const [loadError, setLoadError]         = useState(false);
    const [toggling, setToggling]           = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showPayout, setShowPayout]       = useState(false);
    const [payoutMethod, setPayoutMethod]   = useState<"upi" | "bank" | "bank_in" | "bank_int" | "paypal">("upi");
    const [payoutDetails, setPayoutDetails] = useState("");
    const [payoutAmount, setPayoutAmount]   = useState("");
    const [payoutLoading, setPayoutLoading] = useState(false);
    const [payoutMsg, setPayoutMsg]         = useState<{ ok: boolean; text: string } | null>(null);
    const [newRequestAlert, setNewRequestAlert] = useState(false);
    const prevPendingCount = useRef(0);
    // Availability windows
    const [editingAvail, setEditingAvail] = useState(false);
    const [availSaving, setAvailSaving]   = useState(false);
    // Rate editing
    const [editingRate, setEditingRate]   = useState(false);
    const [newRate, setNewRate]           = useState("");
    const [rateSaving, setRateSaving]     = useState(false);
    const [rateMsg, setRateMsg]           = useState<{ ok: boolean; text: string } | null>(null);
    // Session notes
    const [openNoteId, setOpenNoteId]     = useState<string | null>(null);
    const [noteContent, setNoteContent]   = useState("");
    const [noteSaving, setNoteSaving]     = useState(false);
    const [noteSaved, setNoteSaved]       = useState(false);
    // Block user
    const [blockingId, setBlockingId]     = useState<string | null>(null);
    const pushTokenRegistered             = useRef(false);
    const s = styles(colors);

    async function saveAvailability() {
        if (!accessToken || !profile) return;
        setAvailSaving(true);
        try {
            const res = await cfetch(buildApiUrl("/api/connect/consultant/profile"), {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ availability_windows: profile.availability_windows ?? [] }),
            });
            const d = await res.json().catch(() => null);
            if (!d?.ok) {
                Alert.alert("Save Failed", d?.error ?? "Could not save availability. Please try again.");
                return;
            }
            setEditingAvail(false);
        } catch { Alert.alert("Error", "Network error — please try again."); }
        finally { setAvailSaving(false); }
    }

    async function saveRate() {
        const rate = parseFloat(newRate);
        if (!accessToken || isNaN(rate) || rate <= 0) {
            setRateMsg({ ok: false, text: "Enter a valid positive rate." });
            return;
        }
        setRateSaving(true); setRateMsg(null);
        try {
            const res = await pfetch(buildApiUrl("/api/connect/consultant/profile"), {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ rate_per_min: rate }),
            });
            const d = await res.json();
            if (d.ok) {
                setProfile((p: any) => p ? { ...p, rate_per_min: rate } : p);
                setRateMsg({ ok: true, text: "Rate updated successfully." });
                setEditingRate(false);
            } else {
                setRateMsg({ ok: false, text: d.error ?? "Failed to update rate." });
            }
        } catch { setRateMsg({ ok: false, text: "Network error." }); }
        finally { setRateSaving(false); }
    }

    async function openNote(sessionId: string) {
        if (openNoteId === sessionId) { setOpenNoteId(null); return; }
        setOpenNoteId(sessionId);
        setNoteContent(""); setNoteSaved(false);
        if (!accessToken) return;
        try {
            const res = await cfetch(buildApiUrl(`/api/connect/sessions/${sessionId}/notes`), {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const d = await res.json();
            if (d.ok) setNoteContent(d.content ?? "");
        } catch { /* silent */ }
    }

    async function saveNote(sessionId: string) {
        if (!accessToken) return;
        setNoteSaving(true);
        try {
            const res = await cfetch(buildApiUrl(`/api/connect/sessions/${sessionId}/notes`), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ content: noteContent }),
            });
            const d = await res.json().catch(() => null);
            if (!d?.ok) {
                Alert.alert("Save Failed", d?.error ?? "Could not save note. Please try again.");
                return;
            }
            setNoteSaved(true);
            setTimeout(() => setNoteSaved(false), 2000);
        } catch {
            Alert.alert("Error", "Network error — could not save note. Please try again.");
        } finally { setNoteSaving(false); }
    }

    async function blockUser(userId: string) {
        if (!accessToken) return;
        Alert.alert("Block user", "They will no longer be able to request sessions with you.", [
            { text: "Cancel" },
            {
                text: "Block", style: "destructive",
                onPress: async () => {
                    setBlockingId(userId);
                    try {
                        const res = await cfetch(buildApiUrl("/api/connect/blocks"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                            body: JSON.stringify({ blocked_user_id: userId, reason: "Reported by companion" }),
                        });
                        const d = await res.json().catch(() => null);
                        if (!res.ok || !d?.ok) {
                            Alert.alert("Error", d?.error ?? "Could not block user. Please try again.");
                            return;
                        }
                        setHistory((prev) => prev.filter((h) => h.user_id !== userId));
                    } catch { Alert.alert("Error", "Network error. Please try again."); }
                    finally { setBlockingId(null); }
                },
            },
        ]);
    }

    async function requestPayout() {
        const amount = parseFloat(payoutAmount);
        if (!accessToken) { setPayoutMsg({ ok: false, text: "Sign in required to request a payout." }); return; }
        if (!amount || amount <= 0) { setPayoutMsg({ ok: false, text: "Enter a valid positive amount." }); return; }
        const currency = (earnings?.earned_currency ?? "INR").toUpperCase();
        const minPayout = currency === "USD" ? 10 : 500;
        const minLabel  = currency === "USD" ? "$10" : "₹500";
        if (amount < minPayout) { setPayoutMsg({ ok: false, text: `Minimum payout is ${minLabel}.` }); return; }
        if (!payoutDetails.trim()) { setPayoutMsg({ ok: false, text: "Enter your payment details (UPI ID, account number, or PayPal email)." }); return; }
        setPayoutLoading(true);
        setPayoutMsg(null);
        try {
            const res = await cfetch(buildApiUrl("/api/connect/consultant/payout"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({
                    amount,
                    currency_code:  earnings?.earned_currency ?? "INR",
                    payout_method:  payoutMethod,
                    payout_details: payoutMethod === "upi"      ? { upi_id: payoutDetails }
                                  : payoutMethod === "bank_in"  ? { account_number: payoutDetails }
                                  : payoutMethod === "bank_int" ? { account_number: payoutDetails }
                                  : { paypal_email: payoutDetails },
                }),
            });
            const d = await res.json();
            if (d.ok) {
                setPayoutMsg({ ok: true, text: "Request submitted! Admin will process within 2 business days." });
                setPayoutAmount(""); setPayoutDetails("");
                setEarnings((e: any) => e ? { ...e, pending_payout: (e.pending_payout ?? 0) + amount } : e);
            } else {
                setPayoutMsg({ ok: false, text: d.error ?? "Request failed." });
            }
        } catch {
            setPayoutMsg({ ok: false, text: "Network error." });
        } finally { setPayoutLoading(false); }
    }

    const load = useCallback(async () => {
        if (!accessToken) { setLoading(false); return; }
        try {
            const [pRes, eRes, sRes] = await Promise.all([
                cfetch(buildApiUrl("/api/connect/consultant/profile"), { headers: { Authorization: `Bearer ${accessToken}` } }),
                cfetch(buildApiUrl("/api/connect/consultant/earnings"), { headers: { Authorization: `Bearer ${accessToken}` } }),
                cfetch(buildApiUrl("/api/connect/consultant/sessions"), { headers: { Authorization: `Bearer ${accessToken}` } }),
            ]);
            const [p, e, s] = await Promise.all([pRes.json(), eRes.json(), sRes.json()]);
            if (p.ok) {
                setProfile(p.consultant);
                if (p.consultant?.status === "approved" && !pushTokenRegistered.current) {
                    pushTokenRegistered.current = true;
                    void registerConnectPushToken(accessToken);
                }
            }
            if (e.ok) setEarnings(e);
            if (s.ok) {
                setIncoming(s.sessions ?? []);
                prevPendingCount.current = (s.sessions ?? []).filter((x: any) => x.status === "pending").length;
            }
        } catch {
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => { load(); }, [load]);

    // Android hardware back: return to the Connect browse tab instead of navigating away.
    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
        return () => sub.remove();
    }, [onBack]);

    // Poll every 15s for new requests
    useEffect(() => {
        if (!accessToken) return;
        let mounted = true;
        const t = setInterval(() => {
            cfetch(buildApiUrl("/api/connect/consultant/sessions"), { headers: { Authorization: `Bearer ${accessToken}` } })
                .then((r) => r.json())
                .then((d) => {
                    if (!mounted) return;
                    if (d.ok) {
                        const sessions = d.sessions ?? [];
                        const newPendingCount = sessions.filter((x: any) => x.status === "pending").length;
                        if (newPendingCount > prevPendingCount.current) {
                            setNewRequestAlert(true);
                            Alert.alert("New Request", "You have a new session request!");
                        }
                        prevPendingCount.current = newPendingCount;
                        setIncoming(sessions);
                    }
                })
                .catch(() => {});
            // Also refresh profile to keep is_busy and is_online in sync
            if (accessToken) {
                cfetch(buildApiUrl("/api/connect/consultant/profile"), {
                    headers: { Authorization: `Bearer ${accessToken}` },
                })
                    .then((r) => r.json())
                    .then((d) => { if (mounted && d.ok && d.consultant) setProfile(d.consultant); })
                    .catch(() => {});
            }
        }, 15_000);
        // Do NOT reset prevPendingCount.current here — resetting it on token refresh would
        // cause the next poll to treat all existing pending sessions as new and fire spurious
        // "New Request" alerts. The ref is intentionally not part of the effect's cleanup.
        return () => { mounted = false; clearInterval(t); };
    }, [accessToken]);

    // Supabase Realtime: instant alert for new pending sessions
    useEffect(() => {
        if (!profile?.id) return;
        const consultantId = profile.id;
        const channel = supabase
            .channel(`dashboard:${consultantId}`)
            .on("postgres_changes" as any, {
                event: "INSERT",
                schema: "public",
                table: "connect_sessions",
                filter: `consultant_id=eq.${consultantId}`,
            }, (payload: any) => {
                const newSession = payload.new;
                if (newSession?.status === "pending") {
                    // State updater functions must be pure — no side effects (Alert, setState)
                    // inside them, as React may invoke the updater multiple times in concurrent mode.
                    let added = false;
                    setIncoming((prev) => {
                        if (prev.find((s: any) => s.id === newSession.id)) return prev;
                        // prevPendingCount mutation inside updater is safe: the dedup
                        // guard above ensures this branch runs at most once per real event.
                        prevPendingCount.current += 1;
                        added = true;
                        return [newSession, ...prev];
                    });
                    // Fire side effects only when the session was truly new.
                    // `added` is set synchronously by the updater in React Native's
                    // current (legacy/synchronous) scheduler.
                    if (added) {
                        setNewRequestAlert(true);
                        Alert.alert("New Request! 🔔", "A user wants to connect with you.");
                    }
                }
            })
            .on("postgres_changes" as any, {
                event: "UPDATE",
                schema: "public",
                table: "connect_sessions",
                filter: `consultant_id=eq.${consultantId}`,
            }, (payload: any) => {
                const updated = payload.new;
                // connect_sessions uses REPLICA IDENTITY DEFAULT — status may be absent
                // in tick-only UPDATEs (minutes_used changed). Guard to avoid false removal.
                if (!updated?.id || !updated?.status) return;
                if (!["pending", "active"].includes(updated.status)) {
                    setIncoming((prev: any[]) => prev.filter((s: any) => s.id !== updated.id));
                } else {
                    setIncoming((prev: any[]) =>
                        prev.map((s: any) => s.id === updated.id ? { ...s, status: updated.status } : s)
                    );
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [profile?.id]);

    async function loadHistory() {
        if (!accessToken) return;
        if (historyLoaded) { setShowHistory((v) => !v); return; }
        setShowHistory(true);
        setHistoryLoading(true);
        try {
            const res = await cfetch(buildApiUrl("/api/connect/consultant/sessions?status=history"), {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const d = await res.json();
            if (!res.ok || !d.ok) {
                setShowHistory(false);
                Alert.alert("Error", d?.error ?? "Could not load session history. Please try again.");
                return;
            }
            setHistory(d.sessions ?? []);
            setHistoryLoaded(true);
        } catch {
            setShowHistory(false);
            Alert.alert("Error", "Could not load session history. Please try again.");
        }
        finally { setHistoryLoading(false); }
    }

    const actionInFlightRef = React.useRef<string | null>(null);
    async function handleAction(sessionId: string, action: "accept" | "decline") {
        if (actionInFlightRef.current === sessionId) return;
        if (!accessToken) return;
        actionInFlightRef.current = sessionId;
        setActionLoading(sessionId);
        try {
            const res = await cfetch(buildApiUrl(`/api/connect/sessions/${sessionId}`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({
                    action,
                    ...(action === "accept" && {
                        consultant_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    }),
                }),
            });
            const d = await res.json();
            if (d.ok) {
                if (action === "accept") {
                    // Remove from incoming immediately — without this the session remains
                    // in the list with ghost Accept/Decline buttons if the consultant
                    // navigates back before the Realtime UPDATE arrives.
                    const sess = incoming.find((s) => s.id === sessionId);
                    setIncoming((prev) => prev.filter((s) => s.id !== sessionId));
                    if (sess) {
                        // Stamp status:"active" on the local object so ChatView doesn't
                        // briefly show "Waiting for companion…" and delay the tick start
                        // while the on-mount re-fetch round-trips to the server.
                        onJoinSession({ ...sess, status: "active" });
                    } else {
                        // Race: session already moved out of incoming — fetch directly and navigate
                        try {
                            const r2 = await cfetch(buildApiUrl(`/api/connect/sessions/${sessionId}`), {
                                headers: { Authorization: `Bearer ${accessToken}` },
                            });
                            const d2 = await r2.json();
                            if (d2.ok && d2.session) {
                                onJoinSession({ ...d2.session });
                            } else {
                                Alert.alert("Session accepted", "Session is ready — check Active Sessions to join.");
                            }
                        } catch {
                            Alert.alert("Session accepted", "Session is ready — check Active Sessions to join.");
                        }
                    }
                } else {
                    setIncoming((prev) => prev.filter((s) => s.id !== sessionId));
                }
            } else {
                // Remove from incoming on any API failure — if the server rejected
                // the request, the session is no longer actionable (expired, already
                // declined, or completed by another path). Leaving it in the list
                // would show a ghost Accept/Decline after a Realtime reconnect misses
                // the status UPDATE.
                setIncoming((prev) => prev.filter((s) => s.id !== sessionId));
                Alert.alert("Error", d.error ?? `Could not ${action} session`);
            }
        } catch { Alert.alert("Error", "Network error — please try again."); }
        finally { actionInFlightRef.current = null; setActionLoading(null); }
    }

    async function toggleOnline() {
        if (!accessToken || !profile) return;
        if (profile.is_online && active.length > 0) {
            Alert.alert("Active Session", "You cannot go offline while a session is in progress. Please end the session first.");
            return;
        }
        setToggling(true);
        try {
            const res = await cfetch(buildApiUrl("/api/connect/consultant/status"), {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ is_online: !profile.is_online }),
            });
            const d = await res.json();
            if (d.ok) setProfile((p: any) => ({ ...p, is_online: !p.is_online }));
            else Alert.alert("Error", d.error ?? "Could not update status");
        } catch {
            Alert.alert("Error", "Network error — please try again.");
        } finally {
            setToggling(false);
        }
    }

    const pending = incoming.filter((s) => s.status === "pending");
    const active  = incoming.filter((s) => s.status === "active");

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={onBack} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>My Dashboard</Text>
                <View style={{ width: 36 }} />
            </View>

            {loading ? (
                <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
            ) : loadError ? (
                <View style={[s.center, { paddingHorizontal: 32 }]}>
                    <Text style={[s.emptyText, { marginBottom: 8 }]}>Could not load dashboard.</Text>
                    <Text style={[s.cardBio, { textAlign: "center", marginBottom: 16 }]}>Check your connection and try again.</Text>
                    <TouchableOpacity onPress={() => { setLoading(true); setLoadError(false); load(); }} style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(139,92,246,0.2)", borderWidth: 1, borderColor: "rgba(139,92,246,0.4)" }}>
                        <Text style={{ color: "#a78bfa", fontSize: 14, fontWeight: "600" }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : !profile ? (
                <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                    <View style={s.card}>
                        <Text style={[s.cardName, { marginBottom: 8 }]}>Not registered as a companion</Text>
                        <Text style={[s.cardBio, { marginBottom: 12 }]}>Join Imotara as a Wellness Companion and help others through peer support.</Text>
                        {onRegister && (
                            <TouchableOpacity style={styles(colors).primaryBtn} onPress={onRegister}>
                                <Text style={styles(colors).primaryBtnText}>🌿 Register as Wellness Companion</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            ) : (
                <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                    {/* New request banner */}
                    {newRequestAlert && (
                        <TouchableOpacity
                            style={{ backgroundColor: "rgba(251,191,36,0.15)", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: "rgba(251,191,36,0.4)" }}
                            onPress={() => setNewRequestAlert(false)}>
                            <Text style={{ fontSize: 18 }}>🔔</Text>
                            <Text style={{ color: "#fbbf24", fontWeight: "700", flex: 1 }}>New session request!</Text>
                            <Text style={{ color: "#fbbf24", opacity: 0.6, fontSize: 11 }}>tap to dismiss</Text>
                        </TouchableOpacity>
                    )}

                    {/* Status + online toggle */}
                    <View style={[s.card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                        <View>
                            <Text style={s.cardName}>{profile.display_name}</Text>
                            <Text style={[s.cardBio, { color: profile.status === "approved" ? "#34d399" : "#fbbf24" }]}>
                                {profile.status}
                            </Text>
                        </View>
                        {profile.status === "approved" && (
                            <TouchableOpacity
                                style={[s.primaryBtn, { paddingHorizontal: 16, paddingVertical: 8 },
                                    profile.is_online ? { backgroundColor: "rgba(248,113,113,0.8)" } : {}]}
                                onPress={toggleOnline} disabled={toggling}>
                                <Text style={s.primaryBtnText}>{profile.is_online ? "Go Offline" : "Go Online"}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Availability Windows (collapsed by default) */}
                    <TouchableOpacity
                        style={[s.card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                        onPress={() => setEditingAvail((v) => !v)}>
                        <Text style={[s.cardBio, { fontWeight: "700" }]}>📅 Availability Windows</Text>
                        <Text style={s.cardBio}>{editingAvail ? "▲" : "▼"}</Text>
                    </TouchableOpacity>
                    {editingAvail && (
                        <View style={s.card}>
                            <Text style={[s.cardBio, { marginBottom: 10, opacity: 0.7 }]}>
                                Add your regular available time slots. Visible on your profile.
                            </Text>
                            {(profile.availability_windows ?? []).map((w: any, i: number) => (
                                <View key={i} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
                                    <Text style={[s.cardBio, { fontSize: 12, minWidth: 70 }]}>{w.day}</Text>
                                    <Text style={[s.cardBio, { fontSize: 12 }]}>{w.start} – {w.end}</Text>
                                    <TouchableOpacity
                                        style={{ marginLeft: "auto", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(248,113,113,0.15)" }}
                                        onPress={() => {
                                            const updated = (profile.availability_windows ?? []).filter((_: any, idx: number) => idx !== i);
                                            setProfile((p: any) => ({ ...p, availability_windows: updated }));
                                        }}>
                                        <Text style={{ color: "#f87171", fontSize: 11 }}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                                <TouchableOpacity
                                    style={[{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: "center" }]}
                                    onPress={() => {
                                        const updated = [...(profile.availability_windows ?? []), { day: "Monday", start: "09:00", end: "17:00" }];
                                        setProfile((p: any) => ({ ...p, availability_windows: updated }));
                                    }}>
                                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>+ Add slot</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={0.65}
                                    style={[s.primaryBtn, { flex: 1, paddingVertical: 8 }, availSaving && { opacity: 0.6 }]}
                                    onPress={saveAvailability}
                                    disabled={availSaving}>
                                    {availSaving
                                        ? <ActivityIndicator color="#0f172a" size="small" />
                                        : <Text style={s.primaryBtnText}>Save</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Rate Editing */}
                    <TouchableOpacity
                        style={[s.card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                        onPress={() => { setEditingRate((v) => !v); setNewRate(String(profile.rate_per_min ?? "")); setRateMsg(null); }}>
                        <Text style={[s.cardBio, { fontWeight: "700" }]}>💰 Rate per Minute
                            {profile.rate_per_min != null
                                ? ` (${CURRENCY_SYMBOLS[profile.currency_code ?? "INR"] ?? profile.currency_code ?? ""}${Number(profile.rate_per_min).toFixed(2)}/min)`
                                : ""}
                        </Text>
                        <Text style={s.cardBio}>{editingRate ? "▲" : "▼"}</Text>
                    </TouchableOpacity>
                    {editingRate && (
                        <View style={s.card}>
                            <Text style={[s.cardBio, { marginBottom: 10, opacity: 0.7 }]}>
                                Update your per-minute rate. New sessions will use this rate; ongoing sessions are unaffected.
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <Text style={[s.cardBio, { opacity: 0.7 }]}>{profile.currency_code ?? "INR"}</Text>
                                <TextInput
                                    style={[s.messageInput, { flex: 1, height: 40, marginBottom: 0 }]}
                                    value={newRate}
                                    onChangeText={setNewRate}
                                    keyboardType="decimal-pad"
                                    placeholder="e.g. 5.00"
                                    placeholderTextColor={colors.textSecondary}
                                />
                                <Text style={[s.cardBio, { opacity: 0.7 }]}>/ min</Text>
                            </View>
                            {rateMsg && (
                                <Text style={{ color: rateMsg.ok ? "#34d399" : "#f87171", fontSize: 12, marginBottom: 8 }}>
                                    {rateMsg.text}
                                </Text>
                            )}
                            <View style={{ flexDirection: "row", gap: 8 }}>
                                <TouchableOpacity
                                    style={[{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: "center" }]}
                                    onPress={() => { setEditingRate(false); setRateMsg(null); }}>
                                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[s.primaryBtn, { flex: 1, paddingVertical: 8 }, rateSaving && { opacity: 0.6 }]}
                                    onPress={saveRate}
                                    disabled={rateSaving}>
                                    {rateSaving
                                        ? <ActivityIndicator color="#fff" size="small" />
                                        : <Text style={s.primaryBtnText}>Save</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Active sessions */}
                    {active.map((s) => (
                        <View key={s.id} style={styles(colors).card}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles(colors).cardName, { color: "#34d399" }]}>Session in progress</Text>
                                    <Text style={styles(colors).cardBio}>{s.type} · {(s.minutes_used ?? 0).toFixed(0)} min used</Text>
                                </View>
                                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                                    <TouchableOpacity
                                        style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(139,92,246,0.35)", backgroundColor: "rgba(139,92,246,0.08)" }}
                                        onPress={() => openNote(s.id)}>
                                        <Text style={{ color: "#a78bfa", fontSize: 12, fontWeight: "600" }}>
                                            {openNoteId === s.id ? "Close" : "📝 Notes"}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles(colors).primaryBtn, { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(52,211,153,0.8)" }]}
                                        onPress={() => onJoinSession({ ...s, connect_consultants: null })}>
                                        <Text style={styles(colors).primaryBtnText}>Rejoin</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {/* Inline notes editor */}
                            {openNoteId === s.id && (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={[styles(colors).cardBio, { fontSize: 10, marginBottom: 4, opacity: 0.6 }]}>
                                        🔒 Private — only visible to you
                                    </Text>
                                    <TextInput
                                        style={[styles(colors).messageInput, { minHeight: 80, marginBottom: 8 }]}
                                        value={noteContent}
                                        onChangeText={setNoteContent}
                                        placeholder="Add a private note about this session..."
                                        placeholderTextColor={colors.textSecondary}
                                        multiline
                                        maxLength={2000}
                                    />
                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                        <Text style={[styles(colors).cardBio, { fontSize: 10 }]}>{noteContent.length}/2000</Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                            {noteSaved && <Text style={{ color: "#34d399", fontSize: 11 }}>Saved ✓</Text>}
                                            <TouchableOpacity
                                                activeOpacity={0.75}
                                                style={[styles(colors).primaryBtn, { paddingHorizontal: 16, paddingVertical: 8 }, noteSaving && { opacity: 0.6 }]}
                                                onPress={() => saveNote(s.id)}
                                                disabled={noteSaving}>
                                                {noteSaving
                                                    ? <ActivityIndicator color="#fff" size="small" />
                                                    : <Text style={[styles(colors).primaryBtnText, { fontSize: 13 }]}>Save</Text>}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    ))}

                    {/* Pending requests with user preview */}
                    {pending.length > 0 && (
                        <View>
                            <Text style={[s.cardBio, { color: "#fbbf24", fontWeight: "700", marginBottom: 8 }]}>
                                Incoming Requests ({pending.length})
                            </Text>
                            {pending.map((req) => {
                                const userEmail = req.user_preview?.email ?? null;
                                const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : "?";
                                const userDisplayName = userEmail ? userEmail.split("@")[0] : "Anonymous user";
                                return (
                                    <View key={req.id} style={[s.card, { marginBottom: 10 }]}>
                                        {/* User preview */}
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(99,102,241,0.2)", alignItems: "center", justifyContent: "center" }}>
                                                <Text style={{ color: "#a78bfa", fontWeight: "700", fontSize: 15 }}>{userInitial}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[s.cardName, { fontSize: 14 }]}>{userDisplayName}</Text>
                                                <Text style={[s.cardBio, { fontSize: 11 }]}>
                                                    {req.type === "instant" ? "Instant" : "Scheduled"}{" · "}
                                                    {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </Text>
                                            </View>
                                        </View>
                                        {req.scheduled_note && (
                                            <Text style={[s.cardBio, { fontStyle: "italic", marginBottom: 10, backgroundColor: "rgba(255,255,255,0.04)", padding: 8, borderRadius: 8 }]}>
                                                &ldquo;{req.scheduled_note}&rdquo;
                                            </Text>
                                        )}
                                        <View style={{ flexDirection: "row", gap: 8 }}>
                                            <TouchableOpacity
                                                style={[s.primaryBtn, { flex: 1, paddingVertical: 10 }, (actionLoading === req.id || active.length > 0) && { opacity: 0.6 }]}
                                                onPress={() => handleAction(req.id, "accept")}
                                                disabled={actionLoading === req.id || active.length > 0}>
                                                {actionLoading === req.id
                                                    ? <ActivityIndicator color="#fff" size="small" />
                                                    : <Text style={s.primaryBtnText}>{active.length > 0 ? "Finish Active First" : "Accept & Chat"}</Text>
                                                }
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(248,113,113,0.4)", alignItems: "center" }, actionLoading === req.id && { opacity: 0.6 }]}
                                                onPress={() => handleAction(req.id, "decline")}
                                                disabled={actionLoading === req.id}>
                                                <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 14 }}>Decline</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {pending.length === 0 && active.length === 0 && profile.status === "approved" && (
                        <View style={[s.card, { alignItems: "center" }]}>
                            <Text style={s.cardBio}>No incoming requests right now.</Text>
                            <Text style={[s.cardBio, { opacity: 0.6, marginTop: 2 }]}>Go online to receive requests.</Text>
                        </View>
                    )}

                    {/* Earnings + payout */}
                    {earnings && (
                        <View style={s.card}>
                            <Text style={[s.cardName, { marginBottom: 8 }]}>Earnings</Text>
                            <View style={{ gap: 6 }}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                    <Text style={s.cardBio}>Total earned</Text>
                                    <Text style={s.cardName}>
                                        {CURRENCY_SYMBOLS[earnings.earned_currency ?? "INR"] ?? "₹"}{(earnings.earned_amount ?? 0).toFixed(2)}
                                    </Text>
                                </View>
                                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                    <Text style={s.cardBio}>Sessions completed</Text>
                                    <Text style={s.cardName}>{earnings.sessions_completed ?? 0}</Text>
                                </View>
                                {(earnings.pending_payout ?? 0) > 0 && (
                                    <Text style={{ color: "#fbbf24", fontSize: 12, textAlign: "center", marginTop: 4 }}>
                                        {CURRENCY_SYMBOLS[earnings.earned_currency ?? "INR"] ?? "₹"}{(earnings.pending_payout ?? 0).toFixed(2)} payout pending
                                    </Text>
                                )}
                            </View>
                            {(() => {
                                const available = (earnings.earned_amount ?? 0) - (earnings.pending_payout ?? 0);
                                return available > 0 ? (
                                    <TouchableOpacity
                                        style={[s.primaryBtn, { marginTop: 12 }]}
                                        onPress={() => { setShowPayout(!showPayout); setPayoutMsg(null); }}>
                                        <Text style={s.primaryBtnText}>
                                            {showPayout ? "Cancel" : `Request Payout · ${CURRENCY_SYMBOLS[earnings.earned_currency ?? "INR"] ?? "₹"}${available.toFixed(2)}`}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center", marginTop: 12 }}>
                                        {(earnings.pending_payout ?? 0) > 0
                                            ? "All earnings are pending payout processing."
                                            : "No balance available to withdraw yet."}
                                    </Text>
                                );
                            })()}
                            {showPayout && (
                                <View style={{ marginTop: 12, gap: 10 }}>
                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                        {(["upi", "bank_in", "bank_int", "paypal"] as const).map((m) => {
                                            const label = m === "upi" ? "UPI" : m === "bank_in" ? "India Bank" : m === "bank_int" ? "Intl Wire" : "PayPal";
                                            return (
                                                <TouchableOpacity
                                                    key={m}
                                                    style={[{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
                                                        payoutMethod === m
                                                            ? { borderColor: colors.primary, backgroundColor: "rgba(99,102,241,0.2)" }
                                                            : { borderColor: "rgba(255,255,255,0.15)" }]}
                                                    onPress={() => setPayoutMethod(m)}>
                                                    <Text style={{ color: payoutMethod === m ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: "700" }}>
                                                        {label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                    <TextInput
                                        style={[s.input, { color: colors.textPrimary }]}
                                        value={payoutDetails}
                                        onChangeText={setPayoutDetails}
                                        placeholder={
                                            payoutMethod === "upi"      ? "UPI ID (e.g. name@bank)" :
                                            payoutMethod === "bank_in"  ? "Indian account number" :
                                            payoutMethod === "bank_int" ? "IBAN / account number" :
                                            "PayPal email"
                                        }
                                        placeholderTextColor={colors.textSecondary}
                                    />
                                    <TextInput
                                        style={[s.input, { color: colors.textPrimary }]}
                                        value={payoutAmount}
                                        onChangeText={setPayoutAmount}
                                        placeholder="Amount"
                                        placeholderTextColor={colors.textSecondary}
                                        keyboardType="numeric"
                                    />
                                    {payoutMsg && (
                                        <Text style={{ color: payoutMsg.ok ? "#34d399" : "#f87171", fontSize: 12 }}>
                                            {payoutMsg.text}
                                        </Text>
                                    )}
                                    <TouchableOpacity
                                        style={[s.primaryBtn, payoutLoading && { opacity: 0.6 }]}
                                        onPress={requestPayout}
                                        disabled={payoutLoading || !payoutDetails.trim() || !payoutAmount}>
                                        {payoutLoading
                                            ? <ActivityIndicator color="#fff" size="small" />
                                            : <Text style={s.primaryBtnText}>Submit Request</Text>}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Session history + reviews */}
                    <TouchableOpacity style={s.card} onPress={loadHistory} activeOpacity={0.75}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Text style={[s.cardName, { fontSize: 14 }]}>🕓 Session History & Reviews</Text>
                            <Text style={s.cardBio}>{showHistory ? "▲" : "▼"}</Text>
                        </View>
                    </TouchableOpacity>

                    {showHistory && (
                        <View>
                            {historyLoading ? (
                                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                                    <ActivityIndicator color={colors.primary} />
                                </View>
                            ) : history.length === 0 ? (
                                <Text style={[s.cardBio, { textAlign: "center", paddingVertical: 16 }]}>No completed sessions yet.</Text>
                            ) : (
                                history.map((h) => {
                                    const userEmail = h.user_preview?.email ?? null;
                                    const displayName = userEmail ? userEmail.split("@")[0] : "Anonymous";
                                    const initial = userEmail ? userEmail.charAt(0).toUpperCase() : "?";
                                    return (
                                        <View key={h.id} style={[s.card, { marginBottom: 8 }]}>
                                            {/* User + session info */}
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center" }}>
                                                    <Text style={{ color: "#a78bfa", fontWeight: "700", fontSize: 12 }}>{initial}</Text>
                                                </View>
                                                <Text style={[s.cardBio, { fontSize: 12, flex: 1 }]}>
                                                    {displayName} · {new Date(h.created_at).toLocaleDateString()} · {h.type} · {Math.round(h.minutes_used ?? 0)} min
                                                    {(() => {
                                                        const rate = (h.rate_per_min as number | null | undefined) || earnings?.rate_per_min;
                                                        const earned = rate ? rate * (h.minutes_used ?? 0) * 0.80 : null;
                                                        return earned != null ? ` · ${CURRENCY_SYMBOLS[earnings?.earned_currency ?? "INR"] ?? "₹"}${earned.toFixed(2)} earned` : "";
                                                    })()}
                                                </Text>
                                                {h.rating != null && (
                                                    <Text style={{ color: "#fbbf24", fontWeight: "700", fontSize: 13 }}>★ {h.rating}</Text>
                                                )}
                                            </View>
                                            {h.review_text && (
                                                <Text style={[s.cardBio, { fontStyle: "italic", marginBottom: 8 }]}>"{h.review_text}"</Text>
                                            )}
                                            {/* Notes + Block buttons */}
                                            <View style={{ flexDirection: "row", gap: 8 }}>
                                                <TouchableOpacity
                                                    style={{ flex: 1, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(139,92,246,0.35)", alignItems: "center", backgroundColor: "rgba(139,92,246,0.08)" }}
                                                    onPress={() => openNote(h.id)}>
                                                    <Text style={{ color: "#a78bfa", fontSize: 12, fontWeight: "600" }}>
                                                        {openNoteId === h.id ? "Close Notes" : "📝 Notes"}
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={{ flex: 1, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(248,113,113,0.35)", alignItems: "center", backgroundColor: "rgba(248,113,113,0.08)", opacity: blockingId === h.user_id ? 0.5 : 1 }}
                                                    onPress={() => blockUser(h.user_id)}
                                                    disabled={blockingId === h.user_id}>
                                                    <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "600" }}>🚫 Block</Text>
                                                </TouchableOpacity>
                                            </View>
                                            {/* Inline notes editor */}
                                            {openNoteId === h.id && (
                                                <View style={{ marginTop: 10 }}>
                                                    <Text style={[s.cardBio, { fontSize: 10, marginBottom: 4, opacity: 0.6 }]}>
                                                        🔒 Private — only visible to you
                                                    </Text>
                                                    <TextInput
                                                        style={[s.messageInput, { minHeight: 80, marginBottom: 8 }]}
                                                        value={noteContent}
                                                        onChangeText={setNoteContent}
                                                        placeholder="Add a private note about this session..."
                                                        placeholderTextColor={colors.textSecondary}
                                                        multiline
                                                        maxLength={2000}
                                                    />
                                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                                        <Text style={[s.cardBio, { fontSize: 10 }]}>{noteContent.length}/2000</Text>
                                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                                            {noteSaved && <Text style={{ color: "#34d399", fontSize: 11 }}>Saved ✓</Text>}
                                                            <TouchableOpacity
                                                                activeOpacity={0.75}
                                                                style={[s.primaryBtn, { paddingHorizontal: 16, paddingVertical: 8 }, noteSaving && { opacity: 0.6 }]}
                                                                onPress={() => saveNote(h.id)}
                                                                disabled={noteSaving}>
                                                                {noteSaving
                                                                    ? <ActivityIndicator color="#fff" size="small" />
                                                                    : <Text style={[s.primaryBtnText, { fontSize: 13 }]}>Save</Text>}
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

// ── Register View ──────────────────────────────────────────────────────────────

const COUNTRY_CODES_DIAL = [
    { code: "+91",  name: "India",          flag: "🇮🇳" },
    { code: "+1",   name: "USA / Canada",   flag: "🇺🇸" },
    { code: "+44",  name: "United Kingdom", flag: "🇬🇧" },
    { code: "+61",  name: "Australia",      flag: "🇦🇺" },
    { code: "+64",  name: "New Zealand",    flag: "🇳🇿" },
    { code: "+65",  name: "Singapore",      flag: "🇸🇬" },
    { code: "+60",  name: "Malaysia",       flag: "🇲🇾" },
    { code: "+63",  name: "Philippines",    flag: "🇵🇭" },
    { code: "+66",  name: "Thailand",       flag: "🇹🇭" },
    { code: "+62",  name: "Indonesia",      flag: "🇮🇩" },
    { code: "+84",  name: "Vietnam",        flag: "🇻🇳" },
    { code: "+880", name: "Bangladesh",     flag: "🇧🇩" },
    { code: "+92",  name: "Pakistan",       flag: "🇵🇰" },
    { code: "+94",  name: "Sri Lanka",      flag: "🇱🇰" },
    { code: "+977", name: "Nepal",          flag: "🇳🇵" },
    { code: "+975", name: "Bhutan",         flag: "🇧🇹" },
    { code: "+960", name: "Maldives",       flag: "🇲🇻" },
    { code: "+971", name: "UAE",            flag: "🇦🇪" },
    { code: "+966", name: "Saudi Arabia",   flag: "🇸🇦" },
    { code: "+974", name: "Qatar",          flag: "🇶🇦" },
    { code: "+965", name: "Kuwait",         flag: "🇰🇼" },
    { code: "+973", name: "Bahrain",        flag: "🇧🇭" },
    { code: "+968", name: "Oman",           flag: "🇴🇲" },
    { code: "+962", name: "Jordan",         flag: "🇯🇴" },
    { code: "+972", name: "Israel",         flag: "🇮🇱" },
    { code: "+49",  name: "Germany",        flag: "🇩🇪" },
    { code: "+33",  name: "France",         flag: "🇫🇷" },
    { code: "+39",  name: "Italy",          flag: "🇮🇹" },
    { code: "+34",  name: "Spain",          flag: "🇪🇸" },
    { code: "+31",  name: "Netherlands",    flag: "🇳🇱" },
    { code: "+46",  name: "Sweden",         flag: "🇸🇪" },
    { code: "+47",  name: "Norway",         flag: "🇳🇴" },
    { code: "+45",  name: "Denmark",        flag: "🇩🇰" },
    { code: "+41",  name: "Switzerland",    flag: "🇨🇭" },
    { code: "+81",  name: "Japan",          flag: "🇯🇵" },
    { code: "+82",  name: "South Korea",    flag: "🇰🇷" },
    { code: "+86",  name: "China",          flag: "🇨🇳" },
];

const COC_CLAUSES_REG = [
    "I am a peer supporter, not a licensed clinical professional, and I will not present myself as a therapist, psychiatrist, or medical doctor.",
    "I will not provide diagnosis, medical advice, prescriptions, or treatment plans of any kind.",
    "I will maintain strict confidentiality of all user conversations and never share personally identifiable information with third parties.",
    "I will never solicit personal contact information (phone number, home address, personal email) from users outside the Imotara platform.",
    "I will immediately refer users to emergency services whenever I believe there is risk to life, and end the session if necessary.",
    "I will not engage in any romantic, sexual, or emotionally exploitative conduct with users at any time.",
    "I accept that Imotara may suspend or terminate my account without prior notice if I violate this Code of Conduct or the Platform's Terms of Service.",
    "I understand that session summaries or transcripts may be reviewed by Imotara's Trust & Safety team solely for quality assurance and compliance purposes.",
    "I will not use sessions to advertise competing services, redirect users to external platforms, or solicit payments outside the Imotara wallet.",
    "I commit to maintaining reasonable response times and notifying users promptly if I need to cancel a scheduled session.",
    "I agree to uphold Imotara's community standards of respect, empathy, and non-discrimination at all times.",
];

const PLATFORM_DISCLAIMER_REG = [
    "Imotara Connect is a peer-support marketplace, not a medical or mental health service. Conversations with Companions do not constitute therapy, counselling, or clinical treatment.",
    "All per-minute session charges are processed through the Imotara wallet system. Session fees are non-refundable once a session is in progress, except in cases of verified technical failure.",
    "Imotara is not responsible for advice given by Companions and does not guarantee outcomes. Users seek support at their own discretion.",
    "All disputes between users and Companions must be submitted through Imotara's in-platform resolution process within 7 days of the session.",
    "Imotara reserves the right to modify payout rates, platform fees, and policies with 30 days' notice. Continued use constitutes acceptance.",
];

const AVAIL_TIMEZONES_REG = [
    "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo",
    "Asia/Seoul", "Asia/Shanghai", "Asia/Dhaka", "Asia/Karachi",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Sao_Paulo", "Australia/Sydney", "Pacific/Auckland",
];

const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS_OF_YEAR = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
const YEAR_OPTIONS = ["2025", "2026", "2027", "2028", "Ongoing"];

interface AvailWindow { days: string[]; months: string[]; start: string; end: string; timezone: string; year: string; }

function ChipSelector({ label, options, selected, onToggle, colors }: {
    label: string; options: string[]; selected: string[];
    onToggle: (v: string) => void; colors: any;
}) {
    const s = styles(colors);
    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={[s.cardBio, { marginBottom: 8, fontWeight: "600" }]}>{label}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {options.map((opt) => {
                    const active = selected.includes(opt);
                    return (
                        <TouchableOpacity
                            key={opt}
                            style={[s.filterChip, active && s.filterChipActive]}
                            onPress={() => onToggle(opt)}>
                            <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{opt}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

// Single-select language dropdown — shows selected label, opens a modal list on tap.
function LangDropdown({ value, onChange, colors, style }: {
    value: string; onChange: (code: string) => void; colors: any; style?: any;
}) {
    const [open, setOpen] = useState(false);
    const insets = useSafeAreaInsets();
    const selected = LANGUAGE_OPTIONS.find(l => l.code === value);
    return (
        <View style={style}>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12,
                    borderWidth: 1, borderColor: colors.border,
                    backgroundColor: colors.surfaceSoft,
                }}>
                <Text style={{ fontSize: 15, color: colors.textPrimary, fontWeight: "500" }}>
                    {selected?.label ?? "Select language"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} activeOpacity={1} onPress={() => setOpen(false)} />
                <View style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
                    paddingBottom: Math.max(insets.bottom, 16), maxHeight: "65%",
                }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>Select Language</Text>
                        <TouchableOpacity onPress={() => setOpen(false)}>
                            <Ionicons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={LANGUAGE_OPTIONS}
                        keyExtractor={item => item.code}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => { onChange(item.code); setOpen(false); }}
                                style={{
                                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                                    paddingHorizontal: 20, paddingVertical: 14,
                                    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
                                    backgroundColor: item.code === value ? (colors.primaryTint ?? "rgba(99,102,241,0.08)") : "transparent",
                                }}>
                                <Text style={{ fontSize: 15, color: item.code === value ? colors.primary : colors.textPrimary }}>
                                    {item.label}
                                </Text>
                                {item.code === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </Modal>
        </View>
    );
}

function LangChipSelector({ label, selected, onToggle, colors }: {
    label: string; selected: string[];
    onToggle: (code: string) => void; colors: any;
}) {
    const s = styles(colors);
    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={[s.cardBio, { marginBottom: 8, fontWeight: "600" }]}>{label}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {LANGUAGE_OPTIONS.map((opt) => {
                    const active = selected.includes(opt.code);
                    return (
                        <TouchableOpacity
                            key={opt.code}
                            style={[s.filterChip, active && s.filterChipActive]}
                            onPress={() => onToggle(opt.code)}>
                            <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

function TField({ label, value, onChange, placeholder, multiline, keyboard, colors }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; multiline?: boolean; keyboard?: any; colors: any;
}) {
    const s = styles(colors);
    return (
        <View style={{ marginBottom: 12 }}>
            <Text style={[s.cardBio, { marginBottom: 4, fontWeight: "600" }]}>{label}</Text>
            <TextInput
                style={[s.messageInput, multiline && { minHeight: 80, textAlignVertical: "top" }]}
                value={value} onChangeText={onChange}
                placeholder={placeholder} placeholderTextColor={colors.textSecondary}
                multiline={multiline} keyboardType={keyboard ?? "default"}
            />
        </View>
    );
}

function RRow({ label, value, colors }: { label: string; value: string; colors: any }) {
    if (!value) return null;
    return (
        <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 2 }}>{label}</Text>
            <Text style={{ fontSize: 14, color: colors.textPrimary }}>{value}</Text>
        </View>
    );
}

function RegCheckbox({ value, onPress, label, colors }: { value: boolean; onPress: () => void; label: string; colors: any }) {
    return (
        <TouchableOpacity style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 12 }}
            onPress={onPress} activeOpacity={0.7}>
            <View style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 2, marginTop: 1,
                borderColor: value ? colors.primary : colors.border,
                backgroundColor: value ? colors.primary : "transparent",
                alignItems: "center", justifyContent: "center",
            }}>
                {value && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 13, flex: 1, lineHeight: 20 }}>{label}</Text>
        </TouchableOpacity>
    );
}

function RegisterView({ colors, insets, accessToken, userEmail, onBack, onSuccess }: {
    colors: any; insets: any; accessToken: string | null;
    userEmail: string | null;
    onBack: () => void; onSuccess: () => void;
}) {
    const TOTAL_STEPS = 5;
    const [step, setStep] = useState(1);
    const s = styles(colors);

    // Step 1
    const [preferredLang, setPreferredLang] = useState("en");
    const [displayName, setDisplayName] = useState("");
    const [gender, setGender] = useState("");
    const [roleCategory, setRoleCategory] = useState("wellness_companion");
    const [contactEmail, setContactEmail] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [countryCode, setCountryCode] = useState("+91");
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [socialLinks, setSocialLinks] = useState<string[]>(["", ""]);
    const [photoUrl, setPhotoUrl] = useState("");
    const [photoLocalUri, setPhotoLocalUri] = useState<string | null>(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [expertiseTags, setExpertiseTags] = useState<string[]>([]);
    const [languages, setLanguages] = useState<string[]>([]);
    const [sessionTypes, setSessionTypes] = useState<string[]>([]);
    const [dialPickerOpen, setDialPickerOpen] = useState(false);

    // Step 2
    const [bio, setBio] = useState("");
    const [ratePerMin, setRatePerMin] = useState("10");
    const [currencyCode, setCurrencyCode] = useState("INR");
    const [availSlots, setAvailSlots] = useState<AvailWindow[]>([
        { days: [], months: [], start: "09:00", end: "21:00", timezone: "Asia/Kolkata", year: "Ongoing" },
    ]);
    const [tzPickerIdx, setTzPickerIdx] = useState<number | null>(null);

    // Step 3 — payout
    const [payoutMethod, setPayoutMethod] = useState<"upi" | "paypal" | "bank_in" | "bank_int" | "">("");
    const [upiId, setUpiId] = useState("");
    const [paypalEmail, setPaypalEmail] = useState("");
    const [bankAcc, setBankAcc] = useState("");
    const [bankIfsc, setBankIfsc] = useState("");
    const [bankHolder, setBankHolder] = useState("");
    const [bankName, setBankName] = useState("");
    const [bankSwift, setBankSwift] = useState("");
    const [bankIban, setBankIban] = useState("");

    // Step 3 — document uploads
    type DocKey = "selfie" | "photo_id" | "address_proof" | "age_proof" | "eligibility";
    const DOC_FIELDS: { key: DocKey; label: string; hint: string }[] = [
        { key: "selfie",       label: "Verification Selfie *",          hint: "Clear selfie holding your photo ID" },
        { key: "photo_id",     label: "Government Photo ID *",          hint: "Passport, Aadhaar, Driver's License, or National ID" },
        { key: "address_proof",label: "Proof of Address *",             hint: "Utility bill, bank statement, or official letter (≤3 months old)" },
        { key: "age_proof",    label: "Proof of Age *",                 hint: "Birth certificate or ID showing date of birth" },
        { key: "eligibility",  label: "Eligibility / Qualification (optional)", hint: "Certificate, training record, or any relevant qualification" },
    ];
    const [docs, setDocs] = useState<Record<DocKey, { path: string; name: string } | null>>({
        selfie: null, photo_id: null, address_proof: null, age_proof: null, eligibility: null,
    });
    const [docUploading, setDocUploading] = useState<DocKey | null>(null);
    const [selfieFromProfile, setSelfieFromProfile] = useState(false);

    // Step 4
    const [consent1, setConsent1] = useState(false);
    const [consent2, setConsent2] = useState(false);
    const [consent3, setConsent3] = useState(false);
    const [consent4, setConsent4] = useState(false);
    const [consent5, setConsent5] = useState(false);

    // Step 5
    const [agreeInfoTrue, setAgreeInfoTrue] = useState(false);
    const [digitalSig, setDigitalSig] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [registered, setRegistered] = useState(false);

    // Auto-detect country code from device timezone
    useEffect(() => {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
            const TZ_MAP: Record<string, string> = {
                "Asia/Kolkata": "+91", "Asia/Calcutta": "+91",
                "Asia/Dubai": "+971",  "Asia/Singapore": "+65",
                "Asia/Tokyo": "+81",   "Asia/Seoul": "+82",
                "Asia/Shanghai": "+86","Asia/Dhaka": "+880",
                "Asia/Karachi": "+92", "Asia/Colombo": "+94",
                "Europe/London": "+44","Europe/Paris": "+33",
                "Europe/Berlin": "+49","America/New_York": "+1",
                "America/Chicago": "+1","America/Denver": "+1",
                "America/Los_Angeles": "+1","America/Sao_Paulo": "+55",
                "Australia/Sydney": "+61","Pacific/Auckland": "+64",
            };
            const detected = TZ_MAP[tz];
            if (detected) setCountryCode(detected);
        } catch { /* ignore */ }
    }, []);

    function buildPayoutInfo() {
        if (payoutMethod === "upi")      return { method: "upi",      upi_id: upiId.trim() };
        if (payoutMethod === "paypal")   return { method: "paypal",   paypal_email: paypalEmail.trim() };
        if (payoutMethod === "bank_in")  return { method: "bank_in",  account_number: bankAcc.trim(), ifsc_code: bankIfsc.trim(), account_holder: bankHolder.trim(), bank_name: bankName.trim() };
        if (payoutMethod === "bank_int") return { method: "bank_int", swift_code: bankSwift.trim(), iban: bankIban.trim(), account_holder: bankHolder.trim(), bank_name: bankName.trim() };
        return null;
    }

    async function pickAndUploadPhoto() {
        if (!accessToken) { Alert.alert("Sign in required", "Please sign in before uploading."); return; }
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { Alert.alert("Permission required", "Allow photo library access to upload a profile photo."); return; }
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, aspect: [1, 1], quality: 0.7 });
            if (result.canceled || !result.assets[0]) return;
            const asset = result.assets[0];
            if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
                Alert.alert("File too large", "Profile photo must be under 10 MB."); return;
            }
            setPhotoLocalUri(asset.uri);
            setPhotoUploading(true);
            const uploadResult = await FileSystem.uploadAsync(buildApiUrl("/api/connect/upload-photo"), asset.uri, {
                httpMethod: "POST",
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: "file",
                headers: { Authorization: `Bearer ${accessToken ?? ""}` },
            });
            const data = JSON.parse(uploadResult.body);
            if (data.url) setPhotoUrl(data.url);
            else Alert.alert("Upload failed", data.error ?? "Could not upload photo");
        } catch {
            Alert.alert("Upload failed", "Please try again.");
        } finally {
            setPhotoUploading(false);
        }
    }

    async function pickAndUploadDoc(key: DocKey) {
        if (!accessToken) { Alert.alert("Sign in required", "Please sign in before uploading."); return; }
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            if (asset.size && asset.size > 20 * 1024 * 1024) {
                Alert.alert("File too large", "Documents must be under 20 MB."); return;
            }
            setDocUploading(key);
            const uploadResult = await FileSystem.uploadAsync(buildApiUrl("/api/connect/upload-doc"), asset.uri, {
                httpMethod: "POST",
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: "file",
                parameters: { doc_type: key },
                headers: { Authorization: `Bearer ${accessToken ?? ""}` },
            });
            const data = JSON.parse(uploadResult.body);
            if (data.path) {
                setDocs(prev => ({ ...prev, [key]: { path: data.path, name: asset.name ?? key } }));
            } else {
                Alert.alert("Upload failed", data.error ?? "Could not upload document");
            }
        } catch {
            Alert.alert("Upload failed", "Please try again.");
        } finally {
            setDocUploading(null);
        }
    }

    async function submit() {
        if (!agreeInfoTrue) { setError("Please confirm all submitted information is true."); return; }
        if (!digitalSig.trim()) { setError("Please enter your name as digital signature."); return; }
        if (!accessToken) { setError("Sign in required."); return; }
        setLoading(true); setError("");
        try {
            const fullPhone = contactPhone.trim() ? `${countryCode}${contactPhone.trim()}` : "";
            const filteredSocials = socialLinks.filter((l) => l.trim().length > 0);
            const availWindows = availSlots
                .filter((sl) => sl.days.length > 0)
                .map((sl) => ({ days: sl.days, months: sl.months, start: sl.start, end: sl.end, timezone: sl.timezone, year: sl.year }));
            const availNote = availWindows.length > 0
                ? availWindows.map(w => `${w.days.join(", ")} ${w.start}–${w.end} ${w.timezone}${w.months.length > 0 ? ` (${w.months.slice(0,3).join(", ")}${w.months.length > 3 ? "..." : ""})` : ""}`).join("; ")
                : null;
            const verificationDocs: Record<string, unknown> = {};
            for (const field of DOC_FIELDS) {
                if (field.key === "selfie" && selfieFromProfile) {
                    verificationDocs[field.key] = { same_as_profile: true };
                } else if (docs[field.key]) {
                    verificationDocs[field.key] = { path: docs[field.key]!.path };
                }
            }
            const res = await cfetch(buildApiUrl("/api/connect/consultant/register"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({
                    display_name:         displayName.trim(),
                    gender,
                    role_category:        roleCategory,
                    contact_email:        contactEmail.trim() || null,
                    contact_phone:        fullPhone || null,
                    website_url:          websiteUrl.trim() || null,
                    social_links:         filteredSocials.length > 0 ? filteredSocials : null,
                    photo_url:            photoUrl.trim() || null,
                    bio:                  bio.trim(),
                    expertise_tags:       expertiseTags,
                    languages,
                    session_types:        sessionTypes,
                    rate_per_min:         parseFloat(ratePerMin),
                    currency_code:        currencyCode,
                    availability_windows: availWindows.length > 0 ? availWindows : null,
                    availability_note:    availNote,
                    payout_info:          buildPayoutInfo(),
                    verification_docs:    Object.keys(verificationDocs).length > 0 ? verificationDocs : null,
                    coc_agreed:           true,
                    digital_signature:    digitalSig.trim(),
                    preferred_lang:       preferredLang,
                }),
            });
            const d = await res.json();
            if (!d.ok) { setError(d.error ?? "Registration failed"); return; }
            setRegistered(true);
        } catch {
            setError("Network error — please try again.");
        } finally {
            setLoading(false);
        }
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim());
    const displayNameValid = displayName.trim().length >= 2 && displayName.trim().length <= 60
        && /^[\p{L}\p{M}\s'\-.]+$/u.test(displayName.trim());
    const phoneValid = /^\d{5,15}$/.test(contactPhone.trim());
    const rateNum = parseFloat(ratePerMin);
    const step1Valid = displayNameValid && gender.length > 0 &&
        expertiseTags.length > 0 && languages.length > 0 && sessionTypes.length > 0 &&
        contactEmail.trim().length > 0 && emailValid && phoneValid;
    const step2Valid = bio.trim().length >= 30 && bio.trim().length <= 500 && rateNum > 0 && rateNum <= 10000;
    const requiredDocs = (["selfie", "photo_id", "address_proof", "age_proof"] as DocKey[]);
    const docsValid = requiredDocs.every(k => k === "selfie" ? (selfieFromProfile || docs.selfie !== null) : docs[k] !== null);
    let step3Valid = false;
    if (payoutMethod === "upi")           step3Valid = upiId.trim().length > 0 && docsValid;
    else if (payoutMethod === "paypal")   step3Valid = paypalEmail.trim().length > 0 && docsValid;
    else if (payoutMethod === "bank_in")  step3Valid = bankAcc.trim().length > 0 && bankIfsc.trim().length > 0 && bankHolder.trim().length > 0 && bankName.trim().length > 0 && docsValid;
    else if (payoutMethod === "bank_int") step3Valid = bankSwift.trim().length > 0 && bankIban.trim().length > 0 && bankHolder.trim().length > 0 && bankName.trim().length > 0 && docsValid;
    const step4Valid = consent1 && consent2 && consent3 && consent4 && consent5;
    const step5Valid = agreeInfoTrue && digitalSig.trim().length > 0;

    if (registered) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
                <Text style={[s.cardName, { fontSize: 22, textAlign: "center", marginBottom: 8 }]}>Application Submitted!</Text>
                <Text style={[s.cardBio, { textAlign: "center", marginBottom: 24, lineHeight: 20 }]}>
                    Your application is under review. We&apos;ll notify you within 2–5 business days.
                </Text>
                <TouchableOpacity
                    style={[s.primaryBtn, { width: "100%" }]}
                    onPress={() => onSuccess()}
                >
                    <Text style={s.primaryBtnText}>Go to Dashboard</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={[s.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === "ios" ? "padding" : "height"}>

            <View style={s.header}>
                <TouchableOpacity onPress={step > 1 ? () => { setStep(step - 1); setError(""); } : onBack} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Become a Companion ({step}/{TOTAL_STEPS})</Text>
                <View style={{ width: 36 }} />
            </View>

            {/* Signed-in indicator + sign-out */}
            {userEmail && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, marginRight: 8 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#34d399", flexShrink: 0 }} />
                        <Text style={{ fontSize: 11, color: "#6ee7b7", flex: 1 }} numberOfLines={1}>{userEmail}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { supabase.auth.signOut(); onBack(); }}>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, textDecorationLine: "underline" }}>Sign out</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={{ height: 3, backgroundColor: colors.border }}>
                <View style={{ height: 3, width: `${(step / TOTAL_STEPS) * 100}%` as any, backgroundColor: colors.primary }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

                {/* ── STEP 1: Profile & Contact ─────────────────────────── */}
                {step === 1 && (
                    <View>
                        <Text style={[s.cardName, { marginBottom: 16 }]}>Step 1 — Profile & Contact</Text>

                        <TField label="Display Name *" value={displayName} onChange={setDisplayName}
                            placeholder="Your name as shown to users" colors={colors} />
                        {displayName.trim().length > 0 && !displayNameValid && (
                            <Text style={{ fontSize: 11, color: "#ef4444", marginTop: -8, marginBottom: 8 }}>
                                {displayName.trim().length < 2 ? "Name must be at least 2 characters" :
                                 displayName.trim().length > 60 ? "Name must be 60 characters or fewer" :
                                 "Name must contain only letters, spaces, hyphens, apostrophes, or dots"}
                            </Text>
                        )}

                        <View style={{ marginBottom: 12 }}>
                            <Text style={[s.cardBio, { marginBottom: 4, fontWeight: "600" }]}>Gender *</Text>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                                {([ ["male","👨 Male"], ["female","👩 Female"] ] as [string,string][]).map(([g, lbl]) => (
                                    <TouchableOpacity key={g}
                                        style={[s.durationBtn, gender===g && s.durationBtnActive, { flex: 1 }]}
                                        onPress={() => setGender(g)}>
                                        <Text style={[s.durationBtnText, gender===g && s.durationBtnTextActive]}>{lbl}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Role Category */}
                        <View style={{ marginBottom: 12 }}>
                            <Text style={[s.cardBio, { marginBottom: 6, fontWeight: "600" }]}>Role Category *</Text>
                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>
                                The relationship type you will offer. Only Wellness Companion is available now.
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                {ROLE_CATEGORIES.map((rc) => {
                                    const active = roleCategory === rc.key;
                                    const locked = rc.phase > 1;
                                    return (
                                        <TouchableOpacity
                                            key={rc.key}
                                            disabled={locked}
                                            onPress={() => !locked && setRoleCategory(rc.key)}
                                            style={[
                                                s.durationBtn,
                                                active && s.durationBtnActive,
                                                locked && { opacity: 0.35 },
                                                { flex: 0, paddingHorizontal: 12, paddingVertical: 7 },
                                            ]}>
                                            <Text style={[s.durationBtnText, active && s.durationBtnTextActive, { fontSize: 12 }]}>
                                                {rc.icon} {rc.label}{locked ? " · Soon" : ""}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <TField label="Contact Email *" value={contactEmail} onChange={setContactEmail}
                            placeholder="your@email.com" keyboard="email-address" colors={colors} />
                        {contactEmail.length > 0 && !emailValid && (
                            <Text style={{ fontSize: 11, color: "#ef4444", marginTop: -8, marginBottom: 8 }}>Enter a valid email address</Text>
                        )}

                        <View style={{ marginBottom: 12 }}>
                            <Text style={[s.cardBio, { marginBottom: 4, fontWeight: "600" }]}>Contact Phone *</Text>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                                <TouchableOpacity onPress={() => setDialPickerOpen(true)}
                                    style={[s.messageInput, { paddingHorizontal: 10, minWidth: 88, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 4 }]}>
                                    <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                                        {COUNTRY_CODES_DIAL.find(c => c.code === countryCode)?.flag ?? "🌐"} {countryCode}
                                    </Text>
                                    <Ionicons name="chevron-down" size={11} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TextInput style={[s.messageInput, { flex: 1 }]}
                                    value={contactPhone} onChangeText={setContactPhone}
                                    placeholder="Phone number" placeholderTextColor={colors.textSecondary}
                                    keyboardType="phone-pad" />
                            </View>
                            {contactPhone.trim().length > 0 && !phoneValid && (
                                <Text style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                                    Enter digits only, 5–15 characters (no spaces or dashes)
                                </Text>
                            )}
                        </View>

                        <TField label="Website (optional)" value={websiteUrl} onChange={setWebsiteUrl}
                            placeholder="https://yoursite.com" keyboard="url" colors={colors} />

                        <View style={{ marginBottom: 12 }}>
                            <Text style={[s.cardBio, { marginBottom: 4, fontWeight: "600" }]}>Social Links (optional)</Text>
                            {socialLinks.map((link, idx) => (
                                <View key={idx} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                                    <TextInput style={[s.messageInput, { flex: 1 }]}
                                        value={link}
                                        onChangeText={(v) => { const n=[...socialLinks]; n[idx]=v; setSocialLinks(n); }}
                                        placeholder={`Link ${idx+1} — LinkedIn, X, Instagram…`}
                                        placeholderTextColor={colors.textSecondary}
                                        keyboardType="url" autoCapitalize="none" />
                                    {socialLinks.length > 1 && (
                                        <TouchableOpacity style={[s.durationBtn, { paddingHorizontal: 10 }]}
                                            onPress={() => setSocialLinks(socialLinks.filter((_,i)=>i!==idx))}>
                                            <Ionicons name="close" size={16} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                            {socialLinks.length < 5 && (
                                <TouchableOpacity style={[s.durationBtn, { alignSelf: "flex-start" }]}
                                    onPress={() => setSocialLinks([...socialLinks, ""])}>
                                    <Text style={s.durationBtnText}>+ Add Link</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={{ marginBottom: 16 }}>
                            <Text style={[s.cardBio, { marginBottom: 8, fontWeight: "600" }]}>Profile Photo (optional)</Text>
                            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                                {(photoLocalUri || photoUrl) ? (
                                    <Image source={{ uri: photoLocalUri ?? photoUrl }}
                                        style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.primary }} />
                                ) : (
                                    <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
                                        <Ionicons name="person-outline" size={32} color={colors.textSecondary} />
                                    </View>
                                )}
                                <View style={{ flex: 1, gap: 8 }}>
                                    <TouchableOpacity
                                        style={[s.durationBtn, photoUploading && { opacity: 0.5 }]}
                                        disabled={photoUploading}
                                        onPress={pickAndUploadPhoto}>
                                        {photoUploading
                                            ? <ActivityIndicator size="small" color={colors.primary} />
                                            : <Text style={s.durationBtnText}>📷 Choose from Gallery</Text>}
                                    </TouchableOpacity>
                                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>Square photo recommended (1:1)</Text>
                                </View>
                            </View>
                        </View>

                        <ChipSelector label="Specialties *" options={EXPERTISE_OPTIONS}
                            selected={expertiseTags}
                            onToggle={(v) => setExpertiseTags(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev,v])}
                            colors={colors} />
                        <LangChipSelector label="Languages Spoken *" selected={languages}
                            onToggle={(code) => setLanguages(prev => prev.includes(code) ? prev.filter(x=>x!==code) : [...prev,code])}
                            colors={colors} />

                        <View style={{ marginBottom: 16 }}>
                            <Text style={[s.cardBio, { marginBottom: 6, fontWeight: "600" }]}>Primary Session Language *</Text>
                            <Text style={[s.cardBio, { fontSize: 11, color: colors.textSecondary, marginBottom: 8 }]}>
                                The language you prefer for sessions. Users who speak a different language can opt in to auto-translation.
                            </Text>
                            <LangDropdown value={preferredLang} onChange={setPreferredLang} colors={colors} />
                        </View>

                        <View style={{ marginBottom: 16 }}>
                            <Text style={[s.cardBio, { marginBottom: 8, fontWeight: "600" }]}>
                                Session Types * <Text style={{ fontWeight: "400", color: colors.textSecondary }}>(choose all you can offer)</Text>
                            </Text>
                            {SESSION_TYPE_OPTIONS.map((opt) => {
                                const locked = (opt as any).phase > 1;
                                const active = !locked && sessionTypes.includes(opt.key);
                                return (
                                    <TouchableOpacity
                                        key={opt.key}
                                        disabled={locked}
                                        style={{
                                            flexDirection: "row", alignItems: "center", gap: 12,
                                            borderWidth: 1.5, borderRadius: 14,
                                            borderColor: active ? colors.primary : colors.border,
                                            backgroundColor: active ? "rgba(139,92,246,0.10)" : "transparent",
                                            paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
                                            opacity: locked ? 0.45 : 1,
                                        }}
                                        onPress={() => !locked && setSessionTypes(prev =>
                                            prev.includes(opt.key) ? prev.filter(x => x !== opt.key) : [...prev, opt.key]
                                        )}>
                                        <Text style={{ fontSize: 24 }}>{opt.icon}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: "600", color: active ? colors.primary : colors.textPrimary }}>
                                                {opt.label}{locked ? " · Coming soon" : ""}
                                            </Text>
                                        </View>
                                        {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity style={[s.primaryBtn, !step1Valid && { opacity: 0.5 }]}
                            disabled={!step1Valid} onPress={() => { setError(""); setStep(2); }}>
                            <Text style={s.primaryBtnText}>Next →</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── STEP 2: Bio & Availability ───────────────────────── */}
                {step === 2 && (
                    <View>
                        <Text style={[s.cardName, { marginBottom: 16 }]}>Step 2 — Bio & Availability</Text>

                        <TField label="Bio * (30–500 chars)" value={bio} onChange={setBio}
                            placeholder="Tell users about your background and approach" multiline colors={colors} />
                        {bio.length > 0 && (
                            <Text style={{ fontSize: 11, color: bio.length > 500 ? "#ef4444" : bio.length < 30 ? "#f97316" : colors.textSecondary, marginTop: -8, marginBottom: 8 }}>
                                {bio.length}/500{bio.length < 30 ? ` (min 30)` : ""}
                            </Text>
                        )}

                        <View style={{ marginBottom: 4 }}>
                            <Text style={[s.cardBio, { marginBottom: 4, fontWeight: "600" }]}>Rate per minute *</Text>
                            <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                                <TextInput style={[s.messageInput, { flex: 1 }]}
                                    value={ratePerMin} onChangeText={setRatePerMin}
                                    keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
                            </View>
                            {ratePerMin.trim().length > 0 && (rateNum <= 0 || isNaN(rateNum)) && (
                                <Text style={{ fontSize: 11, color: "#ef4444", marginTop: -2, marginBottom: 6 }}>
                                    Rate must be greater than 0
                                </Text>
                            )}
                            {ratePerMin.trim().length > 0 && rateNum > 10000 && (
                                <Text style={{ fontSize: 11, color: "#ef4444", marginTop: -2, marginBottom: 6 }}>
                                    Rate cannot exceed 10,000 per minute
                                </Text>
                            )}
                            <Text style={[s.cardBio, { marginBottom: 6, fontSize: 11 }]}>Currency</Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                                {["INR","USD","EUR","GBP","AED","SGD","AUD"].map((c) => (
                                    <TouchableOpacity key={c}
                                        style={[s.durationBtn, currencyCode===c && s.durationBtnActive]}
                                        onPress={() => setCurrencyCode(c)}>
                                        <Text style={[s.durationBtnText, currencyCode===c && s.durationBtnTextActive]}>{c}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {rateNum > 0 && rateNum <= 10000 && (
                            <View style={[s.card, { marginBottom: 16, backgroundColor: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.25)" }]}>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Earnings preview (80% platform share)</Text>
                                <Text style={{ fontSize: 15, color: "#34d399", fontWeight: "700" }}>
                                    {CURRENCY_SYMBOLS[currencyCode] ?? currencyCode}{(rateNum * 0.8).toFixed(2)}/min
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                                    30-min session ≈ {CURRENCY_SYMBOLS[currencyCode] ?? currencyCode}{(rateNum * 0.8 * 30).toFixed(0)}
                                </Text>
                            </View>
                        )}

                        <Text style={[s.cardBio, { marginBottom: 8, fontWeight: "600" }]}>Availability Windows</Text>
                        {availSlots.map((slot, idx) => (
                            <View key={idx} style={[s.card, { marginBottom: 10, padding: 12 }]}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                                    <Text style={[s.cardBio, { fontWeight: "600" }]}>Window {idx+1}</Text>
                                    {availSlots.length > 1 && (
                                        <TouchableOpacity onPress={() => setAvailSlots(availSlots.filter((_,i)=>i!==idx))}>
                                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>Days</Text>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                    {DAYS_FULL.map((d, di) => {
                                        const active = slot.days.includes(d);
                                        return (
                                            <TouchableOpacity key={d}
                                                style={[s.filterChip, active && s.filterChipActive]}
                                                onPress={() => {
                                                    const n=[...availSlots];
                                                    n[idx]={...slot, days: active ? slot.days.filter(x=>x!==d) : [...slot.days,d]};
                                                    setAvailSlots(n);
                                                }}>
                                                <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{DAYS_SHORT[di]}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>Months (leave empty = all year)</Text>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                    {MONTHS_OF_YEAR.map((m) => {
                                        const active = slot.months.includes(m);
                                        return (
                                            <TouchableOpacity key={m}
                                                style={[s.filterChip, active && s.filterChipActive]}
                                                onPress={() => {
                                                    const n=[...availSlots];
                                                    n[idx]={...slot, months: active ? slot.months.filter(x=>x!==m) : [...slot.months,m]};
                                                    setAvailSlots(n);
                                                }}>
                                                <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{m.slice(0,3)}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>Year</Text>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                    {YEAR_OPTIONS.map((y) => {
                                        const active = slot.year === y;
                                        return (
                                            <TouchableOpacity key={y}
                                                style={[s.filterChip, active && s.filterChipActive]}
                                                onPress={() => {
                                                    const n=[...availSlots]; n[idx]={...slot, year: y}; setAvailSlots(n);
                                                }}>
                                                <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{y}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <View style={{ flexDirection: "row", gap: 12, marginBottom: 8 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>Start (HH:MM)</Text>
                                        <TextInput style={[s.messageInput, { flex: 1, minHeight: 48 }]} value={slot.start}
                                            onChangeText={(v) => { const n=[...availSlots]; n[idx]={...slot,start:v}; setAvailSlots(n); }}
                                            placeholder="09:00" placeholderTextColor={colors.textSecondary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>End (HH:MM)</Text>
                                        <TextInput style={[s.messageInput, { flex: 1, minHeight: 48 }]} value={slot.end}
                                            onChangeText={(v) => { const n=[...availSlots]; n[idx]={...slot,end:v}; setAvailSlots(n); }}
                                            placeholder="21:00" placeholderTextColor={colors.textSecondary} />
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[s.messageInput, { flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:12 }]}
                                    onPress={() => setTzPickerIdx(idx)}>
                                    <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{slot.timezone}</Text>
                                    <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {availSlots.length < 5 && (
                            <TouchableOpacity style={[s.durationBtn, { alignSelf: "flex-start", marginBottom: 16, marginHorizontal: 2, paddingHorizontal: 16 }]}
                                onPress={() => setAvailSlots([...availSlots, { days:[], months:[], start:"09:00", end:"21:00", timezone:"Asia/Kolkata", year:"Ongoing" }])}>
                                <Text style={s.durationBtnText}>+ Add Window</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[s.primaryBtn, !step2Valid && { opacity: 0.5 }]}
                            disabled={!step2Valid} onPress={() => { setError(""); setStep(3); }}>
                            <Text style={s.primaryBtnText}>Next →</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── STEP 3: Identity Documents & Payout ──────────────── */}
                {step === 3 && (
                    <View>
                        <Text style={[s.cardName, { marginBottom: 16 }]}>Step 3 — Identity & Payout</Text>

                        {/* Document Uploads */}
                        <Text style={[s.cardBio, { fontWeight: "700", marginBottom: 4 }]}>Identity Verification *</Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 12 }}>
                            Documents are encrypted and only reviewed by Imotara's Trust & Safety team.
                        </Text>

                        {DOC_FIELDS.map((field) => {
                            const uploaded = field.key === "selfie" && selfieFromProfile ? true : docs[field.key] !== null;
                            const isUploading = docUploading === field.key;
                            return (
                                <View key={field.key} style={[s.card, { marginBottom: 10, padding: 12 }]}>
                                    <Text style={[s.cardBio, { fontWeight: "600", marginBottom: 2 }]}>{field.label}</Text>
                                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>{field.hint}</Text>

                                    {field.key === "selfie" && (
                                        <TouchableOpacity
                                            style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 }}
                                            onPress={() => setSelfieFromProfile(!selfieFromProfile)}>
                                            <View style={{
                                                width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                                                borderColor: selfieFromProfile ? colors.primary : colors.border,
                                                backgroundColor: selfieFromProfile ? colors.primary : "transparent",
                                                alignItems: "center", justifyContent: "center",
                                            }}>
                                                {selfieFromProfile && <Ionicons name="checkmark" size={12} color="#fff" />}
                                            </View>
                                            <Text style={{ fontSize: 12, color: colors.textPrimary }}>Use my profile photo as selfie</Text>
                                        </TouchableOpacity>
                                    )}

                                    {!(field.key === "selfie" && selfieFromProfile) && (
                                        <TouchableOpacity
                                            style={[s.durationBtn, uploaded && s.durationBtnActive, isUploading && { opacity: 0.6 }, { alignSelf: "flex-start" }]}
                                            disabled={isUploading}
                                            onPress={() => pickAndUploadDoc(field.key)}>
                                            {isUploading
                                                ? <ActivityIndicator size="small" color={colors.primary} />
                                                : <Text style={[s.durationBtnText, uploaded && s.durationBtnTextActive]}>
                                                    {uploaded ? `✓ ${docs[field.key]?.name ?? "Uploaded"}` : "📎 Upload File"}
                                                  </Text>}
                                        </TouchableOpacity>
                                    )}
                                    {field.key === "selfie" && selfieFromProfile && (
                                        <Text style={{ fontSize: 12, color: "#34d399" }}>✓ Using profile photo</Text>
                                    )}
                                </View>
                            );
                        })}

                        {/* Payout Method */}
                        <Text style={[s.cardBio, { marginBottom: 12, fontWeight: "700", marginTop: 8 }]}>Payout Method *</Text>
                        {([ ["upi","🇮🇳 UPI (India)"], ["paypal","🌐 PayPal"], ["bank_in","🏦 Bank Transfer (India)"], ["bank_int","🌍 International Bank Wire"] ] as [string,string][]).map(([v, lbl]) => (
                            <TouchableOpacity key={v}
                                style={[s.durationBtn, payoutMethod===v && s.durationBtnActive, { marginBottom: 8, alignSelf: "stretch", justifyContent: "flex-start", paddingHorizontal: 14 }]}
                                onPress={() => setPayoutMethod(v as any)}>
                                <Text style={[s.durationBtnText, payoutMethod===v && s.durationBtnTextActive, { fontSize: 14 }]}>{lbl}</Text>
                            </TouchableOpacity>
                        ))}

                        {payoutMethod === "upi" && (
                            <TField label="UPI ID *" value={upiId} onChange={setUpiId} placeholder="yourname@upi" colors={colors} />
                        )}
                        {payoutMethod === "paypal" && (
                            <TField label="PayPal Email *" value={paypalEmail} onChange={setPaypalEmail}
                                placeholder="paypal@email.com" keyboard="email-address" colors={colors} />
                        )}
                        {payoutMethod === "bank_in" && (<>
                            <TField label="Account Holder Name *" value={bankHolder} onChange={setBankHolder}
                                placeholder="Full name as on bank account" colors={colors} />
                            <TField label="Bank Name *" value={bankName} onChange={setBankName}
                                placeholder="e.g. HDFC Bank" colors={colors} />
                            <TField label="Account Number *" value={bankAcc} onChange={setBankAcc}
                                placeholder="Bank account number" keyboard="numeric" colors={colors} />
                            <TField label="IFSC Code *" value={bankIfsc} onChange={setBankIfsc}
                                placeholder="e.g. HDFC0001234" colors={colors} />
                        </>)}
                        {payoutMethod === "bank_int" && (<>
                            <TField label="Account Holder Name *" value={bankHolder} onChange={setBankHolder}
                                placeholder="Full name as on bank account" colors={colors} />
                            <TField label="Bank Name *" value={bankName} onChange={setBankName}
                                placeholder="e.g. Barclays Bank" colors={colors} />
                            <TField label="SWIFT / BIC *" value={bankSwift} onChange={setBankSwift}
                                placeholder="e.g. HDFCINBB" colors={colors} />
                            <TField label="IBAN *" value={bankIban} onChange={setBankIban}
                                placeholder="e.g. GB29NWBK60161331926819" colors={colors} />
                        </>)}

                        <TouchableOpacity style={[s.primaryBtn, !step3Valid && { opacity: 0.5 }]}
                            disabled={!step3Valid} onPress={() => { setError(""); setStep(4); }}>
                            <Text style={s.primaryBtnText}>Next →</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── STEP 4: Code of Conduct ───────────────────────────── */}
                {step === 4 && (
                    <View>
                        <Text style={[s.cardName, { marginBottom: 16 }]}>Step 4 — Code of Conduct</Text>

                        <View style={[s.card, { marginBottom: 16 }]}>
                            <Text style={[s.cardBio, { fontWeight: "700", marginBottom: 8 }]}>Code of Conduct</Text>
                            {COC_CLAUSES_REG.map((clause, i) => (
                                <Text key={i} style={[s.cardBio, { marginBottom: 5, lineHeight: 18 }]}>{i+1}. {clause}</Text>
                            ))}
                        </View>

                        <View style={[s.card, { marginBottom: 16 }]}>
                            <Text style={[s.cardBio, { fontWeight: "700", marginBottom: 8 }]}>Platform Disclaimer</Text>
                            {PLATFORM_DISCLAIMER_REG.map((para, i) => (
                                <Text key={i} style={[s.cardBio, { marginBottom: 5, lineHeight: 18 }]}>{para}</Text>
                            ))}
                        </View>

                        <Text style={[s.cardBio, { fontWeight: "700", marginBottom: 12 }]}>I confirm *</Text>
                        <RegCheckbox value={consent1} onPress={()=>setConsent1(!consent1)} colors={colors}
                            label="I confirm that I am 18 years of age or older. I understand that minors are not permitted to register as companions." />
                        <RegCheckbox value={consent2} onPress={()=>setConsent2(!consent2)} colors={colors}
                            label="I have read, understood, and agree to abide by the Imotara Wellness Companion Code of Conduct in its entirety." />
                        <RegCheckbox value={consent3} onPress={()=>setConsent3(!consent3)} colors={colors}
                            label="I have read and accept the Platform Disclaimer and Limitation of Liability, and agree that Imotara bears no responsibility for outcomes of sessions I conduct." />
                        <RegCheckbox value={consent4} onPress={()=>setConsent4(!consent4)} colors={colors}
                            label="I understand and acknowledge that Imotara Connect is a peer support platform only — not a medical, clinical, or therapeutic service — and I will clearly communicate this to users during sessions." />
                        <RegCheckbox value={consent5} onPress={()=>setConsent5(!consent5)} colors={colors}
                            label="I accept full responsibility for declaring and paying all applicable taxes on earnings received through Imotara in my jurisdiction, and indemnify Imotara against any tax-related claims." />

                        <TouchableOpacity style={[s.primaryBtn, !step4Valid && { opacity: 0.5 }]}
                            disabled={!step4Valid} onPress={() => { setError(""); setStep(5); }}>
                            <Text style={s.primaryBtnText}>Next →</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── STEP 5: Review & Sign ─────────────────────────────── */}
                {step === 5 && (
                    <View>
                        <Text style={[s.cardName, { marginBottom: 16 }]}>Step 5 — Review & Sign</Text>

                        <View style={[s.card, { marginBottom: 16 }]}>
                            <Text style={[s.cardBio, { fontWeight: "700", marginBottom: 10 }]}>Application Summary</Text>

                            {(photoLocalUri || photoUrl) && (
                                <View style={{ alignItems: "center", marginBottom: 12 }}>
                                    <Image source={{ uri: photoLocalUri ?? photoUrl }}
                                        style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.primary }} />
                                </View>
                            )}

                            <RRow label="Display Name"   value={displayName}                                                colors={colors} />
                            <RRow label="Gender"         value={gender}                                                      colors={colors} />
                            <RRow label="Contact Email"  value={contactEmail}                                                colors={colors} />
                            <RRow label="Contact Phone"  value={contactPhone ? `${countryCode} ${contactPhone}` : ""}       colors={colors} />
                            <RRow label="Website"        value={websiteUrl}                                                  colors={colors} />
                            <RRow label="Social Links"   value={socialLinks.filter(Boolean).join(", ")}                     colors={colors} />
                            <RRow label="Specialties"    value={expertiseTags.join(", ")}                                   colors={colors} />
                            <RRow label="Languages"      value={languages.map(code => LANGUAGE_OPTIONS.find(l=>l.code===code)?.label ?? code).join(", ")} colors={colors} />
                            <RRow label="Session Types"  value={sessionTypes.map(k => SESSION_TYPE_OPTIONS.find(o=>o.key===k)?.label ?? k).join(", ")} colors={colors} />
                            <RRow label="Bio"            value={bio.length > 120 ? bio.slice(0,120)+"…" : bio}              colors={colors} />
                            <RRow label="Rate"           value={`${ratePerMin} ${currencyCode}/min (you earn ${(parseFloat(ratePerMin)*0.8).toFixed(2)})`} colors={colors} />
                            <RRow label="Availability"   value={availSlots.filter(sl=>sl.days.length>0).map(sl=>`${sl.days.map(d=>d.slice(0,3)).join(",")} ${sl.start}–${sl.end} (${sl.timezone})`).join(" | ")} colors={colors} />
                            <RRow label="Payout Method"  value={payoutMethod}                                               colors={colors} />
                        </View>

                        <View style={[s.card, { marginBottom: 16 }]}>
                            <Text style={[s.cardBio, { fontWeight: "700", marginBottom: 8 }]}>Documents</Text>
                            {DOC_FIELDS.map((field) => {
                                const uploaded = field.key === "selfie" && selfieFromProfile ? true : docs[field.key] !== null;
                                return (
                                    <View key={field.key} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                        <Text style={{ fontSize: 14, color: uploaded ? "#34d399" : "#ef4444" }}>{uploaded ? "✓" : "✗"}</Text>
                                        <Text style={{ fontSize: 13, color: colors.textPrimary, flex: 1 }}>{field.label.replace(" *","")}</Text>
                                    </View>
                                );
                            })}
                        </View>

                        <View style={[s.card, { marginBottom: 16 }]}>
                            <Text style={[s.cardBio, { fontWeight: "700", marginBottom: 8 }]}>Legal Agreements</Text>
                            {[
                                { done: consent1, label: "Age confirmation (18+)" },
                                { done: consent2, label: "Code of Conduct" },
                                { done: consent3, label: "Platform Disclaimer" },
                                { done: consent4, label: "Peer-support acknowledgement" },
                                { done: consent5, label: "Tax responsibility" },
                            ].map((item, i) => (
                                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <Text style={{ fontSize: 14, color: item.done ? "#34d399" : "#ef4444" }}>{item.done ? "✓" : "✗"}</Text>
                                    <Text style={{ fontSize: 13, color: colors.textPrimary }}>{item.label}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={[s.card, { marginBottom: 16, backgroundColor: "rgba(251,191,36,0.10)", borderColor: "rgba(251,191,36,0.30)" }]}>
                            <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
                                I solemnly declare that all the information I have submitted in this application is true, accurate, and complete to the best of my knowledge. I understand that submitting false or misleading information may result in immediate rejection or termination of my Imotara Companion account.
                            </Text>
                        </View>

                        <RegCheckbox value={agreeInfoTrue} onPress={()=>setAgreeInfoTrue(!agreeInfoTrue)} colors={colors}
                            label="I confirm all submitted information is true and accurate to my knowledge." />

                        <View style={{ marginBottom: 16 }}>
                            <Text style={[s.cardBio, { marginBottom: 4, fontWeight: "600" }]}>Digital Signature *</Text>
                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>
                                Type your full name as it appears on your identity document as your digital signature.
                            </Text>
                            <TextInput
                                style={[s.messageInput, { fontSize: 18, fontStyle: "italic", fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" }]}
                                value={digitalSig} onChangeText={setDigitalSig}
                                placeholder="Your full name" placeholderTextColor={colors.textSecondary}
                            />
                            {digitalSig.trim().length > 0 && (
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                                    Signed as: {digitalSig.trim()} · {new Date().toLocaleDateString()}
                                </Text>
                            )}
                        </View>

                        {error !== "" && <Text style={s.errorText}>{error}</Text>}

                        <TouchableOpacity style={[s.primaryBtn, (!step5Valid || loading) && { opacity: 0.6 }]}
                            disabled={!step5Valid || loading} onPress={submit}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Submit Application</Text>}
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Country code picker */}
            <Modal visible={dialPickerOpen} transparent animationType="slide" onRequestClose={()=>setDialPickerOpen(false)}>
                <View style={{ flex:1, justifyContent:"flex-end", backgroundColor:"rgba(0,0,0,0.5)" }}>
                    <View style={{ backgroundColor: colors.surface, borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:"70%", padding:16 }}>
                        <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                            <Text style={[s.headerTitle, { fontSize:16 }]}>Country Code</Text>
                            <TouchableOpacity onPress={()=>setDialPickerOpen(false)}>
                                <Ionicons name="close" size={22} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList data={COUNTRY_CODES_DIAL} keyExtractor={(item)=>item.code+item.name}
                            renderItem={({item}) => (
                                <TouchableOpacity
                                    style={{ flexDirection:"row", alignItems:"center", gap:12, paddingVertical:10, borderBottomWidth:1, borderBottomColor:colors.border }}
                                    onPress={()=>{ setCountryCode(item.code); setDialPickerOpen(false); }}>
                                    <Text style={{ fontSize:22 }}>{item.flag}</Text>
                                    <Text style={{ flex:1, color:colors.textPrimary, fontSize:14 }}>{item.name}</Text>
                                    <Text style={{ color:colors.textSecondary, fontSize:14 }}>{item.code}</Text>
                                    {countryCode===item.code && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                                </TouchableOpacity>
                            )} />
                    </View>
                </View>
            </Modal>

            {/* Timezone picker */}
            <Modal visible={tzPickerIdx!==null} transparent animationType="slide" onRequestClose={()=>setTzPickerIdx(null)}>
                <View style={{ flex:1, justifyContent:"flex-end", backgroundColor:"rgba(0,0,0,0.5)" }}>
                    <View style={{ backgroundColor: colors.surface, borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:"60%", padding:16 }}>
                        <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                            <Text style={[s.headerTitle, { fontSize:16 }]}>Timezone</Text>
                            <TouchableOpacity onPress={()=>setTzPickerIdx(null)}>
                                <Ionicons name="close" size={22} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList data={AVAIL_TIMEZONES_REG} keyExtractor={(item)=>item}
                            renderItem={({item}) => {
                                const cur = tzPickerIdx!==null ? (availSlots[tzPickerIdx]?.timezone ?? "") : "";
                                return (
                                    <TouchableOpacity
                                        style={{ paddingVertical:12, borderBottomWidth:1, borderBottomColor:colors.border, flexDirection:"row", justifyContent:"space-between" }}
                                        onPress={()=>{
                                            if(tzPickerIdx!==null){
                                                const n=[...availSlots]; n[tzPickerIdx]={...n[tzPickerIdx], timezone:item};
                                                setAvailSlots(n);
                                            }
                                            setTzPickerIdx(null);
                                        }}>
                                        <Text style={{ color:colors.textPrimary, fontSize:14 }}>{item}</Text>
                                        {cur===item && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                                    </TouchableOpacity>
                                );
                            }} />
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
function styles(colors: any) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: colors.border,
        },
        headerTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
        headerAction: { padding: 4 },
        backBtn: { padding: 4, marginRight: 4 },
        tabBar: {
            flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSoft,
        },
        tabItem: { flex: 1, paddingVertical: 10, alignItems: "center" },
        tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
        tabLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: "500" },
        tabLabelActive: { color: colors.primary, fontWeight: "700" },
        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
        emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
        card: {
            backgroundColor: colors.surfaceSoft,
            borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: colors.border,
        },
        cardName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
        cardBio: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
        avatar: {
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.primaryTint,
            alignItems: "center", justifyContent: "center",
            overflow: "hidden",
        },
        avatarImg: { width: 56, height: 56, borderRadius: 28 },
        onlineDot: {
            position: "absolute", bottom: 2, right: 2,
            width: 12, height: 12, borderRadius: 6,
            backgroundColor: "#34d399",
            borderWidth: 2, borderColor: colors.background,
        },
        badge: {
            fontSize: 11, fontWeight: "600", paddingHorizontal: 7, paddingVertical: 3,
            borderRadius: 10, textAlign: "center", textAlignVertical: "center",
        },
        tag: {
            fontSize: 11, backgroundColor: colors.primaryTint,
            color: colors.primary, borderRadius: 20,
            paddingHorizontal: 9, paddingVertical: 3,
            borderWidth: 1, borderColor: "transparent",
            overflow: "hidden",
        },
        filterChip: {
            paddingHorizontal: 16, height: 40, borderRadius: 20,
            borderWidth: 1.5, borderColor: colors.border,
            backgroundColor: colors.surfaceSoft,
            flexShrink: 0,
            flexDirection: "row", alignItems: "center", justifyContent: "center",
        },
        filterChipRow: {
            flexDirection: "row", alignItems: "center",
        },
        filterChipActive: {
            borderColor: colors.primary,
            backgroundColor: colors.primaryTint,
        },
        filterChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
        filterChipTextActive: { color: colors.primary },
        rateText: { fontSize: 14, fontWeight: "700", color: colors.primary },
        ratingText: { fontSize: 12, color: colors.textSecondary },
        disclaimer: { fontSize: 11, color: colors.textSecondary, opacity: 0.6, textAlign: "center", paddingHorizontal: 16 },
        primaryBtn: {
            backgroundColor: colors.primary, borderRadius: 12,
            paddingVertical: 14, alignItems: "center",
        },
        primaryBtnText: { color: "#0f172a", fontWeight: "700", fontSize: 15 },
        inputRow: {
            flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 8,
            borderTopWidth: 1, borderTopColor: colors.border,
        },
        messageInput: {
            flex: 1,
            backgroundColor: colors.surfaceSoft,
            borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
            color: colors.textPrimary, fontSize: 14,
            borderWidth: 1, borderColor: colors.border,
        },
        sendBtn: {
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: "center", justifyContent: "center",
        },
        emergencyBtn: {
            width: 34, height: 34, borderRadius: 10,
            backgroundColor: "rgba(248,113,113,0.15)",
            alignItems: "center", justifyContent: "center",
        },
        modalBackdrop: {
            flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "flex-end",
        },
        modalSheet: {
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: 24,
            paddingBottom: 40,
        },
        durationBtn: {
            flex: 1, paddingVertical: 10, borderRadius: 10,
            borderWidth: 1.5, borderColor: colors.border,
            alignItems: "center",
        },
        durationBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
        durationBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
        durationBtnTextActive: { color: colors.primary },
        errorText: { color: "#f87171", fontSize: 13, marginBottom: 8 },
        input: {
            backgroundColor: colors.surfaceSoft, borderRadius: 12,
            paddingHorizontal: 14, paddingVertical: 12,
            borderWidth: 1, borderColor: colors.border, fontSize: 14,
        },
    });
}
