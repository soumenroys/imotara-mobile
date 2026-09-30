/**
 * The tier lives at `license.tier`. Never read it off the response root.
 *
 * 🔴 WHY THIS EXISTS. `/api/license/status` returns:
 *
 *     { ok, mode, license: { status, tier, mode, source, expiresAt }, org, user }
 *
 * There is NO top-level `tier`. Reading `data.tier` yields undefined, and every
 * consumer coerces that to "free" — the one value that looks plausible, so the
 * mistake degrades silently instead of throwing.
 *
 * It shipped twice, in both repos, and cost real money to find:
 *
 *  • WEB — `settings/page.tsx` did `normaliseTier(lic?.tier)`. That plan card
 *    could not display anything but FREE for ANY user, ever. Invisible while
 *    enforcement was off; on 2026-09-30 it showed a subscriber with three paid
 *    ₹149 invoices the free plan, minutes after LICENSE_MODE went to `enforce`,
 *    and sent us chasing cookies, sessions and re-fetch timing for hours. The
 *    endpoint had been returning `tier: "plus"` correctly the whole time.
 *    Fixed in imotaraapp 474772f.
 *
 *  • MOBILE — `UpgradeSheet.pollLicenseStatus()` did `data?.tier`. It could
 *    never return true. That poll is the catch-block safety net for a failed
 *    Play verification: at that point the user HAS PAID, Google has the money,
 *    and the webhook grants the licence server-side. The poll exists to notice
 *    that. Instead every such user was told "Verification pending — tap Restore
 *    purchases to activate", moments after paying. Reachable in production from
 *    2026-09-30, when the Play products were activated.
 *
 * 🔑 The reads further down UpgradeSheet.tsx were already correct
 * (`data?.license?.tier ?? …`). One missed site is all it takes.
 */
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "components", "imotara", "UpgradeSheet.tsx"),
    "utf8",
);

/** Strip comments — the prose below explains the bug and names the bad pattern. */
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("🔴 tier is read from license.tier, never from the response root", () => {
    it("the post-purchase poll reads license.tier", () => {
        const poll = code.slice(code.indexOf("async function pollLicenseStatus"));
        const body = poll.slice(0, poll.indexOf("\n}"));
        expect(body).toMatch(/data\?\.license\?\.tier/);
    });

    it("🔴 no read of a bare `data.tier` survives anywhere in the file", () => {
        // `data?.license?.tier ?? data?.tier` is fine — the correct field is
        // tried first. What must never appear is the bare read on its own.
        const bare = code.match(/data\?\.tier/g) ?? [];
        const guarded = code.match(/data\?\.license\?\.tier \?\? data\?\.tier/g) ?? [];
        expect(bare.length).toBe(guarded.length);
    });

    it("🔑 the poll can actually succeed — it compares against a real tier", () => {
        // The whole failure was a comparison that could never be true. Pin that
        // the expected tier is still derived and still compared.
        const poll = code.slice(code.indexOf("async function pollLicenseStatus"));
        const body = poll.slice(0, poll.indexOf("\n}"));
        expect(body).toMatch(/expectedTier/);
        expect(body).toMatch(/tier === expectedTier/);
        expect(body).toMatch(/return true/);
    });
});
