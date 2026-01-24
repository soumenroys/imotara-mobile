// src/lib/imotara/mobileAI.ts
//
// Unified AI entry point for mobile.
// DO NOT import ChatScreen logic here.
// DO NOT modify ChatScreen until this layer is stable.

import { callImotaraAI } from "../../api/aiClient";

export type MobileAIResult = {
    replyText: string;
    moodHint?: string;
    source: "remote" | "local-fallback";

    // structured fields from backend
    followUp?: string;
    reflectionSeed?: any; // typed later, preserved now
};

/** lightweight local fallback (existing behaviour) */
function localFallback(userText: string, insightsEnabled: boolean): MobileAIResult {
    const lower = userText.toLowerCase();

    const sadWords = ["sad", "down", "lonely", "tired", "upset", "hurt"];
    const anxiousWords = ["worry", "worried", "anxious", "scared", "panic"];
    const angryWords = ["angry", "mad", "frustrated", "annoyed", "irritated"];
    const hopefulWords = ["hope", "excited", "looking forward", "grateful"];

    let moodHint = undefined;

    if (insightsEnabled) {
        if (sadWords.some((w) => lower.includes(w))) {
            moodHint = "It sounds like you're feeling low.";
        } else if (anxiousWords.some((w) => lower.includes(w))) {
            moodHint = "It sounds like something is worrying you.";
        } else if (angryWords.some((w) => lower.includes(w))) {
            moodHint = "It sounds like something has really upset you.";
        } else if (hopefulWords.some((w) => lower.includes(w))) {
            moodHint = "I can hear a bit of hope or excitement in this.";
        }
    }

    return {
        replyText:
            "I hear you. In the full version I respond with deeper empathy and insight. This preview uses a local fallback.",
        moodHint,
        source: "local-fallback",
    };
}

/** Main AI entry */
export async function runMobileAI(
    userText: string,
    insightsEnabled: boolean
): Promise<MobileAIResult> {
    try {
        const remote = await callImotaraAI(userText);

        // ✅ Canonical response alignment (Baby Step 7.1)
        // Backend returns: { message, followUp?, reflectionSeed?, meta? }
        // Mobile expects: replyText
        const message =
            typeof (remote as any)?.message === "string"
                ? String((remote as any).message)
                : typeof (remote as any)?.replyText === "string"
                    ? String((remote as any).replyText)
                    : "";

        if (remote.ok && message.trim().length > 0) {
            return {
                replyText: message,
                moodHint: undefined,
                source: "remote",

                followUp:
                    typeof (remote as any)?.followUp === "string"
                        ? (remote as any).followUp
                        : undefined,

                reflectionSeed:
                    (remote as any)?.reflectionSeed ?? undefined,
            };
        }

        return localFallback(userText, insightsEnabled);
    } catch {
        return localFallback(userText, insightsEnabled);
    }
}
