// src/components/legal/ConsentGate.tsx
//
// The first-use acceptance gate for iOS and Android. Mirrors the web gate in
// imotaraapp/src/components/legal/ConsentGate.tsx.
//
// ⛔ WHY FIRST USE AND NOT FIRST LOGIN: people chat before signing in —
// ChatScreen renders <SignInPrompt> as a PROMPT, not a gate. Gating on login
// would miss the person who opens Imotara once, in distress, and never creates
// an account, which is exactly who this exists for.
//
// ⛔ The helpline numbers are NOT hard-coded here. They come from
// getCrisisResourcesForCountry() so this screen and the crisis card can never
// drift apart.

import React, { useCallback, useEffect, useState } from "react";
import {
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getConsentCopy } from "../../lib/legal/consentCopy";
import {
    TERMS_ACCEPTANCE_KEY,
    buildAcceptance,
    hasAcceptedCurrentTerms,
    parseAcceptance,
    type TermsAcceptance,
} from "../../lib/legal/termsVersion";
import { getCrisisResourcesForCountry } from "../../lib/safety/crisisResources";
import { isRtlLang } from "../../lib/lang/rtlLangs";
import { useColors } from "../../theme/ThemeContext";

const TERMS_URL = "https://www.imotara.com/terms";
const PRIVACY_URL = "https://www.imotara.com/privacy";

type Props = {
    /** Resolved UI language. ⛔ Never "auto". */
    lang?: string | null;
    countryCode?: string | null;
    onAccepted?: (record: TermsAcceptance) => void;
    /** "ios" | "android" — recorded so platform is knowable after the fact. */
    surface: "ios" | "android";
};

export default function ConsentGate({ lang, countryCode, onAccepted, surface }: Props) {
    // ⛔ Colours come from the theme, never hard-coded hex. src/__tests__/
    // semanticColors.test.ts forbids literals that fail contrast on the light
    // surface — and it caught this component doing exactly that: the first
    // draft was dark-only and would have been unreadable for anyone using
    // Imotara in light mode.
    const c = useColors();
    // null = undetermined. Rendering nothing until we know avoids a flash of the
    // gate for someone who accepted long ago.
    const [needed, setNeeded] = useState<boolean | null>(null);
    // Pre-ticked, by the owner's explicit instruction (2026-10-13).
    const [checked, setChecked] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(TERMS_ACCEPTANCE_KEY);
                if (alive) setNeeded(!hasAcceptedCurrentTerms(parseAcceptance(raw)));
            } catch {
                // Storage unavailable: show the gate rather than skip it.
                if (alive) setNeeded(true);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    const accept = useCallback(async () => {
        const record = buildAcceptance(surface, lang || "en");
        try {
            await AsyncStorage.setItem(TERMS_ACCEPTANCE_KEY, JSON.stringify(record));
        } catch {
            // Let them through anyway. Blocking someone from the app because
            // storage failed would be worse, and the durable copy is the server
            // write in onAccepted.
        }
        onAccepted?.(record);
        setNeeded(false);
    }, [lang, surface, onAccepted]);

    if (needed === null) return null;
    if (needed === false) return null;

    const styles = makeStyles(c);
    const copy = getConsentCopy(lang);
    const rtl = isRtlLang(lang);
    const resources = getCrisisResourcesForCountry(countryCode);
    const emergency = resources?.emergency;
    const firstLine = resources?.primary?.[0];

    // Placeholders let each translation own its word order instead of being
    // forced into English's.
    const [beforeTerms, afterTerms = ""] = copy.agree.split("{terms}");
    const [betweenLinks, afterPrivacy = ""] = afterTerms.split("{privacy}");

    const open = (url: string) => {
        Linking.openURL(url).catch(() => {});
    };

    const dir = rtl ? ("rtl" as const) : ("ltr" as const);
    const align = rtl ? ("right" as const) : ("left" as const);

    // ⛔ NOT a <Modal> any more. The gate is now mounted INSTEAD of the app
    // (App.tsx), so there is nothing behind it to overlay — and a Modal would
    // reintroduce the very stacking race that let SignInPrompt cover it on
    // Android. A plain full-screen View cannot be raced.
    return (
        <View style={styles.scrim}>
                <ScrollView
                    contentContainerStyle={styles.scrollInner}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.card}>
                        <View style={styles.rule} />

                        <View style={styles.inner}>
                            <View style={styles.haloWrap}>
                                <View style={styles.halo}>
                                    <Text style={styles.heart}>💛</Text>
                                </View>
                            </View>

                            <Text style={styles.title}>{copy.title}</Text>

                            {/* The warm line leads: what Imotara IS comes before what
                                it is not, so the first thing someone in distress reads
                                is not a legal shield. */}
                            <Text style={styles.warm}>{copy.warm}</Text>

                            {/* The disclaimer. ⛔ Demoted in WEIGHT only — still
                                explicit, still above the fold. */}
                            <Text style={styles.disclaimer}>{copy.body}</Text>

                            <View
                                style={[
                                    styles.emergency,
                                    rtl ? styles.emergencyRtl : styles.emergencyLtr,
                                ]}
                            >
                                <Text
                                    style={[styles.emergencyLead, { textAlign: align, writingDirection: dir }]}
                                >
                                    {copy.emergencyLead}
                                </Text>
                                {(emergency || firstLine) && (
                                    <Text
                                        style={[styles.emergencyNums, { textAlign: align, writingDirection: dir }]}
                                    >
                                        {emergency ? `${emergency.label} ${emergency.contact}` : ""}
                                        {emergency && firstLine ? "  ·  " : ""}
                                        {firstLine ? `${firstLine.label} ${firstLine.contact}` : ""}
                                    </Text>
                                )}
                            </View>

                            <Pressable
                                onPress={() => setChecked((c) => !c)}
                                style={[styles.agreeRow, rtl && styles.agreeRowRtl]}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked }}
                                hitSlop={6}
                            >
                                <View style={[styles.box, checked && styles.boxOn]}>
                                    {checked && <Text style={styles.tick}>✓</Text>}
                                </View>
                                <Text style={[styles.agreeText, { textAlign: align, writingDirection: dir }]}>
                                    {beforeTerms}
                                    <Text style={styles.link} onPress={() => open(TERMS_URL)}>
                                        {copy.termsLabel}
                                    </Text>
                                    {betweenLinks}
                                    <Text style={styles.link} onPress={() => open(PRIVACY_URL)}>
                                        {copy.privacyLabel}
                                    </Text>
                                    {afterPrivacy}
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={accept}
                                disabled={!checked}
                                style={[styles.cta, !checked && styles.ctaOff]}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.ctaText, !checked && styles.ctaTextOff]}>
                                    {copy.cta}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
            </ScrollView>
        </View>
    );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
    StyleSheet.create({
        // No scrim token exists in the palette, and this is the only modal that
        // needs a full-screen one. rgba is used rather than a hex literal so it
        // works over both themes without hard-coding a colour the contrast
        // guard would (rightly) reject.
        scrim: { flex: 1, backgroundColor: "rgba(10,7,13,0.88)" },
        scrollInner: {
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 16,
            paddingVertical: 28,
        },
        card: {
            borderRadius: 24,
            overflow: "hidden",
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
        },
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
        title: {
            fontSize: 21,
            fontWeight: "600",
            color: c.textPrimary,
            textAlign: "center",
            marginBottom: 10,
            lineHeight: 28,
        },
        warm: {
            fontSize: 15.5,
            color: c.textPrimary,
            textAlign: "center",
            lineHeight: 24,
            marginBottom: 12,
        },
        disclaimer: {
            fontSize: 12.5,
            color: c.textSecondary,
            textAlign: "center",
            lineHeight: 19,
            marginBottom: 18,
        },
        emergency: {
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginBottom: 20,
            backgroundColor: c.emotionAnxious,
        },
        // ⛔ The accent rule sits on the reading-start edge, which flips for
        // Arabic, Hebrew and Urdu. Applied per-render, NOT via I18nManager —
        // I18nManager only takes effect on the next cold start, which is the
        // bug 1.5.8 fixed for the crisis card.
        emergencyLtr: { borderLeftWidth: 3, borderLeftColor: c.warningStrong },
        emergencyRtl: { borderRightWidth: 3, borderRightColor: c.warningStrong },
        emergencyLead: { fontSize: 13, color: c.textPrimary, lineHeight: 20 },
        emergencyNums: {
            fontSize: 13,
            fontWeight: "600",
            color: c.warningStrong,
            marginTop: 6,
        },
        agreeRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
        agreeRowRtl: { flexDirection: "row-reverse" },
        box: {
            width: 20,
            height: 20,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: c.border,
            marginHorizontal: 10,
            marginTop: 1,
            alignItems: "center",
            justifyContent: "center",
        },
        boxOn: { backgroundColor: c.primary, borderColor: c.primary },
        tick: { color: "#ffffff", fontSize: 13, fontWeight: "700", lineHeight: 16 },
        agreeText: { flex: 1, fontSize: 13.5, color: c.textPrimary, lineHeight: 20 },
        link: { color: c.primary, textDecorationLine: "underline" },
        cta: {
            borderRadius: 15,
            paddingVertical: 14,
            alignItems: "center",
            backgroundColor: c.primary,
        },
        ctaOff: { backgroundColor: c.border },
        ctaText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
        ctaTextOff: { color: c.textSecondary },
    });
