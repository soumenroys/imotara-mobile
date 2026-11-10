/**
 * 🌿 #16 C (owner, 10 Nov 2026): "Welcome back. Last time we talked about:
 * <topic>." on the phone — the same card, words and rules as the web.
 * ⛔ Topic KEY only, from a closed list · never after a crisis · reply untouched.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("../config/api", () => ({ buildApiUrl: (p: string) => `https://www.imotara.com${p}` }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { SESSION_TOPICS, welcomeBackText, shouldShowWelcomeBack, WELCOME_BACK_AFTER_MS } from "../lib/welcome/welcomeBackTopic";
import { noteSession, readLastSession, shouldAskTopic, markDismissed, readDismissed } from "../lib/welcome/lastSession";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const okJson = (body: unknown) => jest.fn(async () => ({ json: async () => body }) as unknown as Response);

beforeEach(async () => { await AsyncStorage.clear(); });

describe("the same closed list and words as the web", () => {
  it("17 topics", () => expect(SESSION_TOPICS).toHaveLength(17));
  it("the card text", () => {
    expect(welcomeBackText("en", "sleep").lines).toEqual(["Welcome back.", "Last time we talked about: sleep.", "Want to pick up where we left off?"]);
    expect(welcomeBackText("bn", "work").lines[1]).toBe("গতবার আমরা কথা বলেছিলাম: কাজ।");
  });
  const webPath = join(__dirname, "../../../imotaraapp/src/lib/imotara/welcomeBackTopic.ts");
  (existsSync(webPath) ? it : it.skip)("identical to the web file from SESSION_TOPICS down (when imotaraapp sits beside this repo)", () => {
    const body = (t: string) => t.slice(t.indexOf("export const SESSION_TOPICS"));
    expect(body(src("lib/welcome/welcomeBackTopic.ts"))).toBe(body(readFileSync(webPath, "utf8")));
  });
});

describe("what the phone keeps and when it asks", () => {
  it("asks at the 2nd message and every 4th after; never after a crisis", () => {
    expect([1, 2, 3, 4, 5, 6, 10].map((n) => shouldAskTopic(n, false))).toEqual([false, true, false, false, false, true, true]);
    expect(shouldAskTopic(2, true)).toBe(false);
  });
  it("keeps a topic KEY, never words; the server's answer must be from the list", async () => {
    const f = okJson({ topic: "sleep" });
    await noteSession({ threadId: "t1", userTexts: ["can't sleep", "awake at 3am"], crisis: false, lang: "en", fetchImpl: f as unknown as typeof fetch });
    const s = await readLastSession();
    expect(s).toMatchObject({ threadId: "t1", topic: "sleep", userMessages: 2, crisis: false, lang: "en" });
    expect(JSON.stringify(s)).not.toMatch(/sleep\b.*awake|can't/);
    const bad = okJson({ topic: "your awful boss" });
    await noteSession({ threadId: "t2", userTexts: ["a", "b"], crisis: false, fetchImpl: bad as unknown as typeof fetch });
    expect((await readLastSession())?.topic).toBeNull();
  });
  it("⛔ a crisis: saved as crisis, server never asked, no card", async () => {
    const f = okJson({ topic: "worry" });
    await noteSession({ threadId: "t3", userTexts: ["x", "y"], crisis: true, fetchImpl: f as unknown as typeof fetch });
    expect(f).not.toHaveBeenCalled();
    const s = await readLastSession();
    expect(s?.crisis).toBe(true);
    expect(shouldShowWelcomeBack(s ? { ...s, at: Date.now() - WELCOME_BACK_AFTER_MS - 1 } : null, Date.now(), null)).toBe(false);
  });
  it("dismissed once ⇒ not again for that conversation", async () => {
    const s = { threadId: "t4", topic: null, at: Date.now() - WELCOME_BACK_AFTER_MS - 1, userMessages: 3, crisis: false };
    await markDismissed(s);
    expect(shouldShowWelcomeBack(s, Date.now(), await readDismissed())).toBe(false);
  });
});

describe("wired in the chat screen — beside the reply, never in it", () => {
  const screen = src("screens/ChatScreen.tsx");
  it("noted after a reply, with the whole conversation's crisis check", () => {
    expect(screen).toMatch(/void noteSession\(\{\s*threadId: activeThreadId,\s*userTexts,\s*crisis: userTexts\.some\(\(t\) => detectMobileCrisisTier\(t\) > 0\)/);
  });
  it("decided once on arrival; Pick up / Start fresh", () => {
    expect(screen).toMatch(/if \(alive && shouldShowWelcomeBack\(last, Date\.now\(\), dismissed\)\) setWelcomeBack\(last\);/);
    expect(screen).toMatch(/startNewThread\(\); close\(\);/);
  });
});
