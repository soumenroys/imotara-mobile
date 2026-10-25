import fs from "fs";
import path from "path";

jest.mock("expo-store-review", () => ({
    isAvailableAsync: jest.fn(async () => true),
    requestReview: jest.fn(async () => undefined),
}));

const store: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(async (k: string) => store[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
}));

import * as StoreReview from "expo-store-review";
import { RATING_RULES, askForRating, getRatingState, shouldAskForRating } from "../feedback/ratingPrompt";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 25, 18, 0);
const base = {
    state: { firstUseAt: NOW - 10 * DAY, lastAskedAt: null },
    now: NOW,
    userMessageCount: 4,
    crisisInThread: false,
    inviteThisTurn: false,
};

describe("when Imotara may ask for a rating", () => {
    it("asks after a real conversation, days after first use", () => {
        expect(shouldAskForRating(base)).toBe(true);
    });

    it("⛔ never near distress", () => {
        expect(shouldAskForRating({ ...base, crisisInThread: true })).toBe(false);
    });

    it("⛔ never in the same turn as the check-in invite", () => {
        expect(shouldAskForRating({ ...base, inviteThisTurn: true })).toBe(false);
    });

    it("⛔ never after only a message or two", () => {
        expect(shouldAskForRating({ ...base, userMessageCount: RATING_RULES.minUserMessages - 1 })).toBe(false);
    });

    it("⛔ never in someone's first 3 days", () => {
        expect(shouldAskForRating({ ...base, state: { firstUseAt: NOW - 2 * DAY, lastAskedAt: null } })).toBe(false);
        expect(shouldAskForRating({ ...base, state: { firstUseAt: null, lastAskedAt: null } })).toBe(false);
    });

    it("⛔ at most once per 90 days", () => {
        expect(shouldAskForRating({ ...base, state: { firstUseAt: NOW - 200 * DAY, lastAskedAt: NOW - 89 * DAY } })).toBe(false);
        expect(shouldAskForRating({ ...base, state: { firstUseAt: NOW - 200 * DAY, lastAskedAt: NOW - 91 * DAY } })).toBe(true);
    });
});

describe("state and the store call", () => {
    beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; jest.clearAllMocks(); });

    it("the first look records first use — so a brand-new user is never asked that day", async () => {
        const s = await getRatingState(NOW);
        expect(s).toEqual({ firstUseAt: NOW, lastAskedAt: null });
        expect(shouldAskForRating({ ...base, state: s })).toBe(false);
    });

    it("asking records the time and calls the OS sheet", async () => {
        await getRatingState(NOW - 10 * DAY);
        expect(await askForRating(NOW)).toBe(true);
        expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
        expect((await getRatingState(NOW)).lastAskedAt).toBe(NOW);
    });

    it("does nothing where the store sheet is unavailable", async () => {
        (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
        expect(await askForRating(NOW)).toBe(false);
        expect(StoreReview.requestReview).not.toHaveBeenCalled();
    });
});

describe("ChatScreen asks only at a safe moment", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "screens", "ChatScreen.tsx"), "utf8");
    const block = src.slice(src.indexOf("// ⭐ The rating prompt"), src.indexOf("const extraMessages: ChatMessage[] = [];", src.indexOf("// ⭐ The rating prompt")));

    it("only when no card is trailing this reply, no quota card, and not hands-free", () => {
        expect(block).toMatch(/if \(!cloudQuotaHit && trailing\.length === 0 && !handsfreeRef\.current\)/);
    });

    it("checks the whole conversation for distress", () => {
        expect(block).toMatch(/crisisInThread: userTexts\.some\(\(t\) => detectMobileCrisisTier\(t\) > 0\)/);
    });

    it("asks seconds AFTER the reply, and re-checks mounted / hands-free / foreground then", () => {
        expect(block).toMatch(/setTimeout\(\(\) => \{\s*if \(mountedRef\.current && !handsfreeRef\.current && AppState\.currentState === "active"\) void askForRating\(\);\s*\}, 6000\)/);
    });

    it("comes after the check-in invite decision, so the invite always wins the turn", () => {
        expect(src.indexOf("// ⭐ The rating prompt")).toBeGreaterThan(src.indexOf("const offer = shouldOfferInvite({"));
    });
});
