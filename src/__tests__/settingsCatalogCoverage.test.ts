/**
 * Every setting on the Settings screen must be findable by search.
 *
 * THE BUG THIS EXISTS TO PREVENT
 *
 * settingsCatalog.ts is a hand-maintained index, separate from the screen it
 * indexes. Adding a setting to SettingsScreen does not add it to the catalog,
 * and nothing complained — so eighteen settings were silently unsearchable,
 * including "Online transcription", which had been shipped two days before
 * anyone noticed. The owner found it by typing "timestamp" into the settings
 * search and getting "No settings found".
 *
 * Note this is the SECOND list this catalog has to stay level with. The other
 * is the web repo's /api/settings-search route — see
 * settingsCatalogServerSync.test.ts. Both guards are needed: that one checks
 * catalog <-> server, this one checks catalog <-> the actual screen.
 */
import fs from "fs";
import path from "path";

const screenSrc = fs.readFileSync(
    path.join(__dirname, "..", "screens", "SettingsScreen.tsx"), "utf8");
const catalogSrc = fs.readFileSync(
    path.join(__dirname, "..", "data", "settingsCatalog.ts"), "utf8");

/** Every row the user can see and toggle. */
const rowLabels = [...screenSrc.matchAll(/<SettingRow\s+label="([^"]+)"/g)].map((m) => m[1]);

const catalogTitles = [...catalogSrc.matchAll(/^\s*title: "([^"]+)",$/gm)].map((m) => m[1]);
const catalogBlob = catalogSrc.toLowerCase();

/**
 * A row counts as indexed when the catalog carries its title, or names it
 * closely enough that a search for those words lands on it. Matching on the
 * distinctive words rather than the exact string, because the catalog
 * deliberately words some entries differently from the row ("Show badge" ->
 * "App icon badge") and forcing them identical would make both worse.
 */
const ALIASES: Record<string, string> = {
    "Show badge": "notif_badge",
    "Play sound": "notif_sound",
    "Ask before using": "voice_confirm",
    "Message undo (5s)": "message_undo",
    "Companion memory auto-capture": "memory_capture",
    "Auto-read assistant replies": "tts_auto_read",
    "30-day challenge widget": "challenge_show",
    "30-day mood chart": "mood_chart",
    "On This Day card": "on_this_day",
    "Mood glimpse": "mood_glimpse",
    "Online transcription": "voice_cloud_transcription",
    "Hide Grow nudge": "grow_nudge_hide",
    "Exact history search": "history_search_exact",
    "Unsent Letter hint": "unsent_letter_hint",
    "Trial countdown banner": "trial_banner",
    "Tone reflection card": "tone_reflection",
    "Milestone celebration": "milestone_celebration",
    "Weekly mood recap": "weekly_recap",
    "Sentiment seed chips": "sentiment_chips",
    "Collective pulse": "collective_pulse",
    "Daily check-in": "daily_checkin",
    "Return greeting": "return_greeting",
    "Reduced motion": "reduced_motion",
};

function isIndexed(label: string): boolean {
    if (catalogTitles.includes(label)) return true;
    const id = ALIASES[label];
    return !!id && catalogBlob.includes(`id: "${id}"`);
}

describe("settings search covers the Settings screen", () => {
    it("finds some rows to check (the regex still matches the markup)", () => {
        // Guards against this whole suite passing vacuously if SettingRow is
        // renamed or its props reordered.
        expect(rowLabels.length).toBeGreaterThanOrEqual(20);
    });

    it("has a catalog entry for every SettingRow", () => {
        const missing = rowLabels.filter((l) => !isIndexed(l));
        expect(missing).toEqual([]);
    });

    it("indexes the message-timestamp toggle, which is not a SettingRow", () => {
        // Rendered with raw <Text> + <Switch> rather than SettingRow, so the
        // scan above cannot see it. This is the one the owner searched for.
        expect(screenSrc).toContain("Show message timestamps");
        expect(catalogSrc).toContain('id: "chat_timestamps"');
        expect(catalogBlob).toContain('"timestamp"');
    });

    it("gives every alias a real catalog entry", () => {
        // An alias pointing at an id that does not exist would silently excuse
        // a row from the coverage check above.
        const dangling = Object.entries(ALIASES)
            .filter(([, id]) => !catalogBlob.includes(`id: "${id}"`))
            .map(([label, id]) => `${label} -> ${id}`);
        expect(dangling).toEqual([]);
    });

    it("points every entry at a section the screen can actually open", () => {
        const keys = new Set([...catalogSrc.matchAll(/sectionKey: "([^"]+)"/g)].map((m) => m[1]));
        // Accordion keys as used by SettingsSearch's scroll-and-expand.
        const valid = new Set(["companion", "experience", "advanced", "mindset", "privacy", "support"]);
        expect([...keys].filter((k) => !valid.has(k))).toEqual([]);
    });

    it("has no duplicate ids", () => {
        const ids = [...catalogSrc.matchAll(/^\s*id: "([^"]+)",$/gm)].map((m) => m[1]);
        expect(ids.length).toBe(new Set(ids).size);
    });
});
