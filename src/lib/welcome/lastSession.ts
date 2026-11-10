// src/lib/welcome/lastSession.ts
// What the phone keeps about the last conversation for the "Welcome back" card
// ⇒ welcomeBackTopic.ts (#16 C). ⛔ Never any words — a topic KEY, a time, a count.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildApiUrl } from "../../config/api";
import { isSessionTopic, type LastSession, type SessionTopic } from "./welcomeBackTopic";

export const WELCOME_BACK_LAST_KEY = "imotara.welcomeBack.last.v1";
export const WELCOME_BACK_DISMISSED_KEY = "imotara.welcomeBack.dismissed.v1";

/** The phone also remembers which language the card should speak. */
export type PhoneLastSession = LastSession & { lang?: string };

export async function readLastSession(): Promise<PhoneLastSession | null> {
    try {
        const raw = await AsyncStorage.getItem(WELCOME_BACK_LAST_KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<PhoneLastSession>;
        if (typeof v.threadId !== "string" || typeof v.at !== "number") return null;
        return {
            threadId: v.threadId, at: v.at, crisis: Boolean(v.crisis),
            userMessages: typeof v.userMessages === "number" ? v.userMessages : 0,
            topic: isSessionTopic(v.topic) ? v.topic : null,
            lang: typeof v.lang === "string" ? v.lang : undefined,
        };
    } catch {
        return null;
    }
}

export async function writeLastSession(s: PhoneLastSession): Promise<void> {
    try { await AsyncStorage.setItem(WELCOME_BACK_LAST_KEY, JSON.stringify(s)); } catch { /* best effort */ }
}

export async function readDismissed(): Promise<string | null> {
    try { return await AsyncStorage.getItem(WELCOME_BACK_DISMISSED_KEY); } catch { return null; }
}

export async function markDismissed(s: LastSession): Promise<void> {
    try { await AsyncStorage.setItem(WELCOME_BACK_DISMISSED_KEY, `${s.threadId}:${s.at}`); } catch { /* best effort */ }
}

/** Ask at the 2nd message and every 4th after — enough to follow a changing conversation, cheap. */
export function shouldAskTopic(userMessages: number, crisis: boolean): boolean {
    return !crisis && userMessages >= 2 && (userMessages === 2 || userMessages % 4 === 2);
}

/**
 * Remember this conversation; ask the server for its topic when due.
 * ⛔ A crisis signal ⇒ saved as crisis (no card, ever) and the server is never asked.
 * ⛔ Never throws, never delays a reply.
 */
export async function noteSession(args: {
    threadId: string;
    userTexts: string[];
    crisis: boolean;
    lang?: string;
    fetchImpl?: typeof fetch;
}): Promise<void> {
    try {
        const prev = await readLastSession();
        const keep = prev && prev.threadId === args.threadId && !args.crisis ? prev.topic : null;
        const saved: PhoneLastSession = {
            threadId: args.threadId, topic: keep, at: Date.now(),
            userMessages: args.userTexts.length, crisis: args.crisis, lang: args.lang,
        };
        await writeLastSession(saved);
        if (!shouldAskTopic(args.userTexts.length, args.crisis)) return;
        const res = await (args.fetchImpl ?? fetch)(buildApiUrl("/api/session-topic"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: args.userTexts.slice(-6) }),
        });
        const j = (await res.json()) as { topic?: unknown };
        const now = await readLastSession();
        if (now && now.threadId === args.threadId && !now.crisis && isSessionTopic(j?.topic)) {
            await writeLastSession({ ...now, topic: j.topic as SessionTopic });
        }
    } catch { /* never let this touch the conversation */ }
}
