// src/lib/imotara/mobileAI.ts
//
// Unified AI entry point for mobile.
// DO NOT import ChatScreen logic here.

import { callImotaraAI } from "../../api/aiClient";
import type { ToneContextPayload } from "../../api/aiClient";
import { buildLocalReply, type LocalRecentContext } from "../ai/local/localReplyEngine";

export type MobileAIResult = {
    replyText: string;
    moodHint?: string;
    source: "remote" | "local-fallback";
    followUp?: string;
    reflectionSeed?: any;
};

function localFallback(
    userText: string,
    toneContext?: ToneContextPayload,
    recentContext?: LocalRecentContext
): MobileAIResult {
    const result = buildLocalReply(userText, toneContext, recentContext);
    return {
        replyText: result.message,
        moodHint: undefined,
        source: "local-fallback",
        reflectionSeed: result.reflectionSeed,
    };
}

export async function runMobileAI(
    userText: string,
    insightsEnabled: boolean,
    toneContext?: ToneContextPayload,
    recentContext?: LocalRecentContext
): Promise<MobileAIResult> {
    try {
        const remote = await callImotaraAI(userText, toneContext ? { toneContext } : undefined);

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
                reflectionSeed: (remote as any)?.reflectionSeed ?? undefined,
            };
        }

        return localFallback(userText, toneContext, recentContext);
    } catch {
        return localFallback(userText, toneContext, recentContext);
    }
}
