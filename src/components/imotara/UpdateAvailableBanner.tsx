// src/components/imotara/UpdateAvailableBanner.tsx
// "A new version of Imotara is available — Update / Not now" (owner, 7 Nov 2026).
// Rules + words ⇒ lib/update/updatePrompt.ts. Shown by RootNavigator, never on
// a first open. "Update" opens the store page; "Not now" hides it until the
// next open.

import React from "react";
import { Linking, Platform, Text, TouchableOpacity, View } from "react-native";
import { isRtlLang } from "../../lib/lang/rtlLangs";
import { STORE_URL, type StorePlatform } from "../../lib/update/updatePrompt";

type Colors = { surface: string; textPrimary: string };

export async function openStorePage(platform: StorePlatform): Promise<void> {
    const { app, web } = STORE_URL[platform];
    try {
        await Linking.openURL(app);
    } catch {
        // No store app on this phone (or the scheme is blocked) ⇒ the store's web page.
        Linking.openURL(web).catch(() => {});
    }
}

export default function UpdateAvailableBanner(props: {
    top: number;
    colors: Colors;
    strings: { lang: string; title: string; update: string; later: string };
    onUpdate: () => void;
    onLater: () => void;
}) {
    const rtl = isRtlLang(props.strings.lang);
    const align = { writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" } as const;
    return (
        <View
            accessibilityRole="alert"
            style={{
                position: "absolute", left: 12, right: 12, top: props.top + 8, zIndex: 50, elevation: 8,
                borderRadius: 16, borderWidth: 1, borderColor: "rgba(139,92,246,0.35)",
                backgroundColor: props.colors.surface, paddingHorizontal: 14, paddingVertical: 12,
                shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
            }}
        >
            <Text style={{ fontSize: 14, fontWeight: "600", color: props.colors.textPrimary, ...align }}>
                ✨ {props.strings.title}
            </Text>
            <View style={{ flexDirection: rtl ? "row-reverse" : "row", marginTop: 10, gap: 8 }}>
                <TouchableOpacity
                    onPress={props.onUpdate}
                    accessibilityRole="button"
                    style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#7c3aed" }}
                >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>{props.strings.update}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={props.onLater}
                    accessibilityRole="button"
                    style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(139,92,246,0.35)" }}
                >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: props.colors.textPrimary }}>{props.strings.later}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export const STORE_PLATFORM: StorePlatform | null =
    Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : null;
