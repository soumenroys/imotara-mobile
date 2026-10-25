// src/feedback/ratingPrompt.ts
// The "Rate Imotara" prompt — the OS's own review sheet, asked for rarely and
// never at a bad moment. Owner approved 25 Oct 2026 (growth plan: in-app rating
// prompt, which did not exist).
//
// ⛔ Never near distress: any crisis signal anywhere in the conversation keeps it
//    away, exactly like the check-in invite (checkInInvite.ts).
// ⛔ Never in someone's first days, never more than once per 90 days, never in the
//    same turn as the check-in invite — one ask per reply at most.
// 🔑 The OS has the last word: Apple shows the sheet at most 3 times a year and
//    Google applies its own quota, so requestReview() may show nothing. We record
//    the ASK, not the outcome, because neither store tells us whether it appeared.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const STATE_KEY = "imotara.rating.prompt.v1";
const DAY = 86_400_000;

export const RATING_RULES = {
    minDaysSinceFirstUse: 3,
    minDaysBetweenAsks: 90,
    minUserMessages: 3,
} as const;

export type RatingState = { firstUseAt: number | null; lastAskedAt: number | null };

export async function getRatingState(now = Date.now()): Promise<RatingState> {
    try {
        const raw = await AsyncStorage.getItem(STATE_KEY);
        const s = raw ? (JSON.parse(raw) as Partial<RatingState>) : {};
        const state: RatingState = {
            firstUseAt: typeof s.firstUseAt === "number" ? s.firstUseAt : null,
            lastAskedAt: typeof s.lastAskedAt === "number" ? s.lastAskedAt : null,
        };
        // The first time we look is the first use we can know about.
        if (state.firstUseAt === null) {
            state.firstUseAt = now;
            await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
        }
        return state;
    } catch {
        // Storage unavailable ⇒ behave as a brand-new user: never ask.
        return { firstUseAt: now, lastAskedAt: null };
    }
}

export function shouldAskForRating(args: {
    state: RatingState;
    now: number;
    userMessageCount: number;
    crisisInThread: boolean;
    inviteThisTurn: boolean;
}): boolean {
    const { state, now } = args;
    if (args.crisisInThread || args.inviteThisTurn) return false;
    if (args.userMessageCount < RATING_RULES.minUserMessages) return false;
    if (state.firstUseAt === null || now - state.firstUseAt < RATING_RULES.minDaysSinceFirstUse * DAY) return false;
    if (state.lastAskedAt !== null && now - state.lastAskedAt < RATING_RULES.minDaysBetweenAsks * DAY) return false;
    return true;
}

/** Ask the OS to show its review sheet, and remember that we asked. Never throws. */
export async function askForRating(now = Date.now()): Promise<boolean> {
    try {
        if (!(await StoreReview.isAvailableAsync())) return false;
        const state = await getRatingState(now);
        await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ ...state, lastAskedAt: now }));
        await StoreReview.requestReview();
        return true;
    } catch {
        return false;
    }
}
