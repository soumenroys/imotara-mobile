/**
 * refreshLicense() must never call supabase.auth.* from inside onAuthStateChange.
 *
 * 🔴 WHY THIS EXISTS — observed on a real Android build, 2026-10-03, not theorised.
 *
 * supabase-js serialises auth work behind an internal lock. Calling any
 * `supabase.auth.*` method from within an `onAuthStateChange` callback re-enters
 * that lock and hangs forever. The project has hit this before —
 * `ios_auth_lock_deadlock_2026_09_06`: "our own re-entrant onAuthStateChange
 * call, not supabase-js".
 *
 * The handler did `await refreshLicense()`, and refreshLicense opened with
 * `await supabase.auth.getSession()`. Instrumented probes caught it exactly:
 *
 *     [LICDBG] refreshLicense: start
 *     [LICDBG] refreshLicense: start
 *     (no "getSession returned" — ever)
 *
 * ⚠️ THE DAMAGE IS NOT ONE LOST REFRESH. The lock stays wedged, so every later
 * caller hangs on the same line — the AppState foreground re-read AND the
 * "Already purchased? Tap to check your plan" button. A paying user who signs in
 * sees **Free**, the remedy control does nothing, and only a cold restart
 * recovers. Same discoverability trap as `df5547a`.
 *
 * 🔑 WHAT MADE IT LOOK FINE: after a cold restart the tier reads correctly — but
 * that is the STALE AsyncStorage value (nothing clears it on sign-out), not a
 * successful fetch. The cache hid a totally dead code path.
 *
 * ⚠️ SOURCE TEST ON PURPOSE. Reproducing a lock deadlock needs a real
 * supabase-js, a real auth transition and a wall clock. What must hold is a
 * property of the code: the auth callback passes its session down instead of
 * asking for it again.
 */
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "state", "SettingsContext.tsx"), "utf8",
);
/** The comments quote the very pattern being pinned — strip them first. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** The body of the onAuthStateChange callback, which is the dangerous region. */
function authCallbackBody(): string {
    const i = CODE.indexOf("supabase.auth.onAuthStateChange");
    expect(i).toBeGreaterThan(-1);
    const j = CODE.indexOf("subscription.unsubscribe()", i);
    expect(j).toBeGreaterThan(i);
    return CODE.slice(i, j);
}

describe("🔴 the auth callback must not re-enter supabase's auth lock", () => {
    it("calls NO supabase.auth.* method inside onAuthStateChange", () => {
        const body = authCallbackBody();
        // getSession / getUser / refreshSession / setSession all take the lock.
        expect(body).not.toMatch(/supabase\.auth\.(getSession|getUser|refreshSession|setSession)\s*\(/);
    });

    it("🔑 passes its own session into refreshLicense instead", () => {
        const body = authCallbackBody();
        expect(body).toMatch(/refreshLicense\(\s*session\s*\)/);
        // ⛔ a bare refreshLicense() here is the bug: it would call getSession().
        expect(body).not.toMatch(/refreshLicense\(\s*\)/);
    });
});

describe("⚠️ refreshLicense still works when called normally", () => {
    it("accepts an optional session override", () => {
        expect(CODE).toMatch(/const refreshLicense = async \(\s*sessionOverride/);
    });

    it("falls back to getSession() when no override is given", () => {
        // Startup and AppState callers pass nothing and must still resolve a session.
        const i = CODE.indexOf("const refreshLicense = async (");
        const head = CODE.slice(i, i + 400);
        expect(head).toMatch(/sessionOverride\s*\?\?/);
        expect(head).toMatch(/supabase\.auth\.getSession\(\)/);
    });

    it("🔑 the override is USED, not merely accepted", () => {
        const i = CODE.indexOf("const refreshLicense = async (");
        const head = CODE.slice(i, i + 400);
        const use = head.indexOf("sessionOverride ??");
        const guard = head.indexOf("!session?.user?.id");
        expect(use).toBeGreaterThan(-1);
        expect(guard).toBeGreaterThan(use);
    });
});
