// The settings search sends you to a section: handleSearchSelect opens the
// accordion named by an entry's sectionKey and scrolls to it. If that key does
// not match the accordion the setting actually renders inside, search opens the
// wrong section and the setting stays hidden in a collapsed one.
//
// Nothing links the catalog to the screen at compile time, so this test derives
// the truth from the screen itself: it paren-matches each `{sectionX && (`
// block to find its real line range, then checks every catalog entry whose
// title literally appears in the screen.

import fs from "fs";
import path from "path";

const SRC = path.join(__dirname, "..", "screens", "SettingsScreen.tsx");
const CATALOG = path.join(__dirname, "..", "data", "settingsCatalog.ts");

const screen = fs.readFileSync(SRC, "utf8");
const lines = screen.split("\n");
const catalogSrc = fs.readFileSync(CATALOG, "utf8");

// state variable -> the sectionKey handleSearchSelect maps it to
const STATE_TO_KEY: Record<string, string> = {
    sectionCompanion: "companion",
    sectionAppearance: "experience",
    sectionPrivacy: "privacy",
    sectionMindset: "mindset",
    sectionAdvancedMobile: "advanced",
    sectionSupport: "support",
};

function stripLiterals(line: string): string {
    return line.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, "");
}

/** Line range (1-based, inclusive) of each `{sectionX && ( ... )}` block. */
function accordionRanges(): Record<string, [number, number]> {
    const out: Record<string, [number, number]> = {};
    lines.forEach((line, idx) => {
        const m = /^\s*\{(section[A-Za-z]+) && \($/.exec(line);
        if (!m) return;
        let depth = 0;
        for (let i = idx; i < lines.length; i++) {
            for (const ch of stripLiterals(lines[i])) {
                if (ch === "(") depth++;
                else if (ch === ")") {
                    depth--;
                    if (depth === 0) {
                        out[m[1]] = [idx + 1, i + 1];
                        return;
                    }
                }
            }
        }
    });
    return out;
}

const ranges = accordionRanges();

type Entry = { id: string; title: string; sectionKey: string };
const entries: Entry[] = [
    ...catalogSrc.matchAll(
        /\{\s*id:\s*"([^"]+)",\s*title:\s*"([^"]+)",\s*section:\s*"[^"]+",\s*sectionKey:\s*"([^"]+)"/g,
    ),
].map((m) => ({ id: m[1], title: m[2], sectionKey: m[3] }));

describe("settings search mapping", () => {
    it("parses the screen and the catalog (guards against a vacuous pass)", () => {
        expect(Object.keys(ranges).length).toBeGreaterThanOrEqual(6);
        expect(entries.length).toBeGreaterThanOrEqual(30);
    });

    it("every catalog sectionKey is a section the screen can actually open", () => {
        const known = new Set(Object.values(STATE_TO_KEY).concat(["account"]));
        for (const e of entries) expect(known).toContain(e.sectionKey);
    });

    it("each locatable setting renders inside the section its catalog entry names", () => {
        const sectionOf = (line: number): string | null => {
            for (const [state, [s, end]] of Object.entries(ranges)) {
                // An AccordionHeader sits outside its own block, so a header line
                // legitimately belongs to no section — only inner lines count.
                if (line > s && line < end) return STATE_TO_KEY[state] ?? null;
            }
            return null;
        };

        const checked: string[] = [];
        for (const e of entries) {
            const hits: number[] = [];
            lines.forEach((l, i) => {
                if (l.includes(`>${e.title}<`)) hits.push(i + 1);
            });
            if (hits.length === 0) continue; // title is descriptive, not a literal label
            const actual = new Set(hits.map(sectionOf).filter(Boolean));
            if (actual.size === 0) continue;
            checked.push(e.id);
            expect({ id: e.id, section: e.sectionKey }).toEqual({
                id: e.id,
                section: [...actual][0],
            });
        }
        // If the matcher stops resolving anything, the test would pass while
        // checking nothing. Fail instead.
        expect(checked.length).toBeGreaterThanOrEqual(3);
    });
});
