// src/components/imotara/UpgradeSheet.tsx
// Native upgrade modal.
//   iOS  → Apple IAP via expo-iap (StoreKit 2). Requires App Store Connect products — see upgradePlans.ts.
//   Android → Razorpay native checkout via react-native-razorpay.

import React, { useEffect, useState } from "react";
import {
    Modal,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Alert,
} from "react-native";
import { useIAP } from "expo-iap";
import type { Purchase, Product, ProductSubscription } from "expo-iap";
import { useColors } from "../../theme/ThemeContext";
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: false, error: "Not signed in" };

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
    const [period, setPeriod] = useState<PlanPeriod>("monthly");
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | undefined>();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserEmail(session?.user?.email);
        });
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
            try {
                const productId = iosSkuToProductId(purchase.productId ?? "");
                const isTokenPack = productId?.startsWith("tokens_") ?? false;
                await finishTransaction({ purchase, isConsumable: isTokenPack });

                if (productId) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.access_token) {
                        await fetch(buildApiUrl("/api/license/verify-apple-purchase"), {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${session.access_token}`,
                            },
                            body: JSON.stringify({
                                productId,
                                transactionId: (purchase as any).transactionId ?? purchase.productId,
                            }),
                        });
                    }
                }

                await onPurchaseComplete();
                onClose();
                Alert.alert("Thank you!", "Your plan has been upgraded. Enjoy Imotara Plus/Pro!");
            } catch {
                // best-effort
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

    // ── iOS purchase ───────────────────────────────────────────────────────────
    const handleIosPurchase = async (sku: string, type: "subs" | "in-app") => {
        if (purchasing) return;
        setPurchasing(sku);
        try {
            await requestPurchase({ type, request: { apple: { sku } } });
        } catch {
            setPurchasing(null);
        }
    };

    // ── Android purchase ───────────────────────────────────────────────────────
    const handleAndroidPurchase = async (productId: ProductId) => {
        if (purchasing) return;
        setPurchasing(productId);
        try {
            const result = await doAndroidPurchase(productId, userEmail);
            if (result.ok) {
                await onPurchaseComplete();
                onClose();
                Alert.alert("Thank you!", "Your plan has been upgraded. Enjoy Imotara Plus/Pro!");
            } else if (result.error !== "cancelled") {
                Alert.alert("Payment failed", result.error ?? "Please try again.");
            }
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
                                ? "Subscriptions auto-renew. Cancel anytime in iOS Settings → Subscriptions."
                                : "Secure payment via Razorpay. No subscription — pay once per period."}
                        </Text>
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
}
