// src/components/imotara/IOSTipJar.tsx
// Apple IAP "tip jar" for iOS — satisfies guideline 3.1.1 by routing all
// in-app payments through StoreKit 2 / App Store.
//
// Product IDs below must match the Consumable IAP products already created in
// App Store Connect exactly — Apple doesn't support renaming a live product
// ID, so don't "fix" these to match their real prices without also creating
// new App Store Connect products and migrating. The name-vs-price mismatch is
// cosmetic only: the button always renders Apple's real displayPrice, never
// these names, so no user ever sees the wrong number.
//   donation_49   really priced ~₹79
//   donation_99   really priced ~₹149
//   donation_199  really priced ~₹299
//   donation_499  really priced ~₹499  (matches)
//   donation_999  really priced ~₹999  (matches)

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import type { Purchase, Product } from "expo-iap";
let _iapModule: typeof import("expo-iap") | null = null;
try { _iapModule = require("expo-iap"); } catch { /* not available in dev builds */ }
const useIAP: typeof import("expo-iap")["useIAP"] = _iapModule?.useIAP ?? (() => ({ connected: false, products: [], subscriptions: [], availablePurchases: [], currentPurchase: undefined, currentPurchaseError: undefined, finishTransaction: async () => {}, getProducts: async () => {}, getSubscriptions: async () => {}, requestPurchase: async () => {}, requestSubscription: async () => {} } as any));
import { useColors } from "../../theme/ThemeContext";

export const IOS_TIP_SKUS = [
    "donation_49",
    "donation_99",
    "donation_199",
    "donation_499",
    "donation_999",
];

export default function IOSTipJar() {
    const colors = useColors();
    const [purchasing, setPurchasing] = useState<string | null>(null);

    const {
        connected,
        products,
        fetchProducts,
        requestPurchase,
        finishTransaction,
    } = useIAP({
        onPurchaseSuccess: async (purchase: Purchase) => {
            // expo-iap broadcasts every purchase to all active useIAP hooks.
            // Only handle tip products here; subscriptions/tokens are handled by UpgradeSheet.
            const pid = purchase.productId ?? "";
            const isTip = IOS_TIP_SKUS.some((sku) => pid === sku || pid.endsWith(`.${sku}`));
            if (!isTip) return;

            try {
                await finishTransaction({ purchase, isConsumable: true });
                Alert.alert(
                    "Thank you! 💙",
                    "Your support means a lot and helps keep Imotara free and private for everyone."
                );
            } catch {
                // best-effort finish
            } finally {
                setPurchasing(null);
            }
        },
        onPurchaseError: (error) => {
            setPurchasing(null);
            // E_USER_CANCELLED = user tapped Cancel — no alert needed
            if ((error as any).code !== "E_USER_CANCELLED") {
                Alert.alert("Purchase failed", error.message ?? "Please try again.");
            }
        },
    });

    useEffect(() => {
        if (connected) {
            fetchProducts({ skus: IOS_TIP_SKUS, type: "in-app" }).catch(() => {});
        }
    }, [connected]);

    const handlePurchase = async (product: Product) => {
        if (purchasing) return;
        setPurchasing(product.id);
        try {
            await requestPurchase({
                type: "in-app",
                request: { apple: { sku: product.id } },
            });
        } catch {
            setPurchasing(null);
        }
    };

    if (!connected) {
        return (
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
                    Connecting to App Store…
                </Text>
            </View>
        );
    }

    if (products.length === 0) {
        return (
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: "italic" }}>
                Tip options not available right now. Please try again later.
            </Text>
        );
    }

    // Deduplicate by id and sort to match IOS_TIP_SKUS order
    const sortedProducts = IOS_TIP_SKUS
        .map((sku) => products.find((p) => p.id === sku || p.id.endsWith(`.${sku}`)))
        .filter((p): p is NonNullable<typeof p> => p != null);

    return (
        <View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {sortedProducts.map((product) => {
                    const isBusy = purchasing === product.id;
                    return (
                        <TouchableOpacity
                            key={product.id}
                            onPress={() => handlePurchase(product)}
                            disabled={!!purchasing}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 7,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: colors.primary,
                                backgroundColor: "rgba(56, 189, 248, 0.12)",
                                marginRight: 8,
                                marginBottom: 8,
                                opacity: purchasing && !isBusy ? 0.5 : 1,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                            }}
                        >
                            {isBusy && (
                                <ActivityIndicator size="small" color={colors.primary} />
                            )}
                            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>
                                {(product as any).displayPrice ?? product.id}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                Processed securely by Apple. Imotara receives the amount after Apple's fee.
            </Text>
        </View>
    );
}
