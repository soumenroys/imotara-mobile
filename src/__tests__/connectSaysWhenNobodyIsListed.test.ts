/**
 * #108 (owner, 8 Nov 2026): Connect has 0 companions. The app said "No companions
 * online right now. Check back soon." and offered nowhere to go. It now matches the
 * web: say so plainly, open the chat, or join as a companion.
 * 🔴 Also: filters are applied ON THE SERVER, so an empty FILTERED result replaced
 * the whole screen (filter bar included) — no way to undo the filter. Now it says
 * "No companions match this filter" with a Clear filters button.
 */
import { readFileSync } from "fs";
import { join } from "path";

const SRC = readFileSync(join(__dirname, "..", "screens/connect/ConnectScreen.tsx"), "utf8");
const block = () => {
    const i = SRC.indexOf("if (consultants.length === 0) return (");
    return SRC.slice(i, i + 4000);
};

describe("Connect with nobody listed (app)", () => {
    it("says so honestly, with the chat and the companion sign-up", () => {
        const b = block();
        expect(b).toContain("No companions are available right now.");
        expect(b).toMatch(/onPress=\{onOpenChat\}/);
        expect(b).toMatch(/onPress=\{onRegister\}/);
        expect(b).not.toMatch(/\bAI\b/);
    });

    it("the buttons are wired: chat tab and the register view", () => {
        expect(SRC).toMatch(/onOpenChat=\{\(\) => navigation\.navigate\("Chat"\)\}/);
        expect(SRC).toMatch(/onRegister=\{\(\) => setView\(\{ name: "register" \}\)\}\s*\/>\}/);
    });

    it("🔴 an empty FILTERED result offers Clear filters instead of hiding the filters", () => {
        const b = block();
        const f = b.indexOf("(filterOnline || filterCategory || filterLang || filterGender) ?");
        const h = b.indexOf("No companions are available right now.");
        expect(f).toBeGreaterThan(-1);
        expect(f).toBeLessThan(h); // the filter case is decided first
        expect(b).toContain("Clear filters");
        expect(b).toMatch(/setFilterOnline\(false\); setFilterCategory\(""\); setFilterLang\(""\); setFilterGender\(""\);/);
    });

    it("a failed load still says so and offers Retry (unchanged)", () => {
        expect(block()).toContain("Could not load companions.");
    });
});
