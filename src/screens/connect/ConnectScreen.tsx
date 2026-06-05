// src/screens/connect/ConnectScreen.tsx
// Imotara Connect — human consultancy marketplace for mobile.
// All sub-views are managed with local state to avoid a nested stack navigator.

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    View, Text, ScrollView, TouchableOpacity, TextInput, FlatList,
    ActivityIndicator, Alert, Modal, Linking, Platform, StyleSheet,
    KeyboardAvoidingView, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "../../theme/ThemeContext";
import { useAuth } from "../../auth/AuthContext";
import { buildApiUrl } from "../../config/api";
import { supabase } from "../../lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Consultant {
    id: string;
    display_name: string;
    gender: string | null;
    photo_url: string | null;
    bio: string | null;
    expertise_tags: string[];
    languages: string[];
    rate_per_min: number;
    currency_code: string;
    is_online: boolean;
    rating_avg: number;
    rating_count: number;
    sessions_completed: number;
    availability_note: string | null;
}

interface Session {
    id: string;
    consultant_id: string;
    user_id: string;
    status: string;
    session_type: string;
    minutes_used: number;
    note: string | null;
    created_at: string;
    connect_consultants: { display_name: string; photo_url: string | null } | null;
}

interface Message {
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", AUD: "A$",
};

const CRISIS_LINES = [
    { country: "India", name: "iCall", phone: "9152987821" },
    { country: "USA", name: "988 Lifeline", phone: "988" },
    { country: "UK", name: "Samaritans", phone: "116123" },
    { country: "Australia", name: "Lifeline", phone: "131114" },
];

// ── View type ──────────────────────────────────────────────────────────────────
type View =
    | { name: "browse" }
    | { name: "sessions" }
    | { name: "wallet" }
    | { name: "profile"; consultant: Consultant }
    | { name: "chat"; session: Session }
    | { name: "dashboard" }
    | { name: "register" };

export default function ConnectScreen() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { accessToken, user } = useAuth();

    const [view, setView] = useState<View>({ name: "browse" });

    const s = styles(colors);

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
            onStartSession={(s) => setView({ name: "chat", session: s })} />;
    }
    if (view.name === "chat") {
        return <ChatView session={view.session} colors={colors} insets={insets}
            accessToken={accessToken} userId={user?.id ?? null}
            onBack={() => setView({ name: "sessions" })} />;
    }
    if (view.name === "dashboard") {
        return <DashboardView colors={colors} insets={insets}
            accessToken={accessToken}
            onBack={() => setView({ name: "browse" })}
            onJoinSession={(s) => setView({ name: "chat", session: s })} />;
    }
    if (view.name === "register") {
        return <RegisterView colors={colors} insets={insets}
            accessToken={accessToken}
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
                        onPress={() => setView({ name: t })}>
                        <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
                            {t === "browse" ? "Browse" : t === "sessions" ? "Sessions" : "Wallet"}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {tab === "browse" && <BrowseTab colors={colors} accessToken={accessToken}
                onSelectConsultant={(c) => setView({ name: "profile", consultant: c })} />}
            {tab === "sessions" && <SessionsTab colors={colors} accessToken={accessToken}
                onSelectSession={(s) => setView({ name: "chat", session: s })} />}
            {tab === "wallet" && <WalletTab colors={colors} accessToken={accessToken} />}

            {/* Footer disclaimer */}
            <Text style={[s.disclaimer, { paddingBottom: insets.bottom + 4 }]}>
                Peer wellness support only — not a substitute for professional mental health care.
            </Text>
        </View>
    );
}

// ── Browse Tab ─────────────────────────────────────────────────────────────────
function BrowseTab({ colors, accessToken, onSelectConsultant }: {
    colors: any; accessToken: string | null;
    onSelectConsultant: (c: Consultant) => void;
}) {
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [loading, setLoading] = useState(true);
    const s = styles(colors);

    useEffect(() => {
        fetch(buildApiUrl("/api/connect/consultants"), {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        })
            .then((r) => r.json())
            .then((d) => setConsultants(d.consultants ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [accessToken]);

    if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;
    if (consultants.length === 0) return (
        <View style={s.center}>
            <Text style={s.emptyText}>No companions online right now.</Text>
            <Text style={[s.emptyText, { marginTop: 4, fontSize: 12, opacity: 0.6 }]}>Check back soon.</Text>
        </View>
    );

    return (
        <FlatList
            data={consultants}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
                <ConsultantCard consultant={item} colors={colors} onPress={() => onSelectConsultant(item)} />
            )}
        />
    );
}

// ── Consultant Card ────────────────────────────────────────────────────────────
function ConsultantCard({ consultant: c, colors, onPress }: {
    consultant: Consultant; colors: any; onPress: () => void;
}) {
    const s = styles(colors);
    const sym = CURRENCY_SYMBOLS[c.currency_code] ?? c.currency_code;

    return (
        <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                {/* Avatar */}
                <View style={s.avatar}>
                    {c.photo_url
                        ? <Image source={{ uri: c.photo_url }} style={s.avatarImg} />
                        : <Text style={{ fontSize: 28 }}>{c.gender === "female" ? "👩" : "👨"}</Text>
                    }
                    {c.is_online && <View style={s.onlineDot} />}
                </View>

                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={s.cardName}>{c.display_name}</Text>
                        {c.is_online
                            ? <Text style={[s.badge, { backgroundColor: "rgba(16,185,129,0.18)", color: "#34d399" }]}>Online</Text>
                            : <Text style={[s.badge, { backgroundColor: "rgba(148,163,184,0.12)", color: colors.textSecondary }]}>Offline</Text>
                        }
                    </View>
                    {c.bio && <Text style={s.cardBio} numberOfLines={2}>{c.bio}</Text>}

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {(c.expertise_tags ?? []).slice(0, 3).map((t) => (
                            <Text key={t} style={s.tag}>{t}</Text>
                        ))}
                    </View>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
                        <Text style={s.rateText}>{sym}{c.rate_per_min}/min</Text>
                        <Text style={s.ratingText}>★ {c.rating_avg > 0 ? c.rating_avg.toFixed(1) : "New"} · {c.sessions_completed} sessions</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

// ── Sessions Tab ───────────────────────────────────────────────────────────────
function SessionsTab({ colors, accessToken, onSelectSession }: {
    colors: any; accessToken: string | null;
    onSelectSession: (s: Session) => void;
}) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const s = styles(colors);

    useEffect(() => {
        if (!accessToken) { setLoading(false); return; }
        fetch(buildApiUrl("/api/connect/sessions"), {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
            .then((r) => r.json())
            .then((d) => setSessions(d.sessions ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [accessToken]);

    if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;
    if (!accessToken) return (
        <View style={s.center}><Text style={s.emptyText}>Sign in to view your sessions.</Text></View>
    );
    if (sessions.length === 0) return (
        <View style={s.center}><Text style={s.emptyText}>No sessions yet. Browse companions to start.</Text></View>
    );

    const STATUS_COLORS: Record<string, string> = {
        active: "#34d399", pending: "#fbbf24", completed: colors.textSecondary,
        cancelled: "#f87171", declined: "#f87171",
    };

    return (
        <FlatList
            data={sessions}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => (
                <TouchableOpacity style={s.card} onPress={() => onSelectSession(item)} activeOpacity={0.75}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={s.cardName}>
                            {item.connect_consultants?.display_name ?? "Companion"}
                        </Text>
                        <Text style={[s.badge, { backgroundColor: "transparent", color: STATUS_COLORS[item.status] ?? colors.textSecondary }]}>
                            {item.status}
                        </Text>
                    </View>
                    <Text style={[s.cardBio, { marginTop: 2 }]}>
                        {new Date(item.created_at).toLocaleDateString()} · {item.minutes_used.toFixed(0)} min used
                    </Text>
                    {item.note && <Text style={[s.cardBio, { opacity: 0.7, fontStyle: "italic" }]} numberOfLines={1}>{item.note}</Text>}
                </TouchableOpacity>
            )}
        />
    );
}

// ── Wallet Tab ─────────────────────────────────────────────────────────────────
function WalletTab({ colors, accessToken }: { colors: any; accessToken: string | null }) {
    const [wallets, setWallets] = useState<{ display_name: string; currency_code: string; balance_minutes: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const s = styles(colors);

    useEffect(() => {
        if (!accessToken) { setLoading(false); return; }
        fetch(buildApiUrl("/api/connect/wallet"), {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
            .then((r) => r.json())
            .then((d) => {
                const w = d.wallets ?? (d.consultant ? [d] : []);
                setWallets(w);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [accessToken]);

    if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;
    if (!accessToken) return (
        <View style={s.center}><Text style={s.emptyText}>Sign in to view your wallet.</Text></View>
    );

    return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View style={[s.card, { padding: 20, alignItems: "center" }]}>
                <Text style={[s.cardBio, { marginBottom: 4 }]}>Total balance</Text>
                <Text style={[s.cardName, { fontSize: 32, color: colors.primary }]}>
                    {wallets.reduce((a, w) => a + (w.balance_minutes ?? 0), 0).toFixed(0)} min
                </Text>
            </View>
            {wallets.map((w, i) => (
                <View key={i} style={s.card}>
                    <Text style={s.cardName}>{w.display_name}</Text>
                    <Text style={s.cardBio}>{(w.balance_minutes ?? 0).toFixed(1)} minutes remaining</Text>
                </View>
            ))}
            <View style={[s.card, { padding: 16 }]}>
                <Text style={s.cardBio}>
                    Recharge from the Browse tab — select a companion and tap "Talk Now".
                </Text>
            </View>
        </ScrollView>
    );
}

// ── Profile View ───────────────────────────────────────────────────────────────
function ProfileView({ consultant: c, colors, insets, accessToken, userId, onBack, onStartSession }: {
    consultant: Consultant; colors: any; insets: any;
    accessToken: string | null; userId: string | null;
    onBack: () => void; onStartSession: (s: Session) => void;
}) {
    const [rechargeVisible, setRechargeVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const s = styles(colors);
    const sym = CURRENCY_SYMBOLS[c.currency_code] ?? c.currency_code;

    async function startSession() {
        if (!accessToken) { Alert.alert("Sign in required", "Please sign in to start a session."); return; }
        setLoading(true);
        try {
            const res = await fetch(buildApiUrl("/api/connect/sessions"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ consultant_id: c.id, session_type: "instant" }),
            });
            const d = await res.json();
            if (!d.ok) {
                if (d.error?.includes("Insufficient balance")) {
                    setRechargeVisible(true);
                } else {
                    Alert.alert("Error", d.error ?? "Could not start session");
                }
                return;
            }
            onStartSession(d.session);
        } catch {
            Alert.alert("Error", "Network error — please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={onBack} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>{c.display_name}</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                {/* Avatar + name */}
                <View style={{ alignItems: "center", gap: 10 }}>
                    <View style={[s.avatar, { width: 80, height: 80, borderRadius: 40 }]}>
                        {c.photo_url
                            ? <Image source={{ uri: c.photo_url }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                            : <Text style={{ fontSize: 44 }}>{c.gender === "female" ? "👩" : "👨"}</Text>
                        }
                        {c.is_online && <View style={[s.onlineDot, { width: 14, height: 14, bottom: 2, right: 2 }]} />}
                    </View>
                    <Text style={[s.cardName, { fontSize: 20 }]}>{c.display_name}</Text>
                    <Text style={[s.ratingText, { fontSize: 13 }]}>
                        ★ {c.rating_avg > 0 ? c.rating_avg.toFixed(1) : "New"} · {c.sessions_completed} sessions
                    </Text>
                </View>

                {c.bio && <View style={s.card}><Text style={s.cardBio}>{c.bio}</Text></View>}

                {/* Rate */}
                <View style={[s.card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                    <Text style={s.cardName}>Rate</Text>
                    <Text style={[s.rateText, { fontSize: 18 }]}>{sym}{c.rate_per_min}/min</Text>
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
                        <Text style={s.cardBio}>{c.languages.join(", ")}</Text>
                    </View>
                )}

                {c.availability_note && (
                    <View style={s.card}>
                        <Text style={[s.cardBio, { marginBottom: 4, fontWeight: "600" }]}>Availability</Text>
                        <Text style={s.cardBio}>{c.availability_note}</Text>
                    </View>
                )}

                {/* Disclaimer */}
                <Text style={[s.disclaimer, { textAlign: "center" }]}>
                    Peer wellness support only — not a substitute for professional mental health care.
                </Text>

                {/* CTA */}
                <TouchableOpacity
                    style={[s.primaryBtn, loading && { opacity: 0.6 }]}
                    onPress={startSession}
                    disabled={loading || !c.is_online}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={s.primaryBtnText}>{c.is_online ? "Talk Now" : "Offline"}</Text>
                    }
                </TouchableOpacity>
            </ScrollView>

            {/* Recharge modal */}
            <RechargeModal
                visible={rechargeVisible}
                consultant={c}
                accessToken={accessToken}
                onClose={() => setRechargeVisible(false)}
                onSuccess={() => { setRechargeVisible(false); startSession(); }}
                colors={colors}
            />
        </View>
    );
}

// ── Recharge Modal ─────────────────────────────────────────────────────────────
const PRESET_MINUTES = [15, 30, 60];

function RechargeModal({ visible, consultant: c, accessToken, onClose, onSuccess, colors }: {
    visible: boolean; consultant: Consultant; accessToken: string | null;
    onClose: () => void; onSuccess: (minutes: number) => void; colors: any;
}) {
    const [minutes, setMinutes] = useState(30);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const s = styles(colors);
    const sym = CURRENCY_SYMBOLS[c.currency_code] ?? c.currency_code;
    const total = c.rate_per_min * minutes;

    async function handlePay() {
        if (!accessToken) return;
        setLoading(true); setError("");
        try {
            const res = await fetch(buildApiUrl("/api/connect/wallet/recharge/create"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ consultant_id: c.id, minutes }),
            });
            const d = await res.json();
            if (!d.ok) { setError(d.error ?? "Failed to create order"); setLoading(false); return; }

            const RazorpayCheckout = require("react-native-razorpay").default;
            const paymentData = await RazorpayCheckout.open({
                key: d.razorpay_key_id ?? process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
                order_id: d.razorpay_order_id,
                amount: String(d.amount_paise),
                currency: "INR",
                name: "Imotara Connect",
                description: `${minutes} min with ${c.display_name}`,
                theme: { color: "#6366f1" },
            });

            const verifyRes = await fetch(buildApiUrl("/api/connect/wallet/recharge/verify"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({
                    razorpay_order_id:   paymentData.razorpay_order_id,
                    razorpay_payment_id: paymentData.razorpay_payment_id,
                    razorpay_signature:  paymentData.razorpay_signature,
                }),
            });
            const v = await verifyRes.json();
            if (!v.ok) { setError(v.error ?? "Verification failed"); return; }
            onSuccess(minutes);
        } catch (err: any) {
            if (err?.code === 0 || String(err?.description ?? "").toLowerCase().includes("cancel")) {
                onClose();
            } else {
                setError(String(err?.message ?? "Payment failed"));
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={s.modalBackdrop}>
                <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                        <Text style={[s.cardName, { fontSize: 18 }]}>Add Session Time</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[s.cardBio, { marginBottom: 8 }]}>Duration</Text>
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                        {PRESET_MINUTES.map((m) => (
                            <TouchableOpacity key={m}
                                style={[s.durationBtn, minutes === m && s.durationBtnActive]}
                                onPress={() => setMinutes(m)}>
                                <Text style={[s.durationBtnText, minutes === m && s.durationBtnTextActive]}>
                                    {m}m
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Breakdown */}
                    <View style={[s.card, { gap: 6 }]}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={s.cardBio}>{minutes} min × {sym}{c.rate_per_min}/min</Text>
                            <Text style={s.cardBio}>{sym}{total.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={[s.cardBio, { opacity: 0.6 }]}>Platform fee (20%)</Text>
                            <Text style={[s.cardBio, { opacity: 0.6 }]}>{sym}{(total * 0.2).toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }}>
                            <Text style={[s.cardName]}>Total</Text>
                            <Text style={[s.cardName]}>{sym}{total.toFixed(2)}</Text>
                        </View>
                    </View>

                    {error !== "" && <Text style={s.errorText}>{error}</Text>}

                    <TouchableOpacity style={[s.primaryBtn, { marginTop: 16 }, loading && { opacity: 0.6 }]}
                        onPress={handlePay} disabled={loading}>
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.primaryBtnText}>Pay {sym}{total.toFixed(2)}</Text>
                        }
                    </TouchableOpacity>
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
    const [status, setStatus] = useState(session.status);
    const [showEmergency, setShowEmergency] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const flatRef = useRef<FlatList>(null);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const s = styles(colors);

    // Load messages
    useEffect(() => {
        supabase.from("connect_messages")
            .select("id, sender_id, content, created_at")
            .eq("session_id", session.id)
            .order("created_at", { ascending: true })
            .then(({ data }) => { if (data) setMessages(data); });
    }, [session.id]);

    // Realtime subscription
    useEffect(() => {
        const channel = supabase.channel(`connect:session:${session.id}`)
            .on("postgres_changes", {
                event: "INSERT", schema: "public",
                table: "connect_messages", filter: `session_id=eq.${session.id}`,
            }, (payload) => {
                const msg = payload.new as Message;
                setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
            })
            .on("postgres_changes", {
                event: "UPDATE", schema: "public",
                table: "connect_sessions", filter: `id=eq.${session.id}`,
            }, (payload) => {
                const updated = payload.new as { status?: string };
                if (updated.status) setStatus(updated.status);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session.id]);

    // 60s billing tick
    useEffect(() => {
        if (status !== "active") {
            if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
            return;
        }
        tickRef.current = setInterval(async () => {
            if (!accessToken) return;
            const res = await fetch(buildApiUrl(`/api/connect/sessions/${session.id}/tick`), {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}` },
            }).catch(() => null);
            if (res) {
                const d = await res.json().catch(() => null);
                if (d?.remaining_minutes != null) setRemaining(d.remaining_minutes);
                if (d?.status === "completed") setStatus("completed");
            }
        }, 60_000);
        return () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
    }, [status, session.id, accessToken]);

    async function send() {
        const text = input.trim();
        if (!text || sending) return;
        setSending(true); setInput("");
        await supabase.from("connect_messages").insert({ session_id: session.id, sender_id: userId, content: text })
            .catch(() => setInput(text));
        setSending(false);
    }

    async function submitReview() {
        if (rating === 0 || !accessToken) return;
        const res = await fetch(buildApiUrl(`/api/connect/sessions/${session.id}/review`), {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ rating, review_text: reviewText || null }),
        });
        const d = await res.json();
        if (d.ok) { setShowReview(false); }
    }

    const isActive = status === "active";
    const isCompleted = status === "completed";
    const isPending = status === "pending";

    return (
        <KeyboardAvoidingView
            style={[s.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
        >
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={onBack} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={s.headerTitle}>{session.connect_consultants?.display_name ?? "Companion"}</Text>
                    <Text style={[s.cardBio, { fontSize: 11 }]}>{isActive ? "Active" : isPending ? "Waiting…" : status}</Text>
                </View>
                {isActive && remaining !== null && (
                    <View style={{ backgroundColor: remaining <= 1 ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: remaining <= 1 ? "#f87171" : "#34d399", fontSize: 12, fontWeight: "600" }}>
                            {Math.round(remaining)} min
                        </Text>
                    </View>
                )}
                <TouchableOpacity style={s.emergencyBtn} onPress={() => setShowEmergency(true)}>
                    <Ionicons name="call" size={16} color="#f87171" />
                </TouchableOpacity>
            </View>

            <Text style={[s.disclaimer, { textAlign: "center", paddingVertical: 6 }]}>
                Peer wellness support — not professional care
            </Text>

            {isPending && (
                <Text style={{ textAlign: "center", color: "#fbbf24", fontSize: 12, padding: 8, backgroundColor: "rgba(251,191,36,0.08)" }}>
                    Waiting for companion to accept…
                </Text>
            )}
            {isCompleted && (
                <View style={{ padding: 10, alignItems: "center", backgroundColor: "rgba(148,163,184,0.08)" }}>
                    <Text style={s.cardBio}>Session completed · {session.minutes_used} min</Text>
                    {!showReview && (
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
                onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
                renderItem={({ item: m }) => {
                    const isMe = m.sender_id === userId;
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
                    />
                    <TouchableOpacity style={[s.sendBtn, sending && { opacity: 0.5 }]} onPress={send} disabled={sending || !input.trim()}>
                        <Ionicons name="send" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            {/* End session button */}
            {isActive && session.user_id === userId && (
                <TouchableOpacity style={{ alignItems: "center", paddingVertical: 8, paddingBottom: insets.bottom || 4 }}
                    onPress={() => {
                        fetch(buildApiUrl(`/api/connect/sessions/${session.id}`), {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                            body: JSON.stringify({ action: "complete" }),
                        }).catch(() => {});
                    }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>End session</Text>
                </TouchableOpacity>
            )}

            {/* Emergency modal */}
            <EmergencyModal visible={showEmergency} onClose={() => setShowEmergency(false)} colors={colors} />

            {/* Review modal */}
            <Modal visible={showReview} transparent animationType="fade" onRequestClose={() => setShowReview(false)}>
                <View style={s.modalBackdrop}>
                    <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
                        <Text style={[s.cardName, { fontSize: 18, marginBottom: 16 }]}>How was the session?</Text>
                        <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 16 }}>
                            {[1, 2, 3, 4, 5].map((n) => (
                                <TouchableOpacity key={n} onPress={() => setRating(n)}>
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
                        <TouchableOpacity style={[s.primaryBtn, rating === 0 && { opacity: 0.5 }]}
                            onPress={submitReview} disabled={rating === 0}>
                            <Text style={s.primaryBtnText}>Submit Review</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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

// ── Dashboard View ─────────────────────────────────────────────────────────────
function DashboardView({ colors, insets, accessToken, onBack, onJoinSession }: {
    colors: any; insets: any; accessToken: string | null;
    onBack: () => void;
    onJoinSession: (session: Session) => void;
}) {
    const [profile, setProfile]             = useState<any>(null);
    const [earnings, setEarnings]           = useState<any>(null);
    const [incoming, setIncoming]           = useState<any[]>([]);
    const [loading, setLoading]             = useState(true);
    const [toggling, setToggling]           = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const s = styles(colors);

    const load = useCallback(async () => {
        if (!accessToken) { setLoading(false); return; }
        const [pRes, eRes, sRes] = await Promise.all([
            fetch(buildApiUrl("/api/connect/consultant/profile"), { headers: { Authorization: `Bearer ${accessToken}` } }),
            fetch(buildApiUrl("/api/connect/consultant/earnings"), { headers: { Authorization: `Bearer ${accessToken}` } }),
            fetch(buildApiUrl("/api/connect/consultant/sessions"), { headers: { Authorization: `Bearer ${accessToken}` } }),
        ]);
        const [p, e, s] = await Promise.all([pRes.json(), eRes.json(), sRes.json()]);
        if (p.ok) setProfile(p.consultant);
        if (e.ok) setEarnings(e);
        if (s.ok) setIncoming(s.sessions ?? []);
        setLoading(false);
    }, [accessToken]);

    useEffect(() => { load(); }, [load]);

    // Poll every 15s for new requests
    useEffect(() => {
        if (!accessToken) return;
        const t = setInterval(() => {
            fetch(buildApiUrl("/api/connect/consultant/sessions"), { headers: { Authorization: `Bearer ${accessToken}` } })
                .then((r) => r.json())
                .then((d) => { if (d.ok) setIncoming(d.sessions ?? []); })
                .catch(() => {});
        }, 15_000);
        return () => clearInterval(t);
    }, [accessToken]);

    async function handleAction(sessionId: string, action: "accept" | "decline") {
        if (!accessToken) return;
        setActionLoading(sessionId);
        try {
            const res = await fetch(buildApiUrl(`/api/connect/sessions/${sessionId}`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ action }),
            });
            const d = await res.json();
            if (d.ok) {
                if (action === "accept") {
                    const sess = incoming.find((s) => s.id === sessionId);
                    if (sess) onJoinSession({ ...sess, connect_consultants: null });
                } else {
                    setIncoming((prev) => prev.filter((s) => s.id !== sessionId));
                }
            }
        } catch { /* silent */ }
        finally { setActionLoading(null); }
    }

    async function toggleOnline() {
        if (!accessToken || !profile) return;
        setToggling(true);
        const res = await fetch(buildApiUrl("/api/connect/consultant/status"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ is_online: !profile.is_online }),
        });
        const d = await res.json();
        if (d.ok) setProfile((p: any) => ({ ...p, is_online: !p.is_online }));
        setToggling(false);
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
            ) : !profile ? (
                <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                    <View style={s.card}>
                        <Text style={[s.cardName, { marginBottom: 8 }]}>Not registered as a companion</Text>
                        <Text style={s.cardBio}>Browse the Connect tab, or register to become a companion.</Text>
                    </View>
                </ScrollView>
            ) : (
                <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
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

                    {/* Active sessions — rejoin */}
                    {active.map((s) => (
                        <View key={s.id} style={[styles(colors).card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                            <View>
                                <Text style={[styles(colors).cardName, { color: "#34d399" }]}>Session in progress</Text>
                                <Text style={styles(colors).cardBio}>{s.type} · {(s.minutes_used ?? 0).toFixed(0)} min used</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles(colors).primaryBtn, { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(52,211,153,0.8)" }]}
                                onPress={() => onJoinSession({ ...s, connect_consultants: null })}>
                                <Text style={styles(colors).primaryBtnText}>Rejoin</Text>
                            </TouchableOpacity>
                        </View>
                    ))}

                    {/* Pending requests */}
                    {pending.length > 0 && (
                        <View>
                            <Text style={[s.cardBio, { color: "#fbbf24", fontWeight: "700", marginBottom: 8 }]}>
                                Incoming Requests ({pending.length})
                            </Text>
                            {pending.map((req) => (
                                <View key={req.id} style={[s.card, { marginBottom: 10 }]}>
                                    <View style={{ marginBottom: 10 }}>
                                        <Text style={s.cardBio}>
                                            {req.type === "instant" ? "Instant session" : "Scheduled session"}
                                            {" · "}{new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </Text>
                                        {req.scheduled_note && (
                                            <Text style={[s.cardBio, { fontStyle: "italic", marginTop: 4 }]}>
                                                "{req.scheduled_note}"
                                            </Text>
                                        )}
                                    </View>
                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                        <TouchableOpacity
                                            style={[s.primaryBtn, { flex: 1, paddingVertical: 10 }, actionLoading === req.id && { opacity: 0.6 }]}
                                            onPress={() => handleAction(req.id, "accept")}
                                            disabled={actionLoading === req.id}>
                                            {actionLoading === req.id
                                                ? <ActivityIndicator color="#fff" size="small" />
                                                : <Text style={s.primaryBtnText}>Accept & Chat</Text>
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
                            ))}
                        </View>
                    )}

                    {pending.length === 0 && active.length === 0 && profile.status === "approved" && (
                        <View style={[s.card, { alignItems: "center" }]}>
                            <Text style={s.cardBio}>No incoming requests right now.</Text>
                            <Text style={[s.cardBio, { opacity: 0.6, marginTop: 2 }]}>Go online to receive requests.</Text>
                        </View>
                    )}

                    {/* Earnings */}
                    {earnings && (
                        <View style={s.card}>
                            <Text style={[s.cardName, { marginBottom: 8 }]}>Earnings</Text>
                            <View style={{ gap: 6 }}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                    <Text style={s.cardBio}>Total earned</Text>
                                    <Text style={s.cardName}>₹{(earnings.earned_amount ?? 0).toFixed(2)}</Text>
                                </View>
                                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                    <Text style={s.cardBio}>Sessions completed</Text>
                                    <Text style={s.cardName}>{earnings.sessions_completed ?? 0}</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

// ── Register View ──────────────────────────────────────────────────────────────
function RegisterView({ colors, insets, accessToken, onBack, onSuccess }: {
    colors: any; insets: any; accessToken: string | null;
    onBack: () => void; onSuccess: () => void;
}) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        display_name: "", gender: "", bio: "",
        expertise_tags: "", languages: "",
        rate_per_min: "10", currency_code: "INR",
        availability_note: "", coc_agreed: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const s = styles(colors);

    function update(field: string, value: string | boolean) {
        setForm((f) => ({ ...f, [field]: value }));
    }

    async function submit() {
        if (!form.coc_agreed) { setError("You must agree to the Code of Conduct."); return; }
        if (!accessToken) { setError("Sign in required."); return; }
        setLoading(true); setError("");
        try {
            const res = await fetch(buildApiUrl("/api/connect/consultant/register"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({
                    ...form,
                    rate_per_min: parseFloat(form.rate_per_min),
                    expertise_tags: form.expertise_tags.split(",").map((t) => t.trim()).filter(Boolean),
                    languages: form.languages.split(",").map((l) => l.trim()).filter(Boolean),
                }),
            });
            const d = await res.json();
            if (!d.ok) { setError(d.error ?? "Registration failed"); return; }
            onSuccess();
        } catch {
            setError("Network error — please try again.");
        } finally {
            setLoading(false);
        }
    }

    function field(label: string, field: string, placeholder?: string, multiline = false) {
        return (
            <View style={{ marginBottom: 12 }}>
                <Text style={[s.cardBio, { marginBottom: 4, fontWeight: "600" }]}>{label}</Text>
                <TextInput
                    style={[s.messageInput, multiline && { minHeight: 80 }]}
                    value={(form as any)[field]}
                    onChangeText={(v) => update(field, v)}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textSecondary}
                    multiline={multiline}
                />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={[s.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={s.header}>
                <TouchableOpacity onPress={step > 1 ? () => setStep(step - 1) : onBack} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Become a Companion ({step}/3)</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {step === 1 && (
                    <View>
                        {field("Display Name", "display_name", "Your name as shown to users")}
                        <View style={{ marginBottom: 12 }}>
                            <Text style={[s.cardBio, { marginBottom: 4, fontWeight: "600" }]}>Gender</Text>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                                {["male", "female"].map((g) => (
                                    <TouchableOpacity key={g}
                                        style={[s.durationBtn, form.gender === g && s.durationBtnActive, { flex: 1 }]}
                                        onPress={() => update("gender", g)}>
                                        <Text style={[s.durationBtnText, form.gender === g && s.durationBtnTextActive]}>
                                            {g === "male" ? "👨 Male" : "👩 Female"}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        {field("Specialties (comma-separated)", "expertise_tags", "e.g. Anxiety, Relationships, Grief")}
                        {field("Languages (comma-separated)", "languages", "e.g. English, Hindi")}
                        <TouchableOpacity style={s.primaryBtn} onPress={() => setStep(2)}>
                            <Text style={s.primaryBtnText}>Next</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {step === 2 && (
                    <View>
                        {field("Bio (max 500 chars)", "bio", "Tell users about your background and approach", true)}
                        <View style={{ marginBottom: 12 }}>
                            <Text style={[s.cardBio, { marginBottom: 4, fontWeight: "600" }]}>Rate per minute</Text>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                                <TextInput
                                    style={[s.messageInput, { flex: 1 }]}
                                    value={form.rate_per_min}
                                    onChangeText={(v) => update("rate_per_min", v)}
                                    keyboardType="numeric"
                                    placeholderTextColor={colors.textSecondary}
                                />
                                <View style={{ flexDirection: "row", gap: 6 }}>
                                    {["INR", "USD"].map((c) => (
                                        <TouchableOpacity key={c}
                                            style={[s.durationBtn, form.currency_code === c && s.durationBtnActive]}
                                            onPress={() => update("currency_code", c)}>
                                            <Text style={[s.durationBtnText, form.currency_code === c && s.durationBtnTextActive]}>{c}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                        {field("Availability", "availability_note", "e.g. Weekdays 6–10 PM IST")}
                        <TouchableOpacity style={s.primaryBtn} onPress={() => setStep(3)}>
                            <Text style={s.primaryBtnText}>Next</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {step === 3 && (
                    <View>
                        <View style={[s.card, { marginBottom: 16 }]}>
                            <Text style={[s.cardName, { marginBottom: 8 }]}>Code of Conduct</Text>
                            <Text style={s.cardBio}>
                                As an Imotara companion, you agree to:{"\n\n"}
                                • Provide genuine peer support, not clinical advice{"\n"}
                                • Maintain confidentiality of user conversations{"\n"}
                                • Never solicit personal contact information{"\n"}
                                • Refer users to emergency services when in crisis{"\n"}
                                • Imotara reserves the right to suspend accounts for violations
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={{ flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 20 }}
                            onPress={() => update("coc_agreed", !form.coc_agreed)}>
                            <View style={{
                                width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                                borderColor: form.coc_agreed ? colors.primary : colors.border,
                                backgroundColor: form.coc_agreed ? colors.primary : "transparent",
                                alignItems: "center", justifyContent: "center",
                            }}>
                                {form.coc_agreed && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>
                            <Text style={s.cardBio}>I agree to the Code of Conduct</Text>
                        </TouchableOpacity>

                        {error !== "" && <Text style={s.errorText}>{error}</Text>}

                        <TouchableOpacity style={[s.primaryBtn, loading && { opacity: 0.6 }]}
                            onPress={submit} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Submit Application</Text>}
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
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
            borderRadius: 14, padding: 14,
            borderWidth: 1, borderColor: colors.border,
        },
        cardName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
        cardBio: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
        avatar: {
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: colors.primaryTint,
            alignItems: "center", justifyContent: "center",
            overflow: "hidden",
        },
        avatarImg: { width: 52, height: 52, borderRadius: 26 },
        onlineDot: {
            position: "absolute", bottom: 2, right: 2,
            width: 11, height: 11, borderRadius: 6,
            backgroundColor: "#34d399",
            borderWidth: 2, borderColor: colors.background,
        },
        badge: {
            fontSize: 11, fontWeight: "600", paddingHorizontal: 7, paddingVertical: 2,
            borderRadius: 10,
        },
        tag: {
            fontSize: 11, backgroundColor: colors.primaryTint,
            color: colors.primary, borderRadius: 8,
            paddingHorizontal: 8, paddingVertical: 3,
        },
        rateText: { fontSize: 14, fontWeight: "700", color: colors.primary },
        ratingText: { fontSize: 12, color: colors.textSecondary },
        disclaimer: { fontSize: 11, color: colors.textSecondary, opacity: 0.6, textAlign: "center", paddingHorizontal: 16 },
        primaryBtn: {
            backgroundColor: colors.primary, borderRadius: 12,
            paddingVertical: 14, alignItems: "center",
        },
        primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
    });
}
