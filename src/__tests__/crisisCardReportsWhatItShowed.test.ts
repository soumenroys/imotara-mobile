/**
 * #105 (8 Nov 2026): /api/safety/crisis-shown existed and NOTHING called it —
 * every phone crisis_events row had card_shown / tier / resources_country null.
 * These pin: the report names exactly the lines the card draws, in the language
 * whose copy it renders, once per fresh card, with the reply's Bearer token —
 * and ChatScreen actually sends it.
 */
import { readFileSync } from "fs";
import { join } from "path";

jest.mock("../config/api", () => ({ buildApiUrl: (p: string) => `https://www.imotara.com${p}` }));

import {
  buildCrisisShownReport,
  crisisCardsToReport,
  renderedCardLang,
  sendCrisisShownReport,
  FRESH_MS,
} from "../lib/safety/reportCrisisShown";
import { getCrisisResourcesForCountry, INTERNATIONAL_CRISIS_RESOURCES } from "../lib/safety/crisisResources";

const IN = getCrisisResourcesForCountry("IN");
const tierOf = (t: string) => (t.includes("T2") ? 2 : t.includes("T1") ? 1 : 0);
const NOW = 1_800_000_000_000;
const msg = (id: string, from: "user" | "bot", text: string, ago = 1000) => ({ id, from, text, timestamp: NOW - ago });

describe("the report names what the card drew", () => {
  it("tier 2 = emergency + the first two lines (as MessageBubble draws them)", () => {
    const r = buildCrisisShownReport({ tier: 2, lang: "bn", resources: IN })!;
    expect(r.resourceIds).toEqual([IN.emergency!.id, IN.primary[0].id, IN.primary[1].id]);
    expect(r).toMatchObject({ cardLang: "bn", tier: 2, resourcesCountry: "IN", platform: "mobile" });
  });

  it("tier 1 = the first primary line only", () => {
    expect(buildCrisisShownReport({ tier: 1, lang: "en", resources: IN })!.resourceIds).toEqual([IN.primary[0].id]);
  });

  it("international (no emergency entry) still reports its line, as ZZ", () => {
    const r = buildCrisisShownReport({ tier: 2, lang: "en", resources: INTERNATIONAL_CRISIS_RESOURCES })!;
    expect(r.resourcesCountry).toMatch(/^[A-Z]{2}$/);
    expect(r.resourceIds.length).toBeGreaterThan(0);
  });

  it("the language is the one whose copy rendered — an unknown one fell back to English", () => {
    expect(renderedCardLang("bn-IN")).toBe("bn");
    expect(renderedCardLang("xx")).toBe("en");
    expect(renderedCardLang(undefined)).toBe("en");
  });

  it("⛔ never message text", () => {
    const r = buildCrisisShownReport({ tier: 2, lang: "en", resources: IN })!;
    expect(Object.keys(r).sort()).toEqual(["cardLang", "platform", "resourceIds", "resourcesCountry", "tier"]);
  });
});

describe("which cards are reported", () => {
  it("a fresh bot reply after a crisis message — once", () => {
    const m = [msg("u1", "user", "T2"), msg("b1", "bot", "ok")];
    expect(crisisCardsToReport(m, 1, tierOf, NOW, new Set())).toEqual([{ messageId: "b1", tier: 2 }]);
    expect(crisisCardsToReport(m, 1, tierOf, NOW, new Set(["b1"]))).toEqual([]);
  });

  it("re-opened history (older than FRESH_MS) is not reported again", () => {
    const m = [msg("u1", "user", "T2", FRESH_MS + 5000), msg("b1", "bot", "ok", FRESH_MS + 4000)];
    expect(crisisCardsToReport(m, 1, tierOf, NOW, new Set())).toEqual([]);
  });

  it("'conservative' threshold: a tier-1 card is not drawn, so not reported", () => {
    const m = [msg("u1", "user", "T1"), msg("b1", "bot", "ok")];
    expect(crisisCardsToReport(m, 2, tierOf, NOW, new Set())).toEqual([]);
    expect(crisisCardsToReport(m, 1, tierOf, NOW, new Set())).toEqual([{ messageId: "b1", tier: 1 }]);
  });

  it("no crisis ⇒ nothing", () => {
    expect(crisisCardsToReport([msg("u1", "user", "hello"), msg("b1", "bot", "hi")], 1, tierOf, NOW, new Set())).toEqual([]);
  });
});

describe("sending", () => {
  it("POSTs to the live endpoint with the reply's Bearer token", () => {
    const f = jest.fn(async () => new Response("{}"));
    sendCrisisShownReport(buildCrisisShownReport({ tier: 2, lang: "hi", resources: IN })!, "jwt-1", f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://www.imotara.com/api/safety/crisis-shown");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-1");
    expect(JSON.parse(String(init.body))).toMatchObject({ cardLang: "hi", tier: 2, resourcesCountry: "IN" });
  });

  it("a network failure never throws", () => {
    const f = jest.fn(async () => { throw new Error("offline"); });
    expect(() => sendCrisisShownReport(buildCrisisShownReport({ tier: 1, lang: "en", resources: IN })!, undefined, f as unknown as typeof fetch)).not.toThrow();
  });

  it("ChatScreen sends it, with the same language rule and the reply's token", () => {
    const src = readFileSync(join(__dirname, "..", "screens/ChatScreen.tsx"), "utf8");
    const i = src.indexOf("crisisCardsToReport(messages");
    expect(i).toBeGreaterThan(-1);
    const block = src.slice(i, i + 1200);
    expect(block).toMatch(/crisisCardLangFor\(/);
    expect(block).toMatch(/getCrisisResourcesForCountry\(resolveCrisisCountry\(\)\)/);
    expect(block).toMatch(/sendCrisisShownReport\(report, guestAccessToken\)/);
  });
});
