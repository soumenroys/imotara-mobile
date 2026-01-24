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

// ✅ Razorpay Checkout (India-first donations)
let RazorpayCheckout: any = null;
try {
    // In dev builds, the module is usually under `.default`
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-razorpay");
    RazorpayCheckout = mod?.default ?? mod;
} catch {
    RazorpayCheckout = null;
}

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

type DonationIntentRazorpayResponse = {
    ok: boolean;
    razorpay?: {
        orderId: string;
        keyId: string; // rzp_test_...
        amount: number; // paise
        currency: string; // "INR"
    };
    error?: string;
};

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
    } = useSettings();

    const messageCount = (history as HistoryRecord[]).length;

    // ✅ Fix implicit-any error by typing callback param
    const unsyncedCount = (history as HistoryRecord[]).filter(
        (h: HistoryRecord) => !h.isSynced
    ).length;

    // ✅ Cloud sync gate (soft gating)
    const cloudGate = gate("CLOUD_SYNC", licenseTier);
    const canCloudSync = cloudGate.enabled;

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

    async function createDonationOrder(
        presetId: string
    ): Promise<NonNullable<DonationIntentRazorpayResponse["razorpay"]>> {
        const base = getApiBaseUrl();
        if (!base) {
            throw new Error(
                "Missing API base URL. Set EXPO_PUBLIC_IMOTARA_API_BASE_URL in .env."
            );
        }

        const res = await fetch(`${base}/api/payments/donation-intent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                presetId,
                purpose: "imotara_donation",
                platform: "mobile",
            }),
        });

        const json = (await res.json().catch(() => null)) as
            | DonationIntentRazorpayResponse
            | null;

        if (!res.ok || !json?.ok) {
            const msg =
                json?.error ||
                (typeof json === "string" ? json : "") ||
                `Donation order failed (${res.status}).`;
            throw new Error(msg);
        }

        if (!json.razorpay?.orderId || !json.razorpay?.keyId) {
            throw new Error("Donation order response missing Razorpay details.");
        }

        return json.razorpay;
    }

    // Prevent overlapping polling loops
    const donationPollRef = React.useRef(false);

    async function pollDonationConfirmation(paymentId?: string) {
        if (!paymentId) return;

        const base = getApiBaseUrl();
        if (!base) return;

        if (donationPollRef.current) return;
        donationPollRef.current = true;

        try {
            for (let i = 0; i < 5; i++) {
                try {
                    const res = await fetch(`${base}/api/donations/recent?limit=10`, {
                        method: "GET",
                    });
                    const json = (await res.json().catch(() => null)) as any;

                    const donations =
                        json?.donations || json?.items || json?.data || [];

                    const found =
                        Array.isArray(donations) &&
                        donations.some(
                            (d: any) =>
                                d?.razorpay_payment_id === paymentId ||
                                d?.razorpayPaymentId === paymentId
                        );

                    if (found && mountedRef.current) {
                        setLastSyncStatus(
                            "Donation confirmed. Thank you for supporting Imotara 🙏"
                        );
                        return;
                    }
                } catch {
                    // ignore (chat/settings must never break)
                }

                await new Promise((r) => setTimeout(r, 1200));
            }
        } finally {
            donationPollRef.current = false;
        }
    }

    const handleDonate = async (preset: { label: string; amount: number }) => {

        if (!RazorpayCheckout?.open) {
            Alert.alert(
                "Donate (Dev Build required)",
                "Razorpay needs a Development Build. It does not work inside Expo Go.",
                [{ text: "OK" }]
            );
            return;
        }

        if (busyRef.current.donate) return;
        busyRef.current.donate = true;

        try {
            // 1) Create Razorpay order via backend (server holds secret)
            const rz = await createDonationOrder(String((preset as any)?.id || ""));

            // 2) Open Razorpay checkout
            const options: any = {
                key: rz.keyId,
                amount: rz.amount,
                currency: rz.currency || "INR",
                name: "Imotara",
                description:
                    "Support Imotara (UPI preferred) — privacy-first, non-commercial Indian initiative",
                order_id: rz.orderId,
                method: {
                    upi: true,
                    card: false,
                    netbanking: false,
                    wallet: false,
                },
                theme: { color: "#38bdf8" },
            };

            const result = await RazorpayCheckout.open(options);

            // Checkout completed on device; final confirmation is via server webhook.
            if (mountedRef.current) {
                setLastSyncStatus(
                    `Checkout completed for ${preset.label}. Receipt will appear after confirmation.`
                );
            }

            Alert.alert(
                "Thanks 🙏",
                `Checkout completed for ${preset.label}.\n\nPayment Id: ${result?.razorpay_payment_id || "—"}\n\nNote: Receipt is confirmed by the server webhook and may take a moment to appear.`,
                [{ text: "OK" }]
            );

            // 🔁 Auto-confirm once webhook records the receipt
            void pollDonationConfirmation(result?.razorpay_payment_id);
        } catch (e: any) {
            // Razorpay cancellation often returns a structured error
            const desc =
                e?.description ||
                e?.error?.description ||
                e?.message ||
                "Could not start donation checkout. Please try again.";

            // If user cancelled, Razorpay commonly returns code 2 / "cancelled"
            const isCancel =
                String(e?.code || "")
                    .toLowerCase()
                    .includes("cancel") ||
                String(desc).toLowerCase().includes("cancel");

            Alert.alert(
                isCancel ? "Donation cancelled" : "Donation error",
                isCancel ? "No payment was made." : desc,
                [{ text: "OK" }]
            );
        } finally {
            busyRef.current.donate = false;
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

                {/* ✅ Support / Donation card */}
                <AppSurface style={{ marginBottom: 16 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginBottom: 6,
                            fontWeight: "500",
                        }}
                    >
                        Support Imotara 🇮🇳 (Donate)
                    </Text>

                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.textSecondary,
                            marginBottom: 10,
                        }}
                    >
                        Imotara is being built as a privacy-first, non-commercial chat
                        companion. If you want to support this Indian initiative, you
                        can donate to help keep the app reliable and safe.
                    </Text>

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
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: "700",
                                        color: colors.textPrimary,
                                    }}
                                >
                                    {p.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.textSecondary,
                            marginTop: 6,
                        }}
                    >
                        Your chat data is never publicly exposed. Donations help cover
                        hosting and development.
                    </Text>
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
                        Billing is not enabled in this preview. This plan flag is used
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

                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    onPress={() => setAnalysisMode(opt.id)}
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
                        Auto: tries cloud, falls back to local. Cloud: always attempts Imotara server.
                        Local: device-only replies.
                    </Text>
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
                            const active = (toneContext?.companion?.ageRange || "prefer_not") === opt.id;

                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    onPress={() =>
                                        setToneContext({
                                            ...(toneContext || {}),
                                            companion: {
                                                ...(toneContext?.companion || {}),
                                                ageRange: opt.id,
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
