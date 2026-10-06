/**
 * D2 — a session-less device must not claim a paid plan, and must not lose
 * history to a tier it never actually learned.
 *
 * 🔴 THE DEFECT. The cached tier outlived the session: after signing out, the
 * header capsule and Settings both still read "Plus". The cache was not wrong,
 * it was simply no longer anybody's.
 *
 * 🔑 THE DESIGN, settled 2026-10-05 after an attempt was deliberately reverted:
 * three stages, in a fixed order, and the order is not a preference.
 *
 *   1. Display      — stop showing a tier that belongs to nobody
 *   2. Retention    — never prune off a DEFAULT tier
 *   3. Entitlement  — downgrade gate() only on a definitive SIGNED_OUT
 *
 * ⛔ STAGE 3 MUST NOT LAND BEFORE STAGE 2. If the effective tier becomes FREE
 * on sign-out while the retention effect still prunes on an unconfirmed tier,
 * a signed-OUT user's local history is pruned to seven days — and synced items
 * are only recoverable from a server they cannot reach. That is permanent data
 * loss, verified by reading the effect, not theorised.
 *
 * This file pins stages 1 and 2. Stage 3 is NOT implemented yet; the last
 * describe block asserts that it has not been slipped in early.
 */

import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

const CTX = () => strip(read("src/state/HistoryContext.tsx"));
const CHAT = () => strip(read("src/screens/ChatScreen.tsx"));
const SETTINGS = () => strip(read("src/screens/SettingsScreen.tsx"));

describe("stage 1 — display never claims a plan for a signed-out device", () => {
  it("derives displayLicenseTier from auth STATUS, not from a missing token", () => {
    // ⛔ `!accessToken` would make a paying user see the signed-out state flash
    // on every cold start, because the token is briefly null while the session
    // hydrates. The three-state `status` is the signal that already exists.
    const s = CTX();
    expect(s).toMatch(/const\s+displayLicenseTier/);
    expect(s).toMatch(/status\s*===\s*"unauthenticated"\s*\?\s*"FREE"\s*:\s*licenseTier/);
  });

  it("keeps showing the cached tier while the session is still loading", () => {
    // Only "unauthenticated" forces FREE; "loading" falls through to the cache.
    const s = CTX();
    const i = s.indexOf("displayLicenseTier");
    expect(s.slice(i, i + 200)).not.toContain('"loading"');
  });

  it("is exposed ONCE from the context, not recomputed per screen", () => {
    // Three copies of one rule is the anti-pattern licenseTierStore exists to
    // end. The screens read a value; they do not re-derive it.
    expect(CTX()).toContain("displayLicenseTier,");
    expect(CHAT()).not.toMatch(/status\s*===\s*"unauthenticated"/);
    expect(SETTINGS()).not.toMatch(/status\s*===\s*"unauthenticated"/);
  });

  it("the chat header capsule renders the DISPLAY tier — BOTH reads", () => {
    // ⚠️ Two reads in the capsule: the visible label and the accessibility
    // label. Asserting only one let a mutation revert the visible text while
    // the test still passed. Assert the count.
    const s = CHAT();
    expect((s.match(/prettyTier\(displayLicenseTier\)/g) ?? []).length).toBe(2);
    expect(s).not.toMatch(/prettyTier\(licenseTier\)/);
  });

  it("the Settings plan label renders the DISPLAY tier", () => {
    expect(SETTINGS()).toContain("prettyTier(displayLicenseTier)");
  });
});

describe("stage 2 — history is never pruned off a default tier", () => {
  it("tracks whether the tier was positively confirmed", () => {
    expect(CTX()).toMatch(/const\s+\[tierConfirmed,\s*setTierConfirmed\]/);
  });

  it("the pruning effect refuses to run until it is confirmed", () => {
    const s = CTX();
    const i = s.indexOf('gate("HISTORY_DAYS_LIMIT"');
    expect(i).toBeGreaterThan(-1);
    // The guard sits above the gate() call, inside the same effect.
    expect(s.slice(Math.max(0, i - 420), i)).toMatch(/if\s*\(!tierConfirmed\)\s*return;/);
  });

  it("re-runs when confirmation arrives", () => {
    expect(CTX()).toMatch(/\[hydrated,\s*effectiveLicenseTier,\s*tierConfirmed\]/);
  });

  it("a server answer confirms it", () => {
    // subscribeLicenseTier is fed by SettingsContext.refreshLicense(), i.e. a
    // real /api/license/status answer — including an answer of FREE.
    // ⚠️ Anchor on the SUBSCRIPTION CALL. The first "subscribeLicenseTier" in
    // the file is the import line — four separate assertions today have
    // matched an import, a comment or a type instead of the code.
    const s = CTX();
    const i = s.indexOf("useEffect(() => subscribeLicenseTier(");
    expect(i).toBeGreaterThan(-1);
    expect(s.slice(i, i + 320)).toContain("setTierConfirmed(true)");
  });

  it("⛔ hydrating the AsyncStorage cache does NOT confirm it", () => {
    // The cache is a previously-true value. Acting on it is exactly how the
    // 2026-10-02 bug pruned a Plus user's history to the free window.
    // ⚠️ Anchor on the hydration BRANCH, not the destructuring list above it.
    const s = CTX();
    const i = s.indexOf("if (rawTier) {");
    expect(i).toBeGreaterThan(-1);
    const hydration = s.slice(i, i + 220);
    expect(hydration).toContain("_setLicenseTier");
    expect(hydration).not.toContain("setTierConfirmed");
  });
});

describe("stage 3 — entitlement, and the hazard it would otherwise create", () => {
  it("gate() sees FREE once auth is definitively unauthenticated", () => {
    const s = CTX();
    expect(s).toMatch(/const\s+effectiveLicenseTier[\s\S]{0,120}status\s*===\s*"unauthenticated"\s*\?\s*"FREE"/);
  });

  it("every consumer gets the EFFECTIVE tier, not the raw one", () => {
    // One value, all readers — the whole point of fixing it in this file.
    expect(CTX()).toContain("licenseTier: effectiveLicenseTier,");
  });

  it("the retention effect gates on the EFFECTIVE tier", () => {
    expect(CTX()).toContain('gate("HISTORY_DAYS_LIMIT", effectiveLicenseTier)');
  });

  it("🔴 signing out CLEARS confirmation — the hazard this whole order exists for", () => {
    // ⛔ THE BUG STAGE 3 WOULD OTHERWISE HAVE SHIPPED. tierConfirmed was set on
    // a server answer and never cleared, so a user who signed in and then
    // signed out still carried it as true. The instant the effective tier
    // became FREE, the retention effect would have pruned a SIGNED-OUT user's
    // history to seven days — and synced items are only recoverable from a
    // server they can no longer reach. Confirmation must be per-SESSION.
    const s = CTX();
    expect(s).toMatch(/if\s*\(status\s*===\s*"unauthenticated"\)\s*setTierConfirmed\(false\)/);
  });

  it("⇒ a signed-out device can never prune: FREE tier, but unconfirmed", () => {
    // The two halves that make stage 3 safe, asserted together so neither can
    // be removed on its own.
    const s = CTX();
    expect(s).toMatch(/setTierConfirmed\(false\)/);          // sign-out clears it
    expect(s).toMatch(/if\s*\(!tierConfirmed\)\s*return;/); // and pruning requires it
  });

  it("keyed on status, never on a missing token", () => {
    // Revoking a paying user's features for a frame on every cold start would
    // be a worse bug than the one being fixed.
    const s = CTX();
    const i = s.indexOf("const effectiveLicenseTier");
    expect(s.slice(i, i + 160)).not.toContain("accessToken");
  });
});
