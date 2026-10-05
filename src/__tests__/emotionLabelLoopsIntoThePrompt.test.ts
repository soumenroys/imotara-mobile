/**
 * 🔴 The mobile emotion label is NOT display-only. It loops back into the
 * reply prompt, and this test exists so nobody discovers that the hard way.
 *
 * It LOOKS like a UI value: aiClient resolves it AFTER the reply has already
 * arrived, purely so the chat bubble does not default to "neutral". Reading
 * that code alone, widening the emotion maps looks completely safe.
 *
 * It is not. The full chain, verified 2026-10-05:
 *
 *   1. aiClient.ts           localFallbackEmotion resolves the label
 *   2. ChatScreen.tsx:4217   `emotion: finalEmotion` is stored ON THE HISTORY ITEM
 *   3. ChatScreen.tsx:3757   buildEmotionMemorySummary(history) reads those labels
 *   4. ChatScreen.tsx:3786   the summary is folded into `emotionMemory`
 *   5.                       `emotionMemory` is POSTed to /api/chat-reply
 *   6. imotaraapp route:1105 becomes `emotionMemoryHint`
 *   7. imotaraapp route:3454 is spliced into the SYSTEM PROMPT
 *
 * ⇒ Changing WHICH messages get an emotion label changes the "Dominant
 * emotions over ..." line the model is given, which changes replies. So the
 * mobile emotion maps sit on the PROTECTED SURFACE and may only be widened
 * with the full language × gender matrix, per the owner's standing ruling:
 * "at any cost the reply quality and user experience should not be degraded.
 * time is not critical, quality is."
 *
 * ⚠️ NOTE THE ASYMMETRY. The server-side ANALYTICS label (imotaraapp's
 * src/lib/emotion/analyticsEmotion.ts, for the EDU/NGO mindset trend) is
 * deliberately a different value that never enters the prompt, which is why it
 * could be fixed and extended to all 22 languages immediately. Do not conflate
 * the two: one is safe to change, this one is not.
 *
 * This test pins the LINKS IN THE CHAIN, not the emotion vocabulary. It should
 * keep passing when the maps are eventually widened — and start failing if
 * someone removes the loop (making the label genuinely display-only), which
 * would be good news, but must be a deliberate, stated change rather than an
 * accident.
 */

import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const CHAT_SCREEN = read("src/screens/ChatScreen.tsx");
const AI_CLIENT   = read("src/api/aiClient.ts");
const MEMORY      = read("src/state/companionMemory.ts");

describe("the emotion label is stored on history items", () => {
  it("ChatScreen attaches a resolved emotion to the item it saves", () => {
    expect(CHAT_SCREEN).toMatch(/emotion:\s*finalEmotion/);
  });

  it("aiClient still resolves a local fallback label", () => {
    expect(AI_CLIENT).toContain("localFallbackEmotion");
  });
});

describe("those stored labels are summarised and sent to the server", () => {
  it("companionMemory builds its summary FROM the stored emotion field", () => {
    // If this stops reading h.emotion, the loop is broken and the header of
    // this file is out of date.
    expect(MEMORY).toMatch(/h\.emotion/);
  });

  it("it only summarises non-neutral labels, so adding labels changes the summary", () => {
    // This is precisely why widening the maps is a reply change: a message that
    // used to contribute nothing starts contributing a dominant emotion.
    expect(MEMORY).toMatch(/h\.emotion\s*!==\s*["']neutral["']/);
  });

  it("ChatScreen calls buildEmotionMemorySummary and folds it into emotionMemory", () => {
    expect(CHAT_SCREEN).toContain("buildEmotionMemorySummary");
    expect(CHAT_SCREEN).toMatch(/const\s+emotionMemory\s*=/);
  });

  it("emotionMemory is passed to the cloud call, not kept local", () => {
    // Guards the one link that would otherwise be easy to drop silently.
    expect(AI_CLIENT).toMatch(/emotionMemory/);
  });
});

describe("the warning is kept where someone widening the maps will see it", () => {
  it("aiClient's hint derivation says the value reaches the prompt", () => {
    // A comment is the only thing that reaches a developer BEFORE they edit.
    // If this disappears, the trap becomes invisible again.
    expect(AI_CLIENT).toMatch(/emotionHint|emotion hint/i);
  });
});
