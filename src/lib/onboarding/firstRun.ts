// src/lib/onboarding/firstRun.ts
// FIRST OPEN = STRAIGHT TO THE CHAT (owner, 7 Nov 2026 — #97a, option A).
//
// 🔑 WHY: a new phone user went welcome → a 2-step setup ("What's your name?",
// "Who should Imotara be to you?") → a 3-step questionnaire → and only then the
// message box — five steps, and the setup and questions were English only for
// people who chose Bengali or Hindi. Day-1 return was 3.7%. The web had the
// same leak (#91). Now: welcome → chat, with the starters that already exist in
// 22 languages.
//
// The setup is not lost: on first open the app applies exactly what "Skip
// setup" always applied, and offers the setup ONCE on a later open — only after
// a first real conversation (the same signal as the check-in invite) and only
// if the person has not already set a name or style in Settings, so it can
// never overwrite a choice they made.

import type { OnboardingResult } from "../../components/imotara/OnboardingModal";

/** What "Skip setup" has always applied — now what a first open applies. */
export const FIRST_OPEN_RESULT: OnboardingResult = { name: "", relationship: "prefer_not", analysisMode: "cloud" };

/** Stored in the onboarding key after a first open that skipped the setup. */
export const DEFERRED = "deferred";

export function shouldOfferDeferredSetup(args: {
    onboardingValue: string | null;
    /** checkInInvite state — anything but "unseen" means a first real conversation happened. */
    inviteState: string;
    /** Raw JSON of imotara_settings_v1, or null. */
    storedSettings: string | null;
}): boolean {
    if (args.onboardingValue !== DEFERRED) return false;
    if (args.inviteState === "unseen") return false;
    try {
        const s = args.storedSettings ? JSON.parse(args.storedSettings) : {};
        const name = String(s?.toneContext?.user?.name ?? "").trim();
        const rel = s?.toneContext?.companion?.relationship;
        // ⛔ Already personalised in Settings ⇒ never overwrite it.
        if (name) return false;
        if (rel && rel !== "prefer_not") return false;
        return true;
    } catch {
        return false;
    }
}
