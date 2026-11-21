// src/components/age/AgeSignalGate.tsx
//
// #159 — acts on the OS age signal (see lib/age/ageSignals.ts).
//
// Sits INSIDE ConsentGateMount (so it only runs after Terms are accepted) and
// OUTSIDE the rest of the app, for the same reason the consent gate does: a
// stop screen that renders beside the app can be raced by another overlay; one
// the app mounts behind cannot.
//
// ⚠️ It does NOT hold the app back while the OS answers. Everyone except a known
// under-13 goes straight in — a slower cold start for every adult would be a UX
// regression (standing rule). A known under-13 (verdict stored from an earlier
// open) sees the stop screen at once; a first-time answer switches to it the
// moment it arrives.

import React, { createContext, useContext, useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    AGE_VERDICT_KEY,
    nextStoredVerdict,
    parseVerdict,
    readAgeVerdict,
    type AgeRangeApi,
    type AgeVerdict,
} from "../../lib/age/ageSignals";
import { getUnderAgeCopy } from "../../lib/age/underAgeCopy";
import { getConsentCopy } from "../../lib/legal/consentCopy";
import { getCrisisResourcesForCountry } from "../../lib/safety/crisisResources";
import { hydrateCrisisCountry, resolveCrisisCountry } from "../../lib/safety/resolveCrisisCountry";
import { isRtlLang } from "../../lib/lang/rtlLangs";
import { useColors } from "../../theme/ThemeContext";

const SETTINGS_STORAGE_KEY = "imotara_settings_v1";

const AgeVerdictContext = createContext<AgeVerdict>("unknown");
export const useAgeVerdict = () => useContext(AgeVerdictContext);

function loadApi(): AgeRangeApi | null {
    try {
        // Required lazily: a build without the native module (Expo Go, web, an
        // old dev client) must still open — it just never gets a signal.
        return require("expo-age-range") as AgeRangeApi;
    } catch {
        return null;
    }
}

export default function AgeSignalGate({ children }: { children: React.ReactNode }) {
    const [verdict, setVerdict] = useState<AgeVerdict | null>(null);
    const [lang, setLang] = useState<string | undefined>(undefined);

    useEffect(() => {
        let alive = true;
        (async () => {
            let stored: AgeVerdict | null = null;
            try {
                stored = parseVerdict(await AsyncStorage.getItem(AGE_VERDICT_KEY));
                const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
                const pref = raw ? JSON.parse(raw)?.user?.preferredLang : null;
                // ⛔ "auto" is not a language (trap_concretelang_turns_auto_into_en).
                if (alive && typeof pref === "string" && pref && pref !== "auto") setLang(pref);
            } catch {
                // fall through: unknown, English
            }
            if (alive) setVerdict(stored ?? "unknown");

            const api = loadApi();
            if (!api) return;
            // 🧪 DEV ONLY: EXPO_PUBLIC_FAKE_AGE = "under13" | "teen" | "adult".
            // Android feeds it through Play's own FakeAgeSignalsManager, so the
            // real native path runs; iOS has no fake API, so the verdict is set
            // directly. ⛔ Release builds never read it (and Play refuses fakes
            // in a non-debuggable build anyway).
            // ⚠️ No optional chaining on process.env — it defeats Expo's inlining.
            const fake = __DEV__ ? process.env.EXPO_PUBLIC_FAKE_AGE : undefined;
            if (fake === "under13" || fake === "teen" || fake === "adult") {
                const band = fake === "under13" ? [null, 12] : fake === "teen" ? [13, 15] : [18, null];
                if (Platform.OS === "android") {
                    try {
                        (api as any).setFakeAgeSignals({ ageSignalsStatus: "SHARED", lowerBound: band[0], upperBound: band[1], ageRangeSource: "TIER_A" });
                    } catch {}
                } else {
                    if (alive) setVerdict(fake);
                    return;
                }
            }
            const fresh = await readAgeVerdict(api);
            const next = nextStoredVerdict(stored, fresh);
            if (next && next !== stored) {
                try {
                    await AsyncStorage.setItem(AGE_VERDICT_KEY, next);
                } catch {
                    // the in-memory verdict still applies this session
                }
            }
            if (alive && next) setVerdict(next);
        })();
        return () => {
            alive = false;
        };
    }, []);

    // One storage read — the same wait ConsentGateMount already has.
    if (verdict === null) return null;
    if (verdict === "under13") return <UnderAgeScreen lang={lang} />;

    return <AgeVerdictContext.Provider value={verdict}>{children}</AgeVerdictContext.Provider>;
}

function UnderAgeScreen({ lang }: { lang?: string }) {
    const c = useColors();
    const s = makeStyles(c);
    const [country, setCountry] = useState<string | null>(resolveCrisisCountry());
    useEffect(() => {
        void hydrateCrisisCountry().then(() => setCountry(resolveCrisisCountry()));
    }, []);

    const copy = getUnderAgeCopy(lang);
    const help = getConsentCopy(lang);
    const rtl = isRtlLang(lang);
    const align = rtl ? ("right" as const) : ("left" as const);
    const dir = rtl ? ("rtl" as const) : ("ltr" as const);

    const resources = getCrisisResourcesForCountry(country);
    const lines: { label: string; contact: string; url?: string }[] = [];
    if (resources.emergency) lines.push(resources.emergency);
    resources.primary.slice(0, 2).forEach((r) => lines.push(r));

    return (
        <View style={s.screen}>
            <ScrollView contentContainerStyle={s.scrollInner} showsVerticalScrollIndicator={false}>
                <View style={s.card}>
                    <View style={s.rule} />
                    <View style={s.inner}>
                        <View style={s.haloWrap}>
                            <View style={s.halo}>
                                <Text style={s.heart}>💛</Text>
                            </View>
                        </View>
                        <Text style={s.title}>{copy.title}</Text>
                        <Text style={s.body}>{copy.body}</Text>

                        <View style={[s.help, rtl ? s.helpRtl : s.helpLtr]}>
                            <Text style={[s.helpLead, { textAlign: align, writingDirection: dir }]}>{help.emergencyLead}</Text>
                            {lines.map((l) => (
                                <Pressable
                                    key={`${l.label}-${l.contact}`}
                                    onPress={() =>
                                        Linking.openURL(l.url ?? `tel:${l.contact.replace(/[^\d+]/g, "")}`).catch(() => {})
                                    }
                                    accessibilityRole="link"
                                    accessibilityLabel={`${l.label}: ${l.contact}`}
                                    hitSlop={8}
                                    style={[s.lineRow, rtl && s.lineRowRtl]}
                                >
                                    <Text style={s.lineLabel}>{l.label}:</Text>
                                    <Text style={s.lineContact}>{l.contact}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
    StyleSheet.create({
        screen: { flex: 1, backgroundColor: c.background },
        scrollInner: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 28 },
        card: { borderRadius: 24, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
        rule: { height: 3, backgroundColor: c.primary },
        inner: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 22 },
        haloWrap: { alignItems: "center", marginBottom: 16 },
        halo: {
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.primaryTint,
        },
        heart: { fontSize: 27 },
        title: { fontSize: 21, fontWeight: "600", color: c.textPrimary, textAlign: "center", marginBottom: 10, lineHeight: 28 },
        body: { fontSize: 15.5, color: c.textPrimary, textAlign: "center", lineHeight: 24, marginBottom: 18 },
        help: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: c.emotionAnxious },
        helpLtr: { borderLeftWidth: 3, borderLeftColor: c.warningStrong },
        helpRtl: { borderRightWidth: 3, borderRightColor: c.warningStrong },
        helpLead: { fontSize: 13, color: c.textPrimary, lineHeight: 20, marginBottom: 4 },
        lineRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, paddingVertical: 8 },
        lineRowRtl: { flexDirection: "row-reverse" },
        lineLabel: { fontSize: 13, color: c.textPrimary },
        lineContact: { fontSize: 13, fontWeight: "700", color: c.warningStrong, textDecorationLine: "underline" },
    });
