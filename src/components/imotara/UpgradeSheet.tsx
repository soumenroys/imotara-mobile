// src/components/imotara/UpgradeSheet.tsx
// Native upgrade modal.
//   iOS     → Apple IAP via expo-iap (StoreKit 2). Requires App Store Connect products.
//   Android → Google Play Billing via expo-iap. Requires Play Console products.
//             Falls back to Razorpay if Google Play Billing unavailable (not recommended for new installs).

import React, { useEffect, useRef, useState } from "react";
import { DEBUG_UI_ENABLED } from "../../config/debug";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useIAP, getAvailablePurchases } from "expo-iap";
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
    ANDROID_SUBSCRIPTION_SKUS,
    ANDROID_TOKEN_SKUS,
    ANDROID_SUBSCRIPTION_SET,
    type PlanPeriod,
    type PlanDef,
    type ProductId,
} from "../../payments/upgradePlans";
import type { PurchaseIOS } from "expo-iap";

type Props = {
    visible: boolean;
    onClose: () => void;
    onPurchaseComplete: () => Promise<void>;
    currentTier?: string | null;
};

// ── Android: full Razorpay purchase flow ──────────────────────────────────────

// Wraps a fetch with a manual AbortController timeout.
// AbortSignal.timeout() is not available on Hermes (Android/iOS JS engine).
function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function doAndroidPurchase(
    productId: ProductId,
    accessToken: string,
    userEmail: string | undefined,
): Promise<{ ok: boolean; error?: string }> {
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
    };

    let orderRes: Response;
    try {
        orderRes = await fetchWithTimeout(
            buildApiUrl("/api/license/order-intent"),
            { method: "POST", headers, body: JSON.stringify({ productId }) },
            20_000,
        );
    } catch {
        return { ok: false, error: "Network error creating order. Check your connection." };
    }
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

    // verify-payment polls Razorpay internally (handles UPI mandate "authorized" → "captured" delay)
    let verifyRes: Response;
    try {
        verifyRes = await fetchWithTimeout(
            buildApiUrl("/api/license/verify-payment"),
            { method: "POST", headers, body: JSON.stringify({ paymentId, productId }) },
            45_000, // 45s to cover Razorpay's internal polling (5 × 2s + buffer)
        );
    } catch {
        // Network error after payment — poll license status as fallback
        const polled = await pollLicenseStatus(headers, productId);
        if (polled) return { ok: true };
        return { ok: false, error: "Payment received but activation is pending. Tap 'Restore previous purchases' to activate." };
    }

    const verifyData = await verifyRes.json();
    if (verifyData.ok) return { ok: true };

    // verify-payment returned non-ok — the Razorpay webhook may still grant the license.
    // Poll the license status for up to 20s before giving up.
    const polled = await pollLicenseStatus(headers, productId);
    if (polled) return { ok: true };

    return { ok: false, error: verifyData.error ?? "Verification failed" };
}

// ── Android: Google Play Billing via expo-iap ─────────────────────────────────
// Used in onPurchaseSuccess when Platform.OS === 'android'.
// The actual purchase trigger happens via requestPurchase/requestSubscription in useIAP.

async function verifyAndroidPurchase(
    productId: ProductId,
    purchaseToken: string,
    accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
    };

    try {
        const res = await fetchWithTimeout(
            buildApiUrl("/api/payments/google-play/verify"),
            { method: "POST", headers, body: JSON.stringify({ productId, purchaseToken }) },
            30_000,
        );
        const data = await res.json();
        if (data.ok) return { ok: true };
        return { ok: false, error: data.error ?? "Google Play verification failed" };
    } catch {
        const polled = await pollLicenseStatus(headers, productId);
        if (polled) return { ok: true };
        return { ok: false, error: "Verification pending — tap Restore purchases to activate." };
    }
}

/**
 * Polls /api/license/status until the tier matches the purchased product,
 * or times out. Handles the case where the webhook grants the license
 * after verify-payment returns a non-ok status.
 */
async function pollLicenseStatus(
    headers: Record<string, string>,
    productId: ProductId,
): Promise<boolean> {
    const expectedTier = productId.startsWith("pro") ? "pro" : productId.startsWith("plus") ? "plus" : null;
    if (!expectedTier) return false; // token packs don't change tier

    const POLL_INTERVAL = 3000;
    const POLL_ATTEMPTS = 7; // 21s total

    for (let i = 0; i < POLL_ATTEMPTS; i++) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        try {
            const res = await fetchWithTimeout(
                buildApiUrl("/api/license/status"),
                { method: "GET", headers },
                8_000,
            );
            if (res.ok) {
                const data = await res.json();
                const tier = String(data?.tier ?? "").toLowerCase();
                if (tier === expectedTier || tier === "pro") return true;
            }
        } catch {
            // Network hiccup — keep polling
        }
    }
    return false;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UpgradeSheet({ visible, onClose, onPurchaseComplete, currentTier }: Props) {
    const colors = useColors();
    const { signInWithGoogle, signInWithApple, appleSignInAvailable } = useAuth();
    const [period, setPeriod] = useState<PlanPeriod>("monthly");
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [restoring, setRestoring] = useState(false);
    // freshTier: read from AsyncStorage when the sheet opens to avoid stale HistoryContext tier.
    // SettingsContext.onAuthStateChange writes the authoritative tier to AsyncStorage, but
    // HistoryContext (which owns licenseTier state) doesn't re-read after that update.
    const [freshTier, setFreshTier] = useState<string | null>(currentTier ?? null);
    const [signingIn, setSigningIn] = useState(false);
    const [userEmail, setUserEmail] = useState<string | undefined>();
    const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null); // null = loading
    const [purchaseSuccess, setPurchaseSuccess] = useState<{ tierName: string; isTokenPack: boolean } | null>(null);
    // Ref mirrors isSignedIn so stale closures (e.g. the onSuccess callback captured
    // in promptSignIn before sign-in) always read the latest value via .current.
    const isSignedInRef = useRef<boolean | null>(null);
    // Caches the access token so onPurchaseSuccess never calls getSession() on the
    // hot path — Supabase's lock manager blocks concurrent getSession/refreshSession
    // calls, which would cause the spinner to hang indefinitely.
    const accessTokenRef = useRef<string | null>(null);
    const purchaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Single gate: once any purchase outcome is handled, all further events are ignored
    const purchaseOutcomeHandledRef = useRef(false);
    const isRestoringRef = useRef(false);
    const handleRestoreRef = useRef<() => Promise<void>>(async () => {});

    useEffect(() => {
        purchaseOutcomeHandledRef.current = false;
        async function checkSession() {
            let { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                const { data: { session: refreshed } } = await supabase.auth.refreshSession();
                session = refreshed;
            }
            setUserEmail(session?.user?.email);
            setIsSignedIn(!!session?.access_token);
            isSignedInRef.current = !!session?.access_token;
            accessTokenRef.current = session?.access_token ?? null;

            // Read the freshest tier from AsyncStorage — avoids the stale React state
            // in HistoryContext when SettingsContext has already written a newer tier.
            try {
                const stored = await AsyncStorage.getItem("imotara_license_tier_v1");
                setFreshTier(stored ?? currentTier ?? null);
            } catch {
                setFreshTier(currentTier ?? null);
            }
        }
        checkSession();
    }, [visible, currentTier]);

    // Keep isSignedIn in sync with the global auth state (handles async deep-link OAuth)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsSignedIn(!!session?.access_token);
            isSignedInRef.current = !!session?.access_token;
            accessTokenRef.current = session?.access_token ?? null;
            setUserEmail(session?.user?.email);
        });
        return () => subscription.unsubscribe();
    }, []);

    // ── expo-iap: handles both iOS (Apple IAP) and Android (Google Play Billing) ──
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
            // Handles BOTH iOS and Android
            if (DEBUG_UI_ENABLED) console.log("[IAP] onPurchaseSuccess:", purchase.productId, "gate=", purchaseOutcomeHandledRef.current);
            // Gate check first — whichever callback fires first (success or error) claims the gate.
            if (purchaseOutcomeHandledRef.current) return;
            purchaseOutcomeHandledRef.current = true;
            // Do NOT clear purchaseTimeoutRef here — keep it as last-resort safety net.
            // It will be cleared in finally once verification finishes or fails.

            let serverVerified = false;
            try {
                const productId = iosSkuToProductId(purchase.productId ?? "");
                if (!productId) return;

                const isTokenPack = productId.startsWith("tokens_");

                // Use the cached access token — avoids calling getSession() on the hot
                // path, which can block on Supabase's internal lock if checkSession() is
                // concurrently running a refreshSession() network call.
                let accessToken = accessTokenRef.current;

                // If the ref is still null the component just mounted — do a single timed
                // getSession() attempt (10 s) before giving up.
                if (!accessToken) {
                    if (DEBUG_UI_ENABLED) console.log("[IAP] accessToken not cached yet — attempting timed getSession");
                    try {
                        const result = await Promise.race([
                            supabase.auth.getSession(),
                            new Promise<never>((_, reject) =>
                                setTimeout(() => reject(new Error("session_timeout")), 10_000)),
                        ]);
                        accessToken = result.data.session?.access_token ?? null;
                        if (accessToken) accessTokenRef.current = accessToken;
                    } catch (e) {
                        if (DEBUG_UI_ENABLED) console.log("[IAP] getSession timeout/error:", String(e));
                    }
                }

                if (!accessToken) {
                    if (DEBUG_UI_ENABLED) console.log("[IAP] no session — finishing transaction then showing sign in required");
                    // Finish the transaction BEFORE returning so the purchase doesn't stay
                    // stuck in a pending state. The user can restore it after signing in.
                    try { await finishTransaction({ purchase, isConsumable: isTokenPack }); } catch { /* ignore */ }
                    Alert.alert(
                        "Sign in required",
                        "Please sign in and re-open the app to activate your purchase. Your payment is safe — tap 'Restore purchases' after signing in.",
                    );
                    return;
                }

                if (DEBUG_UI_ENABLED) console.log("[IAP] session: true user:", userEmail ?? "unknown platform:", Platform.OS);

                if (Platform.OS === "android") {
                    // ── Android: Google Play Billing verification ──────────────────
                    const purchaseToken = (purchase as any).purchaseToken ?? (purchase as any).transactionReceipt ?? "";
                    if (!purchaseToken) {
                        Alert.alert("Purchase error", "No purchase token received. Please try again.");
                        return;
                    }
                    const androidResult = await verifyAndroidPurchase(
                        productId as ProductId,
                        purchaseToken,
                        accessToken,
                    );
                    if (!androidResult.ok) {
                        // Finish the transaction even on failure so Play doesn't auto-refund
                        // unacknowledged purchases after 3 days.
                        try { await finishTransaction({ purchase, isConsumable: isTokenPack }); } catch { /* ignore */ }
                        Alert.alert("Verification failed", androidResult.error ?? "Try again or tap Restore purchases.");
                        return;
                    }
                    serverVerified = true;
                    try {
                        await finishTransaction({ purchase, isConsumable: isTokenPack });
                    } catch { /* safe to ignore */ }
                } else {
                    // ── iOS: Apple IAP verification ────────────────────────────────
                    const iosTransactionId = (purchase as PurchaseIOS).transactionId ?? purchase.id;
                    if (DEBUG_UI_ENABLED) console.log("[IAP] verifying transactionId:", iosTransactionId);
                    const verifyAbort = new AbortController();
                    const verifyAbortTimer = setTimeout(() => verifyAbort.abort(), 35_000);
                    let verifyRes: Response;
                    try {
                        verifyRes = await fetch(buildApiUrl("/api/license/verify-apple-purchase"), {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${accessToken}`,
                            },
                            body: JSON.stringify({ productId, transactionId: iosTransactionId }),
                            signal: verifyAbort.signal,
                        });
                    } finally {
                        clearTimeout(verifyAbortTimer);
                    }
                    if (DEBUG_UI_ENABLED) console.log("[IAP] verify response status:", verifyRes.status);
                    if (!verifyRes.ok) {
                        const errBody = await verifyRes.json().catch(() => ({})) as { error?: string };
                        Alert.alert(
                            "Verification failed",
                            `${errBody.error ?? "Unknown error"}. Re-open the app to retry, or tap 'Restore previous purchases'.`,
                        );
                        return;
                    }
                    serverVerified = true;
                    try {
                        await finishTransaction({ purchase, isConsumable: isTokenPack });
                    } catch { /* safe to ignore — transaction may already be finalized */ }
                }

                try { await onPurchaseComplete(); } catch { /* best-effort */ }
                const tierName = isTokenPack ? "credits" : (productId.includes("pro") ? "Pro" : "Plus");
                setPurchaseSuccess({ tierName, isTokenPack });
            } catch (err) {
                if (DEBUG_UI_ENABLED) console.log("[IAP] onPurchaseSuccess catch:", String(err));
                if (serverVerified) {
                    Alert.alert(
                        "Purchase complete",
                        "Your payment was received. Please restart the app to activate your new plan.",
                    );
                } else {
                    Alert.alert(
                        "Verification failed",
                        "Could not reach the server. Re-open the app to retry, or tap 'Restore previous purchases'.",
                    );
                }
            } finally {
                // Clear the safety-net timeout and spinner together.
                if (purchaseTimeoutRef.current) { clearTimeout(purchaseTimeoutRef.current); purchaseTimeoutRef.current = null; }
                setPurchasing(null);
            }
        },
        onPurchaseError: (error) => {
            // Handle errors on both platforms
            const code = (error as any).code ?? "";
            const msg = (error as any).message ?? "";
            if (DEBUG_UI_ENABLED) console.log("[IAP] onPurchaseError:", code, msg, "gate=", purchaseOutcomeHandledRef.current);
            // Gate check FIRST — if onPurchaseSuccess already claimed the gate, return
            // immediately without clearing the spinner (success handler owns it now).
            if (purchaseOutcomeHandledRef.current) return;
            purchaseOutcomeHandledRef.current = true;
            // We own the gate: clear timeout and spinner
            if (purchaseTimeoutRef.current) { clearTimeout(purchaseTimeoutRef.current); purchaseTimeoutRef.current = null; }
            setPurchasing(null);
            if (code === "E_USER_CANCELLED") return;

            const isAlreadyOwned =
                code === "E_ALREADY_OWNED" ||
                msg.toLowerCase().includes("already owned") ||
                msg.toLowerCase().includes("already purchased");
            if (isAlreadyOwned) {
                Alert.alert(
                    "Already subscribed",
                    "This plan is already active on your Apple account. Tap 'Restore previous purchases' below to link it to your profile.",
                    [{ text: "OK" }],
                );
                return;
            }
            Alert.alert("Purchase failed", msg || "Please try again.");
        },
    });

    useEffect(() => {
        if (!connected || !visible) return;
        if (Platform.OS === "ios") {
            fetchProducts({ skus: [...IOS_SUBSCRIPTION_SKUS], type: "subs" }).catch(() => {});
            fetchProducts({ skus: [...IOS_TOKEN_SKUS], type: "in-app" }).catch(() => {});
        } else if (Platform.OS === "android") {
            // Google Play Billing — fetch both subscription and in-app products
            fetchProducts({ skus: [...ANDROID_SUBSCRIPTION_SKUS], type: "subs" }).catch(() => {});
            fetchProducts({ skus: [...ANDROID_TOKEN_SKUS], type: "in-app" }).catch(() => {});
        }
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
        if (DEBUG_UI_ENABLED) console.log("[IAP] handleIosPurchase:", sku, "purchasing=", purchasing, "signingIn=", signingIn, "signedIn=", isSignedInRef.current);
        if (purchasing || signingIn) return;
        if (isSignedInRef.current === false) {
            promptSignIn(() => handleIosPurchase(sku, type));
            return;
        }
        purchaseOutcomeHandledRef.current = false;
        setPurchasing(sku);
        // Safety net: if onPurchaseSuccess never fires (Sandbox delay, iOS beta quirk),
        // clear the spinner after 40s and direct the user to Restore.
        purchaseTimeoutRef.current = setTimeout(() => {
            setPurchasing(null);
            Alert.alert(
                "Taking longer than expected",
                "Your purchase may have been received. Tap 'Restore previous purchases' below to activate your plan.",
            );
        }, 40_000);
        try {
            await requestPurchase({ type, request: { apple: { sku } } });
        } catch (err: any) {
            if (purchaseTimeoutRef.current) { clearTimeout(purchaseTimeoutRef.current); purchaseTimeoutRef.current = null; }
            setPurchasing(null);
            const errCode = (err as any)?.code ?? "";
            const errMsg  = String((err as any)?.message ?? "");
            if (DEBUG_UI_ENABLED) console.log("[IAP] requestPurchase catch:", errCode, errMsg, "gate=", purchaseOutcomeHandledRef.current);
            // onPurchaseError fires as a separate event for the same failure.
            // Only show a dialog here if that callback hasn't already handled it.
            if (!purchaseOutcomeHandledRef.current && errCode !== "E_USER_CANCELLED") {
                purchaseOutcomeHandledRef.current = true;
                const isAlreadyOwned =
                    errCode === "E_ALREADY_OWNED" ||
                    errMsg.toLowerCase().includes("already owned") ||
                    errMsg.toLowerCase().includes("already purchased");
                if (isAlreadyOwned) {
                    Alert.alert(
                        "Already subscribed",
                        "This plan is already active on your Apple account. Tap 'Restore previous purchases' below to link it to your profile.",
                        [{ text: "OK" }],
                    );
                } else if (errMsg) {
                    Alert.alert("Purchase failed", errMsg);
                }
            }
        }
    };

    // ── Android: Google Play Billing via expo-iap ─────────────────────────────
    // The actual purchase result is handled in onPurchaseSuccess above.
    // This function just triggers the Google Play purchase sheet.
    const handleAndroidPurchase = async (productId: ProductId) => {
        if (purchasing || signingIn) return;
        if (isSignedInRef.current === false) {
            promptSignIn(() => handleAndroidPurchase(productId));
            return;
        }
        if (!accessTokenRef.current) {
            promptSignIn(() => handleAndroidPurchase(productId));
            return;
        }
        if (!connected) {
            Alert.alert("Store unavailable", "Google Play Billing is not connected. Please try again.");
            return;
        }
        setPurchasing(productId);
        purchaseOutcomeHandledRef.current = false;
        // Safety net: if onPurchaseSuccess/onPurchaseError never fires (GMS missing,
        // Play sheet closed without event), clear the spinner after 60 s.
        purchaseTimeoutRef.current = setTimeout(() => {
            setPurchasing(null);
            Alert.alert(
                "Taking longer than expected",
                "Your purchase may have been received. Tap 'Restore previous plan' below to activate it.",
            );
        }, 60_000);
        try {
            const isSubscription = ANDROID_SUBSCRIPTION_SET.has(productId);
            if (isSubscription) {
                await requestPurchase({ type: "subs", request: { android: { skus: [productId] } } });
            } else {
                await requestPurchase({ type: "in-app", request: { android: { skus: [productId] } } });
            }
            // Result handled in onPurchaseSuccess — purchaseTimeoutRef cleared + setPurchasing(null) there
        } catch (err: any) {
            if (purchaseTimeoutRef.current) { clearTimeout(purchaseTimeoutRef.current); purchaseTimeoutRef.current = null; }
            const msg = String(err?.message ?? err ?? "");
            if (!msg.toLowerCase().includes("cancel")) {
                Alert.alert("Purchase failed", msg || "Please try again.");
            }
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

    // ── Restore purchases ──────────────────────────────────────────────────────
    // expo-iap's restorePurchases() skips onPurchaseSuccess (alsoPublishToEventListenerIOS: false).
    // We fetch available purchases directly and run each through our verification backend.
    const handleRestore = async () => {
        if (isRestoringRef.current) return;
        isRestoringRef.current = true;
        setRestoring(true);
        try {
            const available = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
            const subs = available.filter((p) => {
                const id = iosSkuToProductId(p.productId ?? "");
                return id && !id.startsWith("tokens_");
            });
            if (subs.length === 0) {
                Alert.alert("Nothing to restore", "No active subscriptions found for this Apple ID.");
                return;
            }
            let restored = 0;
            for (const purchase of subs) {
                const productId = iosSkuToProductId(purchase.productId ?? "");
                if (!productId) continue;
                let { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) {
                    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
                    session = refreshed;
                }
                if (!session?.access_token) {
                    Alert.alert("Sign in required", "Please sign in to restore your purchases.");
                    return;
                }
                const iosTransactionId = (purchase as any).transactionId ?? purchase.id;
                const restoreAbort = new AbortController();
                const restoreAbortTimer = setTimeout(() => restoreAbort.abort(), 35_000);
                let res: Response;
                try {
                    res = await fetch(buildApiUrl("/api/license/verify-apple-purchase"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                        body: JSON.stringify({ productId, transactionId: iosTransactionId }),
                        signal: restoreAbort.signal,
                    });
                } finally {
                    clearTimeout(restoreAbortTimer);
                }
                if (res.ok) restored++;
            }
            if (restored > 0) {
                try { await onPurchaseComplete(); } catch { /* best-effort */ }
                onClose();
                Alert.alert("Restored!", "Your subscription has been activated.");
            } else {
                Alert.alert("Restore failed", "Could not verify your subscription. Please try again.");
            }
        } catch {
            Alert.alert("Restore failed", "Could not reach the server. Please try again.");
        } finally {
            isRestoringRef.current = false;
            setRestoring(false);
        }
    };

    // Keep ref current so onPurchaseError (captured inside useIAP) can call it
    handleRestoreRef.current = handleRestore;

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
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textPrimary }}>
                            Upgrade Imotara
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
                            Current plan:{" "}
                            <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
                                {freshTier
                                    ? (String(freshTier).toUpperCase() === "PREMIUM" ? "Pro"
                                        : freshTier.charAt(0).toUpperCase() + freshTier.slice(1).toLowerCase())
                                    : "Free"}
                            </Text>
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ fontSize: 26, color: colors.textSecondary, lineHeight: 28 }}>×</Text>
                    </TouchableOpacity>
                </View>

                {purchaseSuccess ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
                        <Text style={{ fontSize: 52, marginBottom: 16 }}>💙</Text>
                        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 8, textAlign: "center" }}>
                            {purchaseSuccess.isTokenPack ? "Credits added!" : "You're all set!"}
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 32 }}>
                            {purchaseSuccess.isTokenPack
                                ? "Your credits have been added to your account."
                                : `Welcome to ${purchaseSuccess.tierName}. Enjoy unlimited replies and everything that comes with it.`}
                        </Text>
                        <TouchableOpacity
                            onPress={() => { setPurchaseSuccess(null); onClose(); }}
                            style={{ paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary }}
                        >
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Back to chat</Text>
                        </TouchableOpacity>
                    </View>
                ) : iosLoading ? (
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
                            backgroundColor: colors.surfaceSoft,
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

                                // Mobile stores "pro" as "PREMIUM" — normalise before comparing.
                                // Use freshTier (read from AsyncStorage on open) to avoid stale
                                // React state from HistoryContext when the session tier has changed.
                                const planKey = plan.tier === "pro" ? "PREMIUM" : plan.tier.toUpperCase();
                                const isCurrent = freshTier && planKey === String(freshTier).toUpperCase();
                                return (
                                    <View key={plan.id} style={{
                                        flex: 1, borderRadius: 16, padding: 16,
                                        borderWidth: isPro ? 1.5 : 1,
                                        borderColor: isCurrent ? colors.primary : isPro ? "#6366f1" : colors.border,
                                        backgroundColor: isPro ? "rgba(99,102,241,0.12)" : colors.surfaceSoft,
                                    }}>
                                        {isCurrent ? (
                                            <View style={{
                                                backgroundColor: colors.primary, borderRadius: 6,
                                                paddingHorizontal: 8, paddingVertical: 2,
                                                alignSelf: "flex-start", marginBottom: 8,
                                            }}>
                                                <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>YOUR PLAN</Text>
                                            </View>
                                        ) : isPro && (
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
                                            onPress={() => { if (!isCurrent) handlePlanPress(plan); }}
                                            disabled={!!purchasing || !!isCurrent}
                                            style={{
                                                marginTop: 16, paddingVertical: 10, borderRadius: 10,
                                                backgroundColor: isCurrent
                                                    ? colors.surfaceSoft
                                                    : isPro ? "#6366f1" : "rgba(99,102,241,0.2)",
                                                alignItems: "center",
                                                opacity: (purchasing && !isBusy) ? 0.5 : 1,
                                                borderWidth: isCurrent ? 1 : 0,
                                                borderColor: isCurrent ? colors.primary : undefined,
                                            }}
                                        >
                                            {isBusy
                                                ? <ActivityIndicator size="small" color={isPro ? "#fff" : "#a5b4fc"} />
                                                : <Text style={{ fontSize: 13, fontWeight: "700", color: isCurrent ? colors.primary : isPro ? "#fff" : "#a5b4fc" }}>
                                                    {isCurrent ? "Current plan" : "Subscribe"}
                                                </Text>
                                            }
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Token packs */}
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 12 }}>
                            Top up with message credits
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
                                            borderWidth: 1, borderColor: colors.border,
                                            backgroundColor: colors.surfaceSoft,
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

                        {/* Enterprise & Institutional */}
                        <View style={{
                            borderRadius: 14, padding: 16, marginBottom: 20,
                            borderWidth: 1, borderColor: "rgba(167,139,250,0.25)",
                            backgroundColor: "rgba(167,139,250,0.07)",
                        }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>
                                    Enterprise &amp; Institutional
                                </Text>
                                <View style={{
                                    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20,
                                    backgroundColor: "rgba(167,139,250,0.2)", borderWidth: 1,
                                    borderColor: "rgba(167,139,250,0.3)",
                                }}>
                                    <Text style={{ fontSize: 9, fontWeight: "700", color: "#c4b5fd", letterSpacing: 0.5 }}>
                                        CUSTOM PRICING
                                    </Text>
                                </View>
                            </View>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 }}>
                                For organisations, healthcare platforms, schools, and HR teams. Includes admin dashboard, multi-profile management, child-safe mode, SSO, data residency, and dedicated support.
                            </Text>
                            <TouchableOpacity
                                onPress={() => Linking.openURL("mailto:info@imotara.com?subject=Enterprise%20inquiry")}
                                style={{
                                    paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10,
                                    backgroundColor: "rgba(139,92,246,0.3)", alignItems: "center",
                                    borderWidth: 1, borderColor: "rgba(167,139,250,0.3)",
                                }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: "700", color: "#c4b5fd" }}>
                                    Contact us for Enterprise
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Feature comparison by tier */}
                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 12 }}>
                                Compare plans
                            </Text>

                            {([
                                {
                                    tier: "Free",
                                    color: "#a1a1aa",
                                    badge: "#27272a",
                                    items: [
                                        "20 enhanced replies / day",
                                        "Unlimited on-device replies",
                                        "7-day history backup",
                                        "Basic TTS (device voice)",
                                        "Voice input (speech-to-text)",
                                        "20 emoji reactions on messages",
                                        "Companion emoji reactions",
                                        "Streak tracking",
                                        "Daily check-in reminder",
                                        "Encrypted account storage",
                                        "GDPR & data deletion request",
                                        "Community docs & FAQ",
                                        "Imotara Connect — browse & book human wellness companions",
                                        "Imotara Wallet — prepaid session balance",
                                        "Real-time session translation",
                                        "Scheduled sessions & companion favourites",
                                        "Session notes & ratings",
                                        "Connect session history — 7 days",
                                    ],
                                },
                                {
                                    tier: "Plus",
                                    color: "#38bdf8",
                                    badge: "rgba(14,165,233,0.15)",
                                    items: [
                                        "Unlimited cloud replies",
                                        "90-day history backup",
                                        "Cross-device access",
                                        "Companion mode / personas",
                                        "Response length control",
                                        "All companion tones",
                                        "History search across dates",
                                        "Data export (JSON, CSV, PDF)",
                                        "Advanced TTS — voice, speed & pitch",
                                        "Azure Neural TTS",
                                        "Language-matched TTS voices",
                                        "Semantic history search",
                                        "Reply cadence controls",
                                        "Session duration stats",
                                        "Custom notification schedule",
                                        "Session token management",
                                        "Email & priority support",
                                        "Connect session history — 90 days",
                                    ],
                                },
                                {
                                    tier: "Pro",
                                    color: "#818cf8",
                                    badge: "rgba(99,102,241,0.15)",
                                    items: [
                                        "Everything in Plus",
                                        "Unlimited history",
                                        "Emotion trends & mood graphs",
                                        "Conversation insights",
                                        "Weekly emotional summary",
                                        "Weekly insight digest (push)",
                                        "Monthly companion letter",
                                        "Letter archive (up to 24 saved)",
                                        "Listen to letters (TTS)",
                                        "React & reply to letters",
                                        "Long-term growth arc narrative",
                                        "Unlimited Connect session history",
                                    ],
                                },
                                {
                                    tier: "Enterprise",
                                    color: "#c4b5fd",
                                    badge: "rgba(139,92,246,0.15)",
                                    items: [
                                        "Everything in Pro",
                                        "Multi-profile management",
                                        "Child-safe mode",
                                        "Admin dashboard & analytics",
                                        "User & bulk provisioning",
                                        "SSO / SAML integration",
                                        "Data residency control",
                                        "Audit logs",
                                        "API access",
                                        "Custom integrations & webhooks",
                                        "Institution branding",
                                        "Dedicated account manager",
                                        "SLA guarantee",
                                        "Onboarding assistance",
                                    ],
                                },
                            ] as const).map(({ tier, color, badge, items }) => (
                                <View key={tier} style={{
                                    marginBottom: 10, borderRadius: 12,
                                    borderWidth: 1, borderColor: colors.border,
                                    backgroundColor: colors.surface,
                                    overflow: "hidden",
                                }}>
                                    <View style={{
                                        paddingHorizontal: 12, paddingVertical: 8,
                                        backgroundColor: badge,
                                        borderBottomWidth: 1, borderBottomColor: colors.border,
                                    }}>
                                        <Text style={{ fontSize: 12, fontWeight: "700", color }}>
                                            {tier}
                                        </Text>
                                    </View>
                                    <View style={{ padding: 12, gap: 5 }}>
                                        {items.map((item) => (
                                            <View key={item} style={{ flexDirection: "row", gap: 7, alignItems: "flex-start" }}>
                                                <Text style={{ color, fontSize: 12, lineHeight: 18 }}>✓</Text>
                                                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, flex: 1 }}>
                                                    {item}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* iOS: Restore purchases (App Store guideline requirement) */}
                        {Platform.OS === "ios" && (
                            <TouchableOpacity
                                onPress={handleRestore}
                                disabled={restoring}
                                style={{ alignItems: "center", paddingVertical: 8 }}
                            >
                                {restoring
                                    ? <ActivityIndicator size="small" color={colors.textSecondary} />
                                    : <Text style={{ fontSize: 12, color: colors.textSecondary, textDecorationLine: "underline" }}>
                                        Restore previous purchases
                                    </Text>
                                }
                            </TouchableOpacity>
                        )}

                        {/* Android: Restore plan via Supabase (sign in → fetch license) */}
                        {Platform.OS === "android" && (
                            <TouchableOpacity
                                disabled={restoring}
                                style={{ alignItems: "center", paddingVertical: 8 }}
                                onPress={async () => {
                                    if (!isSignedIn) {
                                        // Prompt sign-in; once signed in the license
                                        // is auto-fetched via onAuthStateChange
                                        promptSignIn(async () => {
                                            setRestoring(true);
                                            try {
                                                const token = accessTokenRef.current;
                                                if (!token) return;
                                                const res = await fetchWithTimeout(
                                                    buildApiUrl("/api/license/status"),
                                                    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
                                                    12_000,
                                                );
                                                if (res.ok) {
                                                    const data = await res.json();
                                                    const tier = String(data?.license?.tier ?? data?.tier ?? "free").toLowerCase();
                                                    if (tier === "plus" || tier === "pro") {
                                                        Alert.alert("Plan restored", `Your ${tier === "pro" ? "Pro" : "Plus"} plan has been restored.`);
                                                        try { await onPurchaseComplete(); } catch { }
                                                    } else {
                                                        Alert.alert("No active plan found", "No active Plus or Pro subscription was found for this account.");
                                                    }
                                                }
                                            } catch {
                                                Alert.alert("Restore failed", "Could not reach the server. Please check your connection and try again.");
                                            } finally {
                                                setRestoring(false);
                                            }
                                        });
                                        return;
                                    }
                                    // Already signed in — directly check Supabase
                                    setRestoring(true);
                                    try {
                                        const token = accessTokenRef.current;
                                        if (!token) { setRestoring(false); return; }
                                        const res = await fetchWithTimeout(
                                            buildApiUrl("/api/license/status"),
                                            { method: "GET", headers: { Authorization: `Bearer ${token}` } },
                                            12_000,
                                        );
                                        if (res.ok) {
                                            const data = await res.json();
                                            const tier = String(data?.license?.tier ?? data?.tier ?? "free").toLowerCase();
                                            if (tier === "plus" || tier === "pro") {
                                                Alert.alert("Plan restored", `Your ${tier === "pro" ? "Pro" : "Plus"} plan has been restored.`);
                                                try { await onPurchaseComplete(); } catch { }
                                            } else {
                                                Alert.alert("No active plan found", "No active Plus or Pro subscription was found for this account.");
                                            }
                                        }
                                    } catch {
                                        Alert.alert("Restore failed", "Could not reach the server. Please check your connection and try again.");
                                    } finally {
                                        setRestoring(false);
                                    }
                                }}
                            >
                                {restoring
                                    ? <ActivityIndicator size="small" color={colors.textSecondary} />
                                    : <Text style={{ fontSize: 12, color: colors.textSecondary, textDecorationLine: "underline" }}>
                                        Restore previous plan
                                    </Text>
                                }
                            </TouchableOpacity>
                        )}

                        <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: "center", marginTop: 8 }}>
                            {Platform.OS === "ios"
                                ? "Subscriptions auto-renew monthly or annually at the price shown. Cancel anytime in iOS Settings → Subscriptions."
                                : "Subscriptions auto-renew monthly or annually at the price shown. Cancel anytime in Google Play → Subscriptions."}
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
