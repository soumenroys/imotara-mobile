/**
 * "Auto" exists so a DEFAULT stops outranking detection, while a real CHOICE
 * still does.
 *
 * preferredLang defaulted to "en" and SettingsContext persists toneContext on
 * every change, so every user ends up with "preferredLang":"en" stored whether
 * they picked it or not. The resolver put profile ahead of detection, so for
 * anyone who never opened the picker detection never ran and writing in
 * Bengali produced an English reply. Device-verified 2026-09-11: stored "en",
 * typed "ami khub valo nei tumi kemon acho", got English back.
 *
 * A stored "en" cannot be told apart from a chosen "en", so simply reversing
 * the precedence would have overridden people who really do want English.
 * "auto" makes the difference explicit.
 */
import fs from "fs";
import path from "path";
import { statedPreference, concreteLang, AUTO_LANG } from "../api/aiClient";

describe("statedPreference — only a real choice counts", () => {
    it.each([undefined, null, "", "   ", "auto", "AUTO", " Auto "])(
        "%s is not a stated preference", (v) => {
            expect(statedPreference(v as string | undefined)).toBeUndefined();
        });
    it.each(["en", "bn", "hi", "ta", "ur"])("%s is a stated preference", (v) => {
        expect(statedPreference(v)).toBe(v);
    });
    it("keeps an explicit English, so it still beats detection", () => {
        expect(statedPreference("en")).toBe("en");
    });
});

describe("concreteLang — auto must never reach a voice or a locale", () => {
    it.each([undefined, "", "auto"])("%s resolves to en", (v) => {
        expect(concreteLang(v as string | undefined)).toBe("en");
    });
    it("passes a real language through untouched", () => {
        expect(concreteLang("bn")).toBe("bn");
    });
    it("is used everywhere that needs a real language", () => {
        // A raw `preferredLang ?? "en"` does NOT catch "auto" — it is not
        // null — so any site still written that way would feed "auto" to a
        // TTS voice lookup or a BCP-47 map.
        for (const f of [
            "src/screens/ChatScreen.tsx",
            "src/screens/SettingsScreen.tsx",
            "src/screens/TrendsScreen.tsx",
            "src/components/imotara/CompanionQuickPanel.tsx",
        ]) {
            const src = fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
            expect(src).not.toMatch(/preferredLang\s*\?\?\s*"en"/);
            expect(src).not.toMatch(/preferredLang\s*\|\|\s*"en"/);
        }
    });
});

describe("the stored default and its one-time migration", () => {
    const ctx = fs.readFileSync(
        path.join(__dirname, "..", "state", "SettingsContext.tsx"), "utf8");

    it("new installs default to auto, not en", () => {
        expect(ctx).toContain('preferredLang: "auto"');
        expect(ctx).not.toContain('preferredLang: "en"');
    });

    it("migrates a stored en to auto exactly once", () => {
        expect(ctx).toMatch(/if \(!langMigrated && merged\.user\?\.preferredLang === "en"\)/);
        expect(ctx).toContain("LANG_AUTO_MIGRATED_KEY");
    });

    it("marks the migration done even when nothing changed", () => {
        // Otherwise a user who had already chosen Bengali gets re-examined on
        // every launch, and a later switch to English would be silently
        // converted to auto — overriding a deliberate choice.
        const i = ctx.indexOf("if (!langMigrated)");
        const j = ctx.indexOf("LANG_AUTO_MIGRATED_KEY", i);
        expect(i).toBeGreaterThan(-1);
        expect(j).toBeGreaterThan(i);
    });
});

describe("the picker offers Auto", () => {
    const s = fs.readFileSync(
        path.join(__dirname, "..", "screens", "SettingsScreen.tsx"), "utf8");
    it("lists auto first so it reads as the default", () => {
        const auto = s.indexOf('{ id: "auto", label: "Auto" }');
        const en = s.indexOf('{ id: "en", label: "English" }');
        expect(auto).toBeGreaterThan(-1);
        expect(auto).toBeLessThan(en);
    });
    it("shows auto as selected when nothing is stored", () => {
        expect(s).toContain('preferredLang ?? "auto"');
    });
    it("explains what Auto does", () => {
        expect(s).toMatch(/Auto replies in whatever language you write in/);
    });
});
