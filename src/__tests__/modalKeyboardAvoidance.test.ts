import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");

/**
 * React Native <Modal> renders in its OWN window. The ime() inset padding the
 * config plugin applies to the Activity content view
 * (plugins/withAndroidImeInsets.js) never reaches it, so a modal that holds a
 * text input MUST bring its own KeyboardAvoidingView or the field ends up
 * behind the keyboard.
 *
 * Both halves of that were measured on 2026-09-12, not assumed:
 *   OnboardingModal      "Continue" y=2650 and "Skip setup" y=2841 with the
 *                        keyboard top at y=1984 — unreachable, on the first
 *                        screen a new user ever sees.
 *   CompanionQuickPanel  "Companion name" focused at y=2699, keyboard top
 *                        y=1984 — typing into a field you cannot see. Its
 *                        ScrollView does not rescue it, because the scroll
 *                        viewport also extends behind the keyboard.
 *
 * There is no double-subtraction risk inside a modal, precisely because the
 * root inset fix does not apply to that window.
 */

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(p));
        else if (entry.name.endsWith(".tsx")) out.push(p);
    }
    return out;
}

/** Strip // and block comments so prose mentioning a tag is not parsed as JSX. */
function stripComments(s: string): string {
    return s
        .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
}

type ModalBlock = { file: string; line: number; body: string };

/** Every top-level <Modal>…</Modal> block in the tree. */
function findModals(): ModalBlock[] {
    const blocks: ModalBlock[] = [];
    for (const file of walk(SRC)) {
        const raw = fs.readFileSync(file, "utf8");
        const s = stripComments(raw);
        const toks: { pos: number; open: boolean }[] = [];
        for (const m of s.matchAll(/<Modal[\s>]/g)) toks.push({ pos: m.index!, open: true });
        for (const m of s.matchAll(/<\/Modal>/g)) toks.push({ pos: m.index!, open: false });
        toks.sort((a, b) => a.pos - b.pos);
        let depth = 0;
        let start: number | null = null;
        for (const t of toks) {
            if (t.open) {
                if (depth === 0) start = t.pos;
                depth++;
            } else {
                depth--;
                if (depth === 0 && start !== null) {
                    blocks.push({
                        file: path.relative(ROOT, file),
                        line: s.slice(0, start).split("\n").length,
                        body: s.slice(start, t.pos),
                    });
                    start = null;
                }
            }
        }
    }
    return blocks;
}

/** Components that contain a TextInput anywhere — a modal may render one. */
function componentsWithInputs(): Set<string> {
    const set = new Set<string>();
    for (const file of walk(SRC)) {
        if (fs.readFileSync(file, "utf8").includes("<TextInput")) {
            set.add(path.basename(file, ".tsx"));
        }
    }
    return set;
}

describe("every modal that can hold a text input avoids the keyboard", () => {
    const modals = findModals();
    const withInputs = componentsWithInputs();

    it("finds the modals at all (guards against the scan silently matching nothing)", () => {
        expect(modals.length).toBeGreaterThan(8);
    });

    it("no modal containing a text input is left without keyboard avoidance", () => {
        const offenders: string[] = [];
        for (const m of modals) {
            const direct = m.body.includes("<TextInput");
            const viaChild = [...m.body.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)].some(
                (c) => withInputs.has(c[1])
            );
            if (!direct && !viaChild) continue;
            if (!m.body.includes("KeyboardAvoidingView")) {
                offenders.push(`${m.file}:${m.line} has an input but no KeyboardAvoidingView`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it("those modals give Android \"height\", never undefined", () => {
        // "undefined" on Android means no avoidance at all — the exact defect
        // measured in OnboardingModal.
        const offenders: string[] = [];
        for (const m of modals) {
            if (!m.body.includes("KeyboardAvoidingView")) continue;
            for (const b of m.body.match(/behavior=\{[^}]*\}/g) ?? []) {
                if (/:\s*undefined\s*\}/.test(b)) {
                    offenders.push(`${m.file}:${m.line} -> ${b}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});

describe("the specific modals measured broken on 2026-09-12", () => {
    const cases: [string, string][] = [
        ["src/components/imotara/OnboardingModal.tsx", "Continue/Skip were behind the keyboard"],
        ["src/components/imotara/CompanionQuickPanel.tsx", "companion-name field was behind the keyboard"],
        ["src/screens/connect/ConnectScreen.tsx", "review sheet comment field"],
    ];

    it.each(cases)("%s has Android height behavior (%s)", (file) => {
        const src = fs.readFileSync(path.join(ROOT, file), "utf8");
        expect(src).toContain("KeyboardAvoidingView");
        expect(src).toMatch(/behavior=\{Platform\.OS === "ios" \? "padding" : "height"\}/);
    });

    it("OnboardingModal specifically no longer passes undefined on Android", () => {
        const src = fs.readFileSync(
            path.join(ROOT, "src/components/imotara/OnboardingModal.tsx"),
            "utf8"
        );
        expect(src).not.toMatch(
            /behavior=\{Platform\.OS === "ios" \? "padding" : undefined\}/
        );
    });

    it("CompanionQuickPanel imports what its new wrapper needs", () => {
        const src = fs.readFileSync(
            path.join(ROOT, "src/components/imotara/CompanionQuickPanel.tsx"),
            "utf8"
        );
        expect(src).toMatch(/KeyboardAvoidingView/);
        expect(src).toMatch(/\bPlatform\b/);
        // balanced, or the screen would not render
        expect((src.match(/<KeyboardAvoidingView/g) ?? []).length).toBe(
            (src.match(/<\/KeyboardAvoidingView>/g) ?? []).length
        );
    });
});
