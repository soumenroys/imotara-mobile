// The settings search has two halves that live in different repos.
//
// Local keyword matching runs against src/data/settingsCatalog.ts here. But any
// query of three or more words skips the local result and asks the server
// (/api/settings-search in the web repo), which prompts the LLM with its OWN
// hand-maintained list and answers with ids. SettingsSearch then resolves those
// ids back through THIS catalog and silently drops anything it cannot find.
//
// So a setting added here but not there is invisible to AI search: type its
// exact title and you get some other setting back, with no error anywhere.
// That is how "Send voice notes automatically" and "Organization membership"
// were both unreachable — found by searching for the former on a simulator,
// not by any test.
//
// The web repo is a sibling checkout, so this skips (loudly) when it is absent
// rather than failing a mobile-only clone.

import fs from "fs";
import path from "path";

const ROUTE = path.resolve(
    __dirname, "..", "..", "..", "imotaraapp",
    "src", "app", "api", "settings-search", "route.ts",
);

const catalogSrc = fs.readFileSync(
    path.join(__dirname, "..", "data", "settingsCatalog.ts"), "utf8");
const mobileIds = [...catalogSrc.matchAll(/^\s*id: "([^"]+)",$/gm)].map((m) => m[1]);

describe("settings catalog / server list", () => {
    it("parses a plausible number of mobile ids", () => {
        expect(mobileIds.length).toBeGreaterThan(30);
        expect(new Set(mobileIds).size).toBe(mobileIds.length); // no duplicate ids
    });

    const maybe = fs.existsSync(ROUTE) ? it : it.skip;

    maybe("every mobile setting is one the AI search can return", () => {
        const routeSrc = fs.readFileSync(ROUTE, "utf8");
        const serverIds = new Set([...routeSrc.matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1]));
        expect(serverIds.size).toBeGreaterThan(30);
        const unreachable = mobileIds.filter((id) => !serverIds.has(id));
        expect(unreachable).toEqual([]);
    });

    maybe("the server never returns an id this catalog cannot resolve", () => {
        const routeSrc = fs.readFileSync(ROUTE, "utf8");
        const serverIds = [...routeSrc.matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1]);
        const orphans = serverIds.filter((id) => !mobileIds.includes(id));
        expect(orphans).toEqual([]);
    });
});

if (!fs.existsSync(ROUTE)) {
    // eslint-disable-next-line no-console
    console.warn("[settingsCatalogServerSync] web repo not found at " + ROUTE + " — drift checks skipped");
}
