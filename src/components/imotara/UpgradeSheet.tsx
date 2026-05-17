// src/components/imotara/UpgradeSheet.tsx
// Native upgrade modal.
//   iOS  → Apple IAP via expo-iap (StoreKit 2). Requires App Store Connect products — see upgradePlans.ts.
//   Android → Razorpay native checkout via react-native-razorpay.

import React, { useEffect, useRef, useState } from "react";
import {
    Modal,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Alert,
    Linking,
} from "react-native";
import { useIAP } from "expo-iap";
import type { Purchase, Product, ProductSubscription } from "expo-iap";
import { useColors } from "../../theme/ThemeContext";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabase/client";
import { buildApiUrl } from "../../config/api";
import {
    PLAN_DEFS,
    TOKEN_PACK_DEFS,
    IOS_SUBSCRIPTION_SKUS,
    IOS_TOKEN_SKUS,
    iosSkuToProductId,
    type PlanPeriod,
    type PlanDef,
    type ProductId,
} from "../../payments/upgradePlans";
import type { PurchaseIOS } from "expo-iap";

type Props = {
    visible: boolean;
    onClose: () => void;
    onPurchaseComplete: () => Promise<void>;
};

// ── Android: full Razorpay purchase flow ──────────────────────────────────────

async function doAndroidPurchase(
    productId: ProductId,
    userEmail: string | undefined,
): Promise<{ ok: boolean; error?: string }> {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        // Session missing or expired — attempt a silent refresh before giving up
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        session = refreshed;
    }
    if (!session?.access_token) return { ok: false, error: "sign_in_required" };

    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
    };

    const orderRes = await fetch(buildApiUrl("/api/license/order-intent"), {
        method: "POST", headers,
        body: JSON.stringify({ productId }),
    });
    const orderData = await orderRes.json();
    if (!orderData.ok || !orderData.razorpay) {
        return { ok: false, error: orderData.error ?? "Could not create order" };
    }

    const { orderId, keyId, amount, currency } = orderData.razorpay;

    // Dynamic require keeps the iOS bundle clean (no Razorpay native module there)
    const RazorpayCheckout = require("react-native-razorpay").default;
    let paymentData: any;
    try {
        paymentData = await RazorpayCheckout.open({
            key: keyId,
            order_id: orderId,
            amount: String(amount),
            currency: currency ?? "INR",
            name: "Imotara",
            description: productId,
            image: "https://imotaraapp.vercel.app/icon-192.png",
            prefill: { email: userEmail ?? "", contact: "" },
            theme: { color: "#6366f1" },
        });
    } catch (err: any) {
        if (err?.code === 0 || String(err?.description ?? "").toLowerCase().includes("cancel")) {
            return { ok: false, error: "cancelled" };
        }
        return { ok: false, error: String(err?.message ?? err) };
    }

    const paymentId = paymentData?.razorpay_payment_id;
    if (!paymentId) return { ok: false, error: "Payment ID missing" };

    const verifyRes = await fetch(buildApiUrl("/api/license/verify-payment"), {
        method: "POST", headers,
        body: JSON.stringify({ paymentId, productId }),
    });
    const verifyData = await verifyRes.json();
    return verifyData.ok ? { ok: true } : { ok: false, error: verifyData.error ?? "Verification failed" };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UpgradeSheet({ visible, onClose, onPurchaseComplete }: Props) {
    const colors = useColors();
    const { signInWithGoogle, signInWithApple, appleSignInAvailable } = useAuth();
    const [period, setPeriod] = useState<PlanPeriod>("monthly");
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [signingIn, setSigningIn] = useState(false);
    const [userEmail, setUserEmail] = useState<string | undefined>();
    const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null); // null = loading
    // Ref mirrors isSignedIn so stale closures (e.g. the onSuccess callback captured
    // in promptSignIn before sign-in) always read the latest value via .current.
    const isSignedInRef = useRef<boolean | null>(null);

    useEffect(() => {
        async function checkSession() {
            let { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                const { data: { session: refreshed } } = await supabase.auth.refreshSession();
                session = refreshed;
            }
            setUserEmail(session?.user?.email);
            setIsSignedIn(!!session?.access_token);
            isSignedInRef.current = !!session?.access_token;
        }
        checkSession();
    }, [visible]);

    // Keep isSignedIn in sync with the global auth state (handles async deep-link OAuth)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsSignedIn(!!session?.access_token);
            isSignedInRef.current = !!session?.access_token;
            setUserEmail(session?.user?.email);
        });
        return () => subscription.unsubscribe();
    }, []);

    // ── iOS IAP (expo-iap) ─────────────────────────────────────────────────────
    const {
        connected,
        products,
        subscriptions,
        fetchProducts,
        requestPurchase,
        finishTransaction,
        restorePurchases,
    } = useIAP({
        onPurchaseSuccess: async (purchase: Purchase) => {
            let serverVerified = false;
            try {
                const productId = iosSkuToProductId(purchase.productId ?? "");
                const isTokenPack = productId?.startsWith("tokens_") ?? false;

                if (productId) {
                    // Require a valid session to call the verification endpoint.
                    // Mirror the Android pattern: try refresh before giving up.
                    let { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) {
                        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
                        session = refreshed;
                    }
                    if (!session?.access_token) {
                        // No auth — leave the transaction pending so Apple re-delivers it on
                        // next app launch, where the user can sign in and try again.
                        Alert.alert(
                            "Sign in required",
                            "Please sign in and re-open the app to activate your purchase. Your payment is safe.",
                        );
                        return;
                    }

                    // PurchaseIOS.transactionId is the StoreKit 2 numeric transaction ID
                    // (e.g. "2000000123456789") that Apple's Server API expects.
                    // purchase.id is a generic PurchaseCommon field — not the same thing on iOS.
                    const iosTransactionId = (purchase as PurchaseIOS).transactionId ?? purchase.id;
                    const verifyRes = await fetch(buildApiUrl("/api/license/verify-apple-purchase"), {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({
                            productId,
                            transactionId: iosTransactionId,
                        }),
                        signal: AbortSignal.timeout(35_000),
                    });
                    if (!verifyRes.ok) {
                        // Don't finish — Apple will re-deliver on next launch so the user
                        // gets another verification attempt.
                        const errBody = await verifyRes.json().catch(() => ({})) as { error?: string };
                        Alert.alert(
                            "Verification failed",
                            `${errBody.error ?? "Unknown error"}. Re-open the app to retry, or tap 'Restore previous purchases'.`,
                        );
                        return;
                    }
                    serverVerified = true;
                }

                // Best-effort finish — ignore if StoreKit already finalized this transaction.
                try {
                    await finishTransaction({ purchase, isConsumable: isTokenPack });
                } catch { /* safe to ignore — transaction may already be finalized */ }

                // onPurchaseComplete refreshes local license state — non-critical if it fails.
                // License is already granted server-side at this point.
                try { await onPurchaseComplete(); } catch { /* best-effort */ }
                onClose();
                Alert.alert("Thank you! 💙", "Your plan has been upgraded. Enjoy Imotara!");
            } catch {
                if (serverVerified) {
                    // License was granted server-side but UI update failed — safe to tell user.
                    Alert.alert(
                        "Purchase complete",
                        "Your payment was received. Please restart the app to activate your new plan.",
                    );
                } else {
                    // Error before or during verification — don't claim payment was received.
                    Alert.alert(
                        "Verification failed",
                        "Could not reach the server. Re-open the app to retry, or tap 'Restore previous purchases'.",
                    );
                }
            } finally {
                setPurchasing(null);
            }
        },
        onPurchaseError: (error) => {
            setPurchasing(null);
            if ((error as any).code !== "E_USER_CANCELLED") {
                Alert.alert("Purchase failed", error.message ?? "Please try again.");
            }
        },
    });

    useEffect(() => {
        if (Platform.OS !== "ios" || !connected || !visible) return;
        fetchProducts({ skus: [...IOS_SUBSCRIPTION_SKUS], type: "subs" }).catch(() => {});
        fetchProducts({ skus: [...IOS_TOKEN_SKUS], type: "in-app" }).catch(() => {});
    }, [connected, visible]);

    // expo-iap v3: in-app products → products[], auto-renewable → subscriptions[]
    const iosProduct = (sku: string): Product | ProductSubscription | undefined =>
        products.find((p) => p.id === sku) ?? subscriptions.find((s) => s.id === sku);
    const iosPrice = (sku: string, fallback: number): string =>
        (iosProduct(sku) as any)?.displayPrice ?? `₹${fallback}`;

    // ── Sign-in prompt (shown when purchase attempted while logged out) ───────
    // On Android, WebBrowser.openAuthSessionAsync returns type:'dismiss' when the
    // OAuth redirect fires as a system deep-link intent. The session arrives async
    // via onAuthStateChange, not synchronously after signInWithGoogle() resolves.
    // We subscribe to onAuthStateChange BEFORE opening OAuth so we catch both paths.
    const promptSignIn = (onSuccess: () => void) => {
        const doSignIn = async (method: "google" | "apple") => {
            setSigningIn(true);
            let resolved = false;
            let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

            const resolve = (session: { access_token?: string; user?: { email?: string } } | null) => {
                if (resolved) return;
                resolved = true;
                if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = null; }
                subscription.unsubscribe();
                setUserEmail(session?.user?.email);
                setIsSignedIn(!!session?.access_token);
                isSignedInRef.current = !!session?.access_token;
                setSigningIn(false);
                if (session?.access_token) setTimeout(() => onSuccess(), 0);
            };

            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (resolved) return;
                if (event === "SIGNED_IN" && session?.access_token) {
                    resolve(session);
                }
            });

            try {
                if (method === "google") {
                    const result = await signInWithGoogle();

                    if (!resolved) {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session?.access_token) {
                            resolve(session);
                            return;
                        }

                        if (result.success) {
                            // iOS: session set synchronously — wait briefly for onAuthStateChange
                            cleanupTimer = setTimeout(() => {
                                if (!resolved) resolve(null);
                            }, 3000);
                        } else if (Platform.OS === "android") {
                            // Android: openAuthSessionAsync returns "dismiss" when the deep-link
                            // intent fires. The Linking handler in AuthContext calls setSession
                            // asynchronously — give it time to arrive.
                            cleanupTimer = setTimeout(() => {
                                if (!resolved) resolve(null);
                            }, 8000);
                        } else {
                            // iOS: user cancelled the browser — no session is coming
                            resolve(null);
                        }
                    }
                } else {
                    await signInWithApple();
                    if (!resolved) {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session?.access_token) {
                            resolve(session);
                        } else {
                            // Apple sign-in resolves synchronously — if no session, it failed
                            resolve(null);
                        }
                    }
                }
            } catch {
                resolve(null);
                Alert.alert("Sign in failed", "Please try again.");
            }
        };

        const buttons: any[] = [
            { text: "Not now", style: "cancel" },
            { text: "Sign in with Google", onPress: () => doSignIn("google") },
        ];
        if (Platform.OS === "ios" && appleSignInAvailable) {
            buttons.push({ text: "Sign in with Apple", onPress: () => doSignIn("apple") });
        }
        Alert.alert(
            "Sign in to upgrade",
            "Sign in so your purchase is linked to your account and can be restored on any device.",
            buttons,
        );
    };

    const handleIosPurchase = async (sku: string, type: "subs" | "in-app") => {
        if (purchasing || signingIn) return;
        if (isSignedInRef.current === false) {
            promptSignIn(() => handleIosPurchase(sku, type));
            return;
        }
        setPurchasing(sku);
        try {
            await requestPurchase({ type, request: { apple: { sku } } });
        } catch {
            setPurchasing(null);
        }
    };

    // ── Android purchase ───────────────────────────────────────────────────────
    const handleAndroidPurchase = async (productId: ProductId) => {
        if (purchasing || signingIn) return;
        if (isSignedInRef.current === false) {
            promptSignIn(() => handleAndroidPurchase(productId));
            return;
        }
        setPurchasing(productId);
        try {
            const result = await doAndroidPurchase(productId, userEmail);
            if (result.ok) {
                await onPurchaseComplete();
                onClose();
                Alert.alert("Thank you!", "Your plan has been upgraded. Enjoy Imotara Plus/Pro!");
            } else if (result.error === "sign_in_required") {
                setIsSignedIn(false);
                isSignedInRef.current = false;
                promptSignIn(() => handleAndroidPurchase(productId));
            } else if (result.error !== "cancelled") {
                Alert.alert("Payment failed", result.error ?? "Please try again.");
            }
        } catch {
            Alert.alert("Payment failed", "Network error. Please check your connection and try again.");
        } finally {
            setPurchasing(null);
        }
    };

    const handlePlanPress = (plan: PlanDef) => {
        const sku = `com.imotara.imotara.${plan.id}`;
        if (Platform.OS === "ios") handleIosPurchase(sku, "subs");
        else handleAndroidPurchase(plan.id);
    };

    const handleTokenPress = (tokenId: ProductId) => {
        const sku = `com.imotara.imotara.${tokenId}`;
        if (Platform.OS === "ios") handleIosPurchase(sku, "in-app");
        else handleAndroidPurchase(tokenId);
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    const plansForPeriod = PLAN_DEFS.filter((p) => p.period === period);
    const iosLoading = Platform.OS === "ios" && !connected;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                {/* Header */}
                <View style={{
                    flexDirection: "row", alignItems: "center",
                    justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
                }}>
                    <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textPrimary }}>
                        Upgrade Imotara
                    </Text>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ fontSize: 26, color: colors.textSecondary, lineHeight: 28 }}>×</Text>
                    </TouchableOpacity>
                </View>

                {iosLoading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 12 }}>
                            Connecting to App Store…
                        </Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
                        {/* Billing period toggle */}
                        <View style={{
                            flexDirection: "row",
                            backgroundColor: "rgba(255,255,255,0.06)",
                            borderRadius: 12, padding: 4, marginBottom: 24, marginTop: 8,
                        }}>
                            {(["monthly", "annual"] as PlanPeriod[]).map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    onPress={() => setPeriod(p)}
                                    style={{
                                        flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                                        backgroundColor: period === p ? colors.primary : "transparent",
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 13, fontWeight: "600",
                                        color: period === p ? "#fff" : colors.textSecondary,
                                    }}>
                                        {p === "monthly" ? "Monthly" : "Annual  — Save 27%"}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Plan cards */}
                        <View style={{ flexDirection: "row", gap: 12, marginBottom: 28 }}>
                            {plansForPeriod.map((plan) => {
                                const sku = `com.imotara.imotara.${plan.id}`;
                                const isBusy = purchasing === sku || purchasing === plan.id;
                                const isPro = plan.tier === "pro";
                                const displayPrice = Platform.OS === "ios"
                                    ? iosPrice(sku, plan.priceInr)
                                    : `₹${plan.priceInr}`;

                                return (
                                    <View key={plan.id} style={{
                                        flex: 1, borderRadius: 16, padding: 16,
                                        borderWidth: isPro ? 1.5 : 1,
                                        borderColor: isPro ? "#6366f1" : "rgba(255,255,255,0.12)",
                                        backgroundColor: isPro ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.04)",
                                    }}>
                                        {isPro && (
                                            <View style={{
                                                backgroundColor: "#6366f1", borderRadius: 6,
                                                paddingHorizontal: 8, paddingVertical: 2,
                                                alignSelf: "flex-start", marginBottom: 8,
                                            }}>
                                                <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>BEST VALUE</Text>
                                            </View>
                                        )}
                                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 }}>
                                            {isPro ? "Pro" : "Plus"}
                                        </Text>
                                        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary, marginBottom: 2 }}>
                                            {displayPrice}
                                        </Text>
                                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 12 }}>
                                            {period === "annual" && plan.monthlyPriceInr
                                                ? `₹${plan.monthlyPriceInr}/mo billed annually`
                                                : "per month"}
                                        </Text>
                                        {plan.features.map((f) => (
                                            <Text key={f} style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                                                {"✓ "}{f}
                                            </Text>
                                        ))}
                                        <TouchableOpacity
                                            onPress={() => handlePlanPress(plan)}
                                            disabled={!!purchasing}
                                            style={{
                                                marginTop: 16, paddingVertical: 10, borderRadius: 10,
                                                backgroundColor: isPro ? "#6366f1" : "rgba(99,102,241,0.2)",
                                                alignItems: "center",
                                                opacity: purchasing && !isBusy ? 0.5 : 1,
                                            }}
                                        >
                                            {isBusy
                                                ? <ActivityIndicator size="small" color={isPro ? "#fff" : "#a5b4fc"} />
                                                : <Text style={{ fontSize: 13, fontWeight: "700", color: isPro ? "#fff" : "#a5b4fc" }}>
                                                    {Platform.OS === "ios" ? "Subscribe" : "Pay with Razorpay"}
                                                </Text>
                                            }
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Token packs */}
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 12 }}>
                            Top up with AI credits
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
                            {TOKEN_PACK_DEFS.map((pack) => {
                                const sku = `com.imotara.imotara.${pack.id}`;
                                const isBusy = purchasing === sku || purchasing === pack.id;
                                const displayPrice = Platform.OS === "ios"
                                    ? iosPrice(sku, pack.priceInr)
                                    : `₹${pack.priceInr}`;
                                return (
                                    <TouchableOpacity
                                        key={pack.id}
                                        onPress={() => handleTokenPress(pack.id)}
                                        disabled={!!purchasing}
                                        style={{
                                            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                                            borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                                            backgroundColor: "rgba(255,255,255,0.04)",
                                            alignItems: "center", flexGrow: 1, minWidth: "44%",
                                            opacity: purchasing && !isBusy ? 0.5 : 1,
                                        }}
                                    >
                                        {isBusy
                                            ? <ActivityIndicator size="small" color={colors.primary} />
                                            : <>
                                                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>
                                                    {pack.tokens.toLocaleString()} credits
                                                </Text>
                                                <Text style={{ fontSize: 12, color: colors.primary, marginTop: 2 }}>
                                                    {displayPrice}
                                                </Text>
                                            </>
                                        }
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* iOS: Restore purchases (App Store guideline requirement) */}
                        {Platform.OS === "ios" && restorePurchases && (
                            <TouchableOpacity
                                onPress={() => restorePurchases()}
                                style={{ alignItems: "center", paddingVertical: 8 }}
                            >
                                <Text style={{ fontSize: 12, color: colors.textSecondary, textDecorationLine: "underline" }}>
                                    Restore previous purchases
                                </Text>
                            </TouchableOpacity>
                        )}

                        <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: "center", marginTop: 8 }}>
                            {Platform.OS === "ios"
                                ? "Subscriptions auto-renew monthly or annually at the price shown. Cancel anytime in iOS Settings → Subscriptions."
                                : "Secure payment via Razorpay. No subscription — pay once per period."}
                        </Text>
                        {Platform.OS === "ios" && (
                            <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 10 }}>
                                <TouchableOpacity onPress={() => Linking.openURL("https://imotara.com/privacy")}>
                                    <Text style={{ fontSize: 11, color: colors.primary, textDecorationLine: "underline" }}>
                                        Privacy Policy
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => Linking.openURL("https://imotara.com/terms")}>
                                    <Text style={{ fontSize: 11, color: colors.primary, textDecorationLine: "underline" }}>
                                        Terms of Use
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
}
