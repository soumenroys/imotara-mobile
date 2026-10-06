/**
 * The main screen shows the plan, and offers sign in / sign out.
 *
 * 🔴 Requested 2026-10-01 to mirror what web gained the same night
 * (imotaraapp c35f0c9 / 8581d29): the licence type and an auth control,
 * visible from the screen people actually use.
 *
 * Two constraints shaped it, and both are the point of this file:
 *
 *  1. The chat header caps its button row at THREE — there is a comment saying
 *     so, because a fourth overflows on narrow phones. The plan is therefore a
 *     compact TEXT badge outside that row, not a fourth bordered pill.
 *
 *  2. 🔴 NEITHER AUTH PATH IS INVENTED HERE. "Sign in" NAVIGATES to Settings,
 *     where the existing affordance lives. It must NOT call signInWithGoogle()
 *     directly: on iOS, offering a third-party sign-in obliges you to offer
 *     Sign in with Apple as well (see `appleSignInAvailable` in
 *     auth/SignInPrompt.tsx), so a Google-only button bolted onto this screen
 *     would be an App Store compliance problem as well as a fourth copy of
 *     something that should exist once.
 *
 *     The web half of this same night is the cautionary tale: the header's
 *     Sign in was pointed at /login, which turned out to be the ORGANISATION
 *     email+password form, and ordinary users hit a login they could not use.
 *     Fixed in imotaraapp f074149. Reuse the path, do not re-create it.
 *
 * ⚠️ Deliberately a SOURCE test. Rendering ChatScreen needs navigation, auth,
 * settings, audio and a dozen providers; what must hold is a property of the
 * code, and asserting it on the source states it without a fragile harness.
 */
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "screens", "ChatScreen.tsx"),
    "utf8",
);

/** Comments here quote the very patterns being pinned — strip them first. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * ⚠️ UPDATED 2026-10-06 (D2 stage 1). The badge now renders
 * `prettyTier(displayLicenseTier)` rather than `prettyTier(licenseTier)`.
 *
 * The three properties this file pins are UNCHANGED and all still asserted:
 * one tier→label function, the badge outside the capped three-button row, and
 * navigation to Settings rather than an inline sign-in. Only the ARGUMENT
 * changed: after signing out, the cached paid tier was still being displayed,
 * so a session-less device claimed Plus. `displayLicenseTier` is FREE once auth
 * is definitively "unauthenticated", and identical to licenseTier otherwise.
 *
 * ⛔ Entitlement is deliberately NOT affected — gate() still reads
 * licenseTier. See entitlementSurvivesSignOut.test.ts.
 */
const BADGE = "prettyTier(displayLicenseTier)";


describe("🔑 the chat header shows the current plan", () => {
    it("renders the tier with prettyTier — no second tier→label map", () => {
        expect(CODE).toContain(BADGE);
        expect(CODE).toMatch(/prettyTier/);
    });

    it("🔴 is NOT a fourth item inside the capped buttons row", () => {
        // The badge must sit BEFORE the row whose comment caps it at 3.
        const badge = CODE.indexOf(BADGE);
        const buttonsRow = CODE.indexOf('flexShrink: 0, gap: 6');
        expect(badge).toBeGreaterThan(-1);
        expect(buttonsRow).toBeGreaterThan(-1);
        expect(badge).toBeLessThan(buttonsRow);
    });

    it("is tappable and goes to Settings, where the plan is managed", () => {
        const badge = CODE.slice(CODE.indexOf(BADGE) - 700);
        expect(badge.slice(0, 900)).toMatch(/navigation\.navigate\("Settings"\)/);
    });
});

describe("🔴 sign in / sign out, without inventing a third auth path", () => {
    it("offers BOTH states", () => {
        expect(CODE).toMatch(/"Sign out"/);
        expect(CODE).toMatch(/"Sign in"/);
    });

    it("🔴 Sign in NAVIGATES — it never calls signInWithGoogle here", () => {
        // On iOS a third-party sign-in obliges Sign in with Apple too. The
        // complete flow already exists; this screen must not grow a partial one.
        expect(CODE).not.toMatch(/signInWithGoogle/);
        expect(CODE).not.toMatch(/signInWithApple/);
    });

    it("sign-out asks first, and says what happens to local data", () => {
        // Signing out is destructive-feeling even though conversations stay on
        // the device — saying so is what stops it feeling like data loss.
        const row = CODE.slice(CODE.indexOf('accessibilityLabel={user ? "Sign out"'));
        const before = CODE.slice(Math.max(0, CODE.indexOf('accessibilityLabel={user ? "Sign out"') - 1400));
        expect(before).toMatch(/Alert\.alert\(\s*\n?\s*"Sign out\?"/);
        expect(before).toMatch(/stay on this device/);
        expect(row.length).toBeGreaterThan(0);
    });

    it("🔑 closes the menu before acting", () => {
        // Leaving the modal open over an Alert, or over the Settings screen it
        // just pushed, strands the user behind a scrim.
        const idx = CODE.indexOf('accessibilityLabel={user ? "Sign out"');
        const before = CODE.slice(Math.max(0, idx - 1400), idx);
        expect(before).toMatch(/setShowHeaderMenu\(false\)/);
    });
});
