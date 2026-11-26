// src/components/age/AgeSignalTeenSync.tsx
//
// #159 — when the store says the person is 13–17, their profile age becomes
// "13_17": replies take the teen tone and Connect (adults only) stays shut.
//
// ⚠️ Waits for saved settings to load. Writing before that would be overwritten
// by the load a moment later and the teen band would silently not apply.
// ⚠️ Re-applies if the age is changed away while the store still says teen —
// the store's answer is the one the law points at.

import { useEffect } from "react";
import { useSettings } from "../../state/SettingsContext";
import { useAgeVerdict } from "./AgeSignalGate";

export const TEEN_AGE = "13_17" as const;

export default function AgeSignalTeenSync() {
    const verdict = useAgeVerdict();
    const { settingsHydrated, toneContext, setToneContext } = useSettings();
    const current = toneContext?.user?.ageRange;
    const currentTone = toneContext?.user?.ageTone;

    useEffect(() => {
        if (verdict !== "teen" || !settingsHydrated) return;
        if (current === TEEN_AGE && currentTone === TEEN_AGE) return;
        setToneContext({
            ...(toneContext || {}),
            user: { ...(toneContext?.user || {}), ageRange: TEEN_AGE, ageTone: TEEN_AGE },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verdict, settingsHydrated, current, currentTone]);

    return null;
}
