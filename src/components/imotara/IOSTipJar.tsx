// src/components/imotara/IOSTipJar.tsx
// Apple IAP "tip jar" for iOS — satisfies guideline 3.1.1 by routing all
// in-app payments through StoreKit 2 / App Store.
//
// Product IDs must match the Consumable IAP products created in App Store Connect:
//   com.imotara.imotara.tip1  ~₹79
//   com.imotara.imotara.tip2  ~₹149
//   com.imotara.imotara.tip3  ~₹299
//   com.imotara.imotara.tip4  ~₹499
//   com.imotara.imotara.tip5  ~₹999

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useIAP } from "expo-iap";
import type { Purchase, Product } from "expo-iap";
import { useColors } from "../../theme/ThemeContext";

export const IOS_TIP_SKUS = [
    "com.imotara.imotara.tip1",
    "com.imotara.imotara.tip2",
    "com.imotara.imotara.tip3",
    "com.imotara.imotara.tip4",
    "com.imotara.imotara.tip5",
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

    return (
        <View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {products.map((product) => {
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
