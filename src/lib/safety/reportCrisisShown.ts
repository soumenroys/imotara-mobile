// src/lib/safety/reportCrisisShown.ts
//
// Tells the server WHAT THE PERSON SAW when a crisis card appeared under a
// reply: its language, its tier, the country whose helplines it offered and
// exactly which lines. ⛔ Never message text.
//
// 🔴 8 Nov 2026 (#105): /api/safety/crisis-shown existed from the start and
// nothing called it — every crisis_events row from the phone had card_shown,
// tier and resources_country = null, so the admin Crisis screen could not say
// whether the right country's helpline was offered. The web half went live the
// same day (imotaraapp 42e5bcf).
//
// 🔑 Sent with the SAME Bearer token the chat reply used, so the server finds
// the episode chat-reply logged and fills it in, instead of a second row.

import { buildApiUrl } from "../../config/api";
import type { CountryCrisisResources } from "./crisisResources";
import { CRISIS_COPY_LANGS } from "./crisisCopy";

export type CrisisShownReport = {
    cardLang: string;
    tier: 1 | 2;
    resourcesCountry: string;
    resourceIds: string[];
    platform: "mobile";
};

/** The language whose copy the card actually rendered (getCrisisCopy falls back to English). */
export function renderedCardLang(lang: string | null | undefined): string {
    const base = String(lang ?? "en").toLowerCase().split(/[-_]/)[0];
    return CRISIS_COPY_LANGS.includes(base) ? base : "en";
}

/**
 * Exactly the lines the card draws — kept in step with MessageBubble:
 * tier 1 = the first primary line; tier 2 = emergency (if any) + the first two.
 */
export function buildCrisisShownReport(args: {
    tier: number;
    lang: string | null | undefined;
    resources: CountryCrisisResources;
}): CrisisShownReport | null {
    if (args.tier !== 1 && args.tier !== 2) return null;
    const ids =
        args.tier === 1
            ? args.resources.primary.slice(0, 1).map((r) => r.id)
            : [
                  ...(args.resources.emergency ? [args.resources.emergency.id] : []),
                  ...args.resources.primary.slice(0, 2).map((r) => r.id),
              ];
    return {
        cardLang: renderedCardLang(args.lang),
        tier: args.tier,
        resourcesCountry: args.resources.countryCode,
        resourceIds: ids,
        platform: "mobile",
    };
}

type Msg = { id: string; from: "user" | "bot"; text: string; timestamp: number };

/** A card older than this is history being re-displayed, not a card being shown now. */
export const FRESH_MS = 15 * 60 * 1000;

/**
 * Which bot replies carry a crisis card that has not been reported yet — the
 * same rule the bubble renders by: the message before it is the person's, and
 * its tier reaches the person's threshold. Only fresh ones: re-opening the app
 * re-draws old cards, and those were reported when they first appeared.
 */
export function crisisCardsToReport(
    messages: Msg[],
    minTier: number,
    tierOf: (text: string) => number,
    now: number,
    reported: ReadonlySet<string>,
): { messageId: string; tier: 1 | 2 }[] {
    const out: { messageId: string; tier: 1 | 2 }[] = [];
    for (let i = 1; i < messages.length; i++) {
        const m = messages[i];
        const prev = messages[i - 1];
        if (m.from !== "bot" || prev.from !== "user") continue;
        if (reported.has(m.id)) continue;
        if (now - m.timestamp > FRESH_MS) continue;
        const tier = tierOf(prev.text);
        if (tier < 1 || tier < minTier) continue;
        out.push({ messageId: m.id, tier: tier >= 2 ? 2 : 1 });
    }
    return out;
}

/** Fire-and-forget. A logging failure must never reach the person's screen. */
export function sendCrisisShownReport(
    report: CrisisShownReport,
    accessToken: string | undefined,
    fetchImpl: typeof fetch = fetch,
): void {
    try {
        void fetchImpl(buildApiUrl("/api/safety/crisis-shown"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify(report),
        }).catch(() => { /* never surface */ });
    } catch {
        /* never surface */
    }
}
