// src/components/legal/ConsentGateMount.tsx
//
// Mounts the first-use acceptance gate on iOS and Android, and persists the
// acceptance server-side. Mirrors imotaraapp/src/components/legal/
// ConsentGateMount.tsx.
//
// Reads the stored language straight from AsyncStorage rather than through
// useSettings(), so the gate does not depend on the settings context being
// mounted or hydrated — it has to be able to render before anything else does.
//
// 🔴 IT RENDERS `children` ONLY ONCE ACCEPTED — it does not render ALONGSIDE the
// app. Found on a wiped Android emulator 2026-10-13: as a sibling <Modal> the
// gate was covered by SignInPrompt's own modal, because Android stacks modals by
// RUNTIME PRESENTATION ORDER, not React tree order. A person on a fresh install
// could reach sign-in and create an account without passing the gate at all.
//
// ⛔ A gate that renders BESIDE the app is not a gate. Making it structural —
// the app does not mount until consent is decided — is the only version that
// cannot be raced by another overlay.

import React, { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ConsentGate from "./ConsentGate";
import {
    TERMS_ACCEPTANCE_KEY,
    hasAcceptedCurrentTerms,
    parseAcceptance,
} from "../../lib/legal/termsVersion";
import { getOrCreateAnonId } from "../../lib/legal/anonId";
import type { TermsAcceptance } from "../../lib/legal/termsVersion";
import { IMOTARA_API_BASE_URL } from "../../config/api";

/** Same key SettingsContext persists to. */
const SETTINGS_STORAGE_KEY = "imotara_settings_v1";

export default function ConsentGateMount({ children }: { children: React.ReactNode }) {
    const [lang, setLang] = useState<string | undefined>(undefined);
    const [ready, setReady] = useState(false);
    // null = not yet known. The app must not mount while this is unresolved,
    // or it would flash for a frame before the gate appeared.
    const [accepted, setAccepted] = useState<boolean | null>(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) : null;
                const stored = parsed?.user?.preferredLang;
                // ⛔ "auto" is not a language. Passing it through would render
                // the gate in English for exactly the people it most needs to
                // reach — the same trap that put the crisis card in English
                // (trap_concretelang_turns_auto_into_en).
                if (alive && typeof stored === "string" && stored && stored !== "auto") {
                    setLang(stored);
                }
                const rec = await AsyncStorage.getItem(TERMS_ACCEPTANCE_KEY);
                if (alive) setAccepted(hasAcceptedCurrentTerms(parseAcceptance(rec)));
            } catch {
                // Fall through to undefined, which the gate renders as English.
                // ⛔ And treat the acceptance as NOT given: failing open here
                // would let a storage error skip the gate entirely.
                if (alive) setAccepted((a) => (a === null ? false : a));
            } finally {
                // ⚠️ Mount the gate only after the language read has settled.
                // Rendering first would flash an English screen at a Bengali
                // speaker for one frame, which is the exact failure this
                // feature is meant to avoid.
                if (alive) setReady(true);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    const persist = useCallback((record: TermsAcceptance) => {
        // Fire-and-forget: the person is already through. A failed write is
        // never surfaced to them and never blocks.
        void (async () => {
            try {
                const anonId = await getOrCreateAnonId();
                await fetch(`${IMOTARA_API_BASE_URL}/api/legal/accept`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        anonId,
                        locale: record.locale,
                        surface: record.surface,
                        acceptedAt: record.acceptedAt,
                    }),
                });
            } catch {
                // Offline on first open is entirely normal. The device record
                // stands; the server copy is best-effort.
            }
        })();
    }, []);

    // ⚠️ Render NOTHING until both the language and the acceptance are known.
    // Rendering the app first would flash it for a frame before the gate, and
    // rendering the gate first would flash English at a Bengali speaker.
    if (!ready || accepted === null) return null;

    if (accepted) return <>{children}</>;

    return (
        <ConsentGate
            lang={lang}
            surface={Platform.OS === "ios" ? "ios" : "android"}
            onAccepted={(record) => {
                persist(record);
                // Only now does the app mount.
                setAccepted(true);
            }}
        />
    );
}
