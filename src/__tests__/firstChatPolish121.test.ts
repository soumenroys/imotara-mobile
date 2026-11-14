/**
 * #121 (11 Nov 2026) — two first-chat polish items.
 * a) the header dot is amber only when a message is REALLY behind, not for the
 *    normal few seconds before sync.
 * b) the follow-up chips and the mood card follow the conversation's language;
 *    the English mood sentence underneath (which feeds replies) is untouched.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { syncDotState, SYNC_BEHIND_AFTER_MS } from "../lib/chat/syncDot";
import { chatSurfaceLang, moodGlimpseDisplay, moodKeyOf, MOOD_GLIMPSE } from "../lib/chat/moodGlimpseText";

const screen = readFileSync(join(__dirname, "../screens/ChatScreen.tsx"), "utf8");
const NOW = 1_800_000_000_000;

describe("a) the dot", () => {
  it("a just-sent message waiting for the normal sync is NOT a warning", () => {
    expect(syncDotState([{ isSynced: false, timestamp: NOW - 8_000 }], null, NOW)).toBe("ok");
  });
  it("a message stuck past the normal delay IS", () => {
    expect(syncDotState([{ isSynced: false, timestamp: NOW - SYNC_BEHIND_AFTER_MS - 1 }], null, NOW)).toBe("behind");
  });
  it("a failed sync still shows red", () => {
    expect(syncDotState([], "Sync failed: network", NOW)).toBe("failed");
  });
  it("the header uses it", () => {
    expect(screen).toMatch(/backgroundColor: syncDot === "behind"\s*\? "#fbbf24"/);
  });
});

const EN = {
  stuck: "You sound a bit stuck or unsure. It's okay to take time to untangle things.",
  low: "You seem a bit low. It's okay to feel this way — Imotara is here with you.",
  tense: "It sounds like something is making you feel tense or worried.",
  upset: "It sounds like something has really upset or frustrated you.",
  joy: "I can sense some joy or lightness in what you're sharing.",
  hope: "I can sense a little bit of light or hope in what you're saying.",
  listen: "I'm listening closely. However you're feeling, it matters here.",
};

describe("b) the conversation's language", () => {
  it("the chosen language wins; 'auto' falls to the script of the message; else English", () => {
    expect(chatSurfaceLang("hi", "bn")).toBe("hi");
    expect(chatSurfaceLang("auto", "bn")).toBe("bn");
    expect(chatSurfaceLang(undefined, "en")).toBe("en");
    expect(chatSurfaceLang(null, null)).toBe("en");
  });
  it("every English mood sentence is recognised", () => {
    for (const [k, s] of Object.entries(EN)) expect(moodKeyOf(s)).toBe(k);
  });
  it("21 languages translate all 7 sentences and the title; the name goes in", () => {
    expect(Object.keys(MOOD_GLIMPSE)).toHaveLength(21);
    for (const lang of Object.keys(MOOD_GLIMPSE)) {
      for (const s of Object.values(EN)) {
        const d = moodGlimpseDisplay(s, lang, "Imotara");
        expect(d.text).not.toBe(s);
        expect(d.label).not.toBe("Mood glimpse");
        expect(d.text).not.toMatch(/undefined|\$\{/);
      }
      expect(moodGlimpseDisplay(EN.low, lang, "Tara").text).toContain("Tara");
    }
  });
  it("English, an unknown language or an unknown sentence ⇒ shown exactly as before", () => {
    expect(moodGlimpseDisplay(EN.joy, "en", "Imotara")).toEqual({ label: "Mood glimpse", text: EN.joy });
    expect(moodGlimpseDisplay(EN.joy, "xx", "Imotara").text).toBe(EN.joy);
    expect(moodGlimpseDisplay("Something new", "bn", "Imotara").text).toBe("Something new");
  });
  it("⛔ display only: the reply path still gets the English sentence", () => {
    expect(screen).toMatch(/return getLocalMoodHint\(latestUserMessage\.text, effectiveCompanionName\);/);
    expect(screen).toMatch(/moodGlimpseDisplay\(latestMoodHint, chatSurface, effectiveCompanionName\)\.text/);
  });
  it("chips use the conversation's language, never concreteLang('auto')", () => {
    expect(screen).toMatch(/SENTIMENT_SEEDS_BY_LANG\[chatSurface\]/);
    expect(screen).not.toMatch(/SENTIMENT_SEEDS_BY_LANG\[concreteLang/);
  });
});
