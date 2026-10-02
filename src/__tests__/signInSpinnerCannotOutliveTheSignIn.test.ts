/**
 * The sign-in spinner stops when the user is signed in — not when a promise says so.
 *
 * 🔴 WHY THIS EXISTS — observed on a device, not theorised. On 2026-10-02 the
 * onboarding sheet sat on **"Signing in…"** for over five minutes while the user
 * was, in fact, already signed in. Force-quitting and relaunching came up fully
 * authenticated, with history synced from the server.
 *
 * The logcat is unambiguous:
 *     12:21:56  CustomTabActivity -> supabase OAuth
 *     12:22:01  MainActivity resumed  (the redirect came back)
 *     12:22:02  the session was written to SecureStore
 *     (…then nothing at all for five minutes, spinner still turning)
 *
 * On Android the OAuth redirect arrives as a system deep-link intent, so
 * `WebBrowser.openAuthSessionAsync` resolves as `dismiss` — or never settles.
 * The old handler was:
 *
 *     try { await signInWithGoogle(); await handleDismiss(); }
 *     finally { setSigningInGoogle(false); }
 *
 * If that promise never settled, `handleDismiss()` never ran AND `finally` never
 * fired. **The spinner outlived the thing it was waiting for.**
 *
 * 🔑 `UpgradeSheet` already guarded against exactly this, by subscribing to
 * `onAuthStateChange` before opening OAuth. The knowledge was in the codebase;
 * it had simply never reached this component.
 *
 * ⚠️ Why it matters more than it looks: a user stuck here concludes sign-in is
 * broken, and the only cure they can discover is force-quitting the app — which
 * nobody thinks to do. Sign-in is on the protected surface.
 *
 * ⚠️ SOURCE TEST ON PURPOSE. Rendering this needs the auth provider, Supabase,
 * AsyncStorage and an Animated harness. What must hold is a property of the
 * code — "dismissal is driven by auth state, not by the promise" — and asserting
 * it on the source states it without a fragile harness.
 */
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "auth", "SignInPrompt.tsx"), "utf8",
);
/** The comments quote the very pattern being pinned — strip them first. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("🔴 the spinner is owned by auth state, not by the OAuth promise", () => {
    it("dismisses when status becomes authenticated", () => {
        expect(CODE).toMatch(/status\s*!==\s*"authenticated"/);
        const i = CODE.indexOf('status !== "authenticated"');
        expect(CODE.slice(i, i + 300)).toMatch(/handleDismiss\(\)/);
    });

    it("🔴 that effect is driven by BOTH signingIn and status", () => {
        // Keyed on only one of them, it either never fires or fires forever.
        const i = CODE.indexOf('status !== "authenticated"');
        expect(CODE.slice(i, i + 400)).toMatch(/\[signingIn,\s*status\]/);
    });

    it("🔴 the handler no longer clears the spinner in `finally`", () => {
        // This is the actual bug. `finally` never runs if the promise never
        // settles, which is precisely the Android case.
        const i = CODE.indexOf("const handleGoogle");
        const handler = CODE.slice(i, i + 500);
        expect(handler).toContain("signInWithGoogle()");
        expect(handler).not.toMatch(/finally\s*\{/);
    });

    it("🔑 dismissal does NOT hang off the awaited promise any more", () => {
        // The old shape was `await signInWithGoogle(); await handleDismiss();`
        expect(CODE).not.toMatch(/await signInWithGoogle\(\);\s*await handleDismiss\(\)/);
        expect(CODE).not.toMatch(/await signInWithApple\(\);\s*await handleDismiss\(\)/);
    });

    it("a real rejection still stops the spinner", () => {
        // Failing silently with a frozen spinner is the same bug by another route.
        const i = CODE.indexOf("const handleGoogle");
        expect(CODE.slice(i, i + 500)).toMatch(/catch\s*\{[\s\S]{0,80}setSigningInGoogle\(false\)/);
    });

    it("⚠️ a last-resort timeout exists, and is generous", () => {
        // If nothing ever arrives the spinner must still stop — but cutting a
        // slow OAuth round-trip short would turn a slow success into a visible
        // failure, so the bound is deliberately long.
        expect(CODE).toMatch(/setTimeout\([\s\S]{0,160}?\}, 90_000\)/);
        const i = CODE.indexOf("90_000");
        const before = CODE.slice(Math.max(0, i - 400), i);
        expect(before).toMatch(/setSigningInGoogle\(false\)/);
        expect(before).toMatch(/setSigningInApple\(false\)/);
    });

    it("🔑 the timeout is cleared on unmount — no setState after teardown", () => {
        const i = CODE.indexOf("90_000");
        expect(CODE.slice(i, i + 200)).toMatch(/clearTimeout\(t\)/);
    });

    it("both providers are covered, not just Google", () => {
        const i = CODE.indexOf("const handleApple");
        expect(CODE.slice(i, i + 400)).toMatch(/catch\s*\{[\s\S]{0,80}setSigningInApple\(false\)/);
    });
});
