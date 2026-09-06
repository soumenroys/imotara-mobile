// The relationship a companion has drives two things that live far apart:
// the chips in Settings, and the chat backdrop's hue table. There is nothing
// linking them at compile time, so adding a tenth relationship to the picker
// would silently give it no backdrop, and renaming one would leave the
// backdrop row calling it by a name the user never saw.
//
// This derives the picker's real list from the screen and checks both.

import fs from "fs";
import path from "path";
import { RELATIONSHIP_HUES } from "../theme/chatBackdrop";

const src = fs.readFileSync(
    path.join(__dirname, "..", "screens", "SettingsScreen.tsx"), "utf8");

/** The chips the relationship picker actually renders. */
const picker = (() => {
    const start = src.indexOf('{ id: "prefer_not", label: "Prefer not to specify" }');
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("] as const", start);
    expect(end).toBeGreaterThan(start);
    return [...src.slice(start, end).matchAll(/\{ id: "([a-z_]+)", label: "([^"]+)" \}/g)]
        .map((m) => ({ id: m[1], label: m[2] }));
})();

/** The RELATIONSHIP_LABELS map the chat-backdrop row reads. */
const labels = (() => {
    const start = src.indexOf("const RELATIONSHIP_LABELS: Record<string, string> = {");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("};", start);
    return Object.fromEntries(
        [...src.slice(start, end).matchAll(/^\s{4}([a-z_]+): "([^"]+)",$/gm)]
            .map((m) => [m[1], m[2]]));
})();

describe("relationship options stay in step", () => {
    it("the picker has the nine options this app has always offered", () => {
        expect(picker.length).toBe(9);
        expect(picker[0].id).toBe("prefer_not");
    });

    it("every option the picker offers has a chat backdrop entry", () => {
        for (const { id } of picker) {
            expect(Object.keys(RELATIONSHIP_HUES)).toContain(id);
        }
    });

    it("the backdrop table invents no relationship the picker does not offer", () => {
        const ids = picker.map((p) => p.id);
        for (const id of Object.keys(RELATIONSHIP_HUES)) expect(ids).toContain(id);
    });

    it("every option has a label for the chat-backdrop row", () => {
        for (const { id } of picker) expect(labels[id]).toBeTruthy();
    });

    it("those labels match what the picker chip says", () => {
        for (const { id, label } of picker) {
            // The chips carry a parenthetical hint ("Sibling (younger/peer
            // vibe)") that would read badly mid-sentence, so the label map
            // holds the bare name — but it must still be the same name.
            expect(label.startsWith(labels[id])).toBe(true);
        }
    });

    it("only prefer_not is left without a colour", () => {
        const uncoloured = Object.entries(RELATIONSHIP_HUES)
            .filter(([, hue]) => hue == null).map(([id]) => id);
        expect(uncoloured).toEqual(["prefer_not"]);
    });
});
