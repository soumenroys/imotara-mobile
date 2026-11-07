// src/__tests__/returningLine.test.ts
// #77c (owner, 7 Nov 2026): someone coming back is greeted with how they were
// last time, in their language — before, the phone said it in English only.
// The table itself is byte-identical to the web's (checked by the web test).
import { readFileSync } from "fs";
import { join } from "path";
import { isSadText, isStressText, isCrisisTier2, BN_ANGER_REGEX } from "../lib/emotion/keywordMaps";
import { returningFeeling, returningLine, RETURNING_LINES, type FeelingDetectors } from "../lib/welcome/returningLine";

// The real on-device detectors (ChatScreen adds tier-1 crisis + more anger languages on top).
const real: FeelingDetectors = {
  isCrisis: (t) => isCrisisTier2(t),
  isSad: (t) => isSadText(t),
  isStressed: (t) => isStressText(t),
  isAngry: (t) => BN_ANGER_REGEX.test(t),
};

describe("real messages ⇒ the right line, in the right language", () => {
  it("Bengali, low ⇒ the Bengali 'low' line", () => {
    const f = returningFeeling(["আমার মন খারাপ লাগছে"], real);
    expect(f).toBe("sad");
    expect(returningLine(f, "auto", "bn")).toBe(RETURNING_LINES.bn.sad);
  });
  it("Hindi, stressed ⇒ the Hindi 'worry' line", () => {
    const f = returningFeeling(["मुझे बहुत चिंता हो रही है"], real);
    expect(f).toBe("stressed");
    expect(returningLine(f, "hi")).toBe(RETURNING_LINES.hi.stressed);
  });
  it("⛔ English crisis words ⇒ the crisis line, never a feeling", () => {
    const f = returningFeeling(["I feel sad", "I want to end my life"], real);
    expect(f).toBe("crisis");
    expect(returningLine(f, "en")).toBe("I'm glad you're back. How are you doing right now?");
  });
});

describe("ChatScreen wiring", () => {
  const chat = readFileSync(join(__dirname, "../screens/ChatScreen.tsx"), "utf8");
  it("⛔ crisis = ANY tier (same tiers as the crisis card), never narrower", () => {
    expect(chat).toMatch(/isCrisis: \(t\) => detectMobileCrisisTier\(t\) > 0,/);
  });
  it("English keeps the topic lines; a crisis overrides them", () => {
    expect(chat).toMatch(/if \(feeling !== "crisis" && lang === "en" && p\.englishTopicLine\) \{/);
  });
  it("both returning spots use it (the greeting message and the banner)", () => {
    expect(chat.match(/mobileReturningLine\(\{/g)?.length).toBe(2);
    expect(chat).toMatch(/if \(r\.feeling !== "plain"\) setSessionGreeting\(r\.text\);/);
  });
  it("'Good evening.' is added only in English", () => {
    expect(chat).toMatch(/const prefix = lang === "en" && p\.englishPrefix \? `\$\{p\.englishPrefix\} ` : "";/);
  });
  it("the old English-only heavy banner line is gone", () => {
    expect(chat).not.toMatch(/Last time you were carrying something heavy/);
  });
});
