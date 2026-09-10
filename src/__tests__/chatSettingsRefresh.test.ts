/**
 * Settings the chat screen obeys must be re-read when you come back to it.
 *
 * THE BUG THIS EXISTS TO PREVENT
 *
 * ChatScreen used to read its settings in four separate mount-only effects,
 * and re-read a short, hand-picked subset on focus. Anything not on that
 * subset silently did nothing when changed in Settings — the person switched
 * it, came back to the chat, and the old value was still in effect until the
 * screen happened to remount. Twenty-nine settings were in that state,
 * including typing speed, haptics, timestamps, and every "Dismiss forever"
 * capsule you might want back.
 *
 * It was found twice, the hard way. The second time a guard for "Online
 * transcription" was written, reviewed, and shipped looking entirely correct,
 * and did nothing on device: the new value never reached the screen.
 *
 * The fix was to delete the second list. There is now ONE list, in
 * loadChatSettings, called from the focus effect. These tests keep it that
 * way — two lists cannot drift if there is only ever one.
 */
import fs from "fs";
import path from "path";

const chatPath = path.join(__dirname, "..", "screens", "ChatScreen.tsx");
const settingsPath = path.join(__dirname, "..", "screens", "SettingsScreen.tsx");
const chat = fs.readFileSync(chatPath, "utf8");
const settings = fs.readFileSync(settingsPath, "utf8");

/** Body of a `name(... => {` block, matched by brace balance. */
function blockAfter(src: string, marker: string): string {
    const at = src.indexOf(marker);
    if (at < 0) throw new Error(`not found in ChatScreen.tsx: ${marker}`);
    const open = src.indexOf("{", at + marker.length - 1);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
    }
    throw new Error(`unbalanced braces after: ${marker}`);
}

const loader = blockAfter(chat, "const loadChatSettings = useCallback(async () => {");

/**
 * The argument list of the loader's multiGet — the keys actually FETCHED.
 *
 * Checked separately from the loader body on purpose. An earlier version of
 * this test asked only whether the key appeared somewhere in loadChatSettings,
 * and deleting a key from the fetch list still passed, because the body's
 * `get("...")` call still mentioned it — and `get` on an unfetched key quietly
 * returns null, so the setting would have gone back to being ignored with the
 * suite green. A key must be fetched, not merely named.
 */
const fetchList = (() => {
    const at = loader.indexOf("AsyncStorage.multiGet([");
    const open = loader.indexOf("[", at);
    let depth = 0;
    for (let i = open; i < loader.length; i++) {
        if (loader[i] === "[") depth++;
        else if (loader[i] === "]" && --depth === 0) return loader.slice(open, i + 1);
    }
    throw new Error("unbalanced multiGet argument list");
})();
const focusEffect = blockAfter(chat, "useFocusEffect(React.useCallback(() => {");

/**
 * ChatScreen names some keys with a constant (`const MILESTONE_ENABLED_KEY =
 * "imotara.milestone.show.v1"`), so "is this key in the loader?" has to accept
 * the constant as well as the literal. Resolved from the source rather than
 * duplicated here, so renaming a constant cannot quietly disable a check.
 */
const constForKey = new Map<string, string>();
for (const m of chat.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*"(imotara[.:][A-Za-z0-9_.:]+)"/g)) {
    constForKey.set(m[2], m[1]);
}
function loaderReads(key: string): boolean {
    if (fetchList.includes(`"${key}"`)) return true;
    const name = constForKey.get(key);
    return !!name && new RegExp(`\\b${name}\\b`).test(fetchList);
}

/** Every AsyncStorage key the Settings UI writes — the settings, by definition. */
const settingsOwnedKeys = new Set(
    (settings.match(/"imotara[.:][A-Za-z0-9_.:]+"/g) ?? []).map((s) => s.slice(1, -1)),
);

/**
 * Settings ChatScreen deliberately reads at the moment it uses them, rather
 * than holding in state. Those cannot go stale — the read IS the use — so they
 * do not belong in the loader. Adding to this list should be a decision, not
 * an accident, which is the point of having to edit it.
 */
const POINT_OF_USE = [
    "imotara.tts.autoRead.v1",          // read as a reply is about to be spoken
    "imotara.memory.capture.enabled.v1", // read as a memory is about to be written
    "imotara.discovery.cards.enabled.v1", // read as a card is about to be shown
];

describe("chat settings are re-read on focus", () => {
    it("has exactly one place that loads settings", () => {
        expect(chat.match(/AsyncStorage\.multiGet/g) ?? []).toHaveLength(1);
        expect(loader).toContain("AsyncStorage.multiGet");
    });

    it("loads them from the focus effect, so returning to chat picks up changes", () => {
        // Anchored to the start of a line so a commented-out call cannot
        // satisfy it — `// void loadChatSettings();` still contains the text.
        expect(focusEffect).toMatch(/^\s*void loadChatSettings\(\);/m);
    });

    it("has no second, mount-only call that could drift from the focus one", () => {
        expect(chat.match(/loadChatSettings\(\)/g) ?? []).toHaveLength(1);
    });

    it("reads every settings key it uses inside that one loader", () => {
        const missing: string[] = [];
        for (const key of settingsOwnedKeys) {
            if (POINT_OF_USE.includes(key)) continue;
            if (!chat.includes(`"${key}"`)) continue; // chat does not use this setting
            if (!loaderReads(key)) missing.push(key);
        }
        expect(missing).toEqual([]);
    });

    it("reads each of them exactly once — a second read is the old bug returning", () => {
        const twice: string[] = [];
        for (const key of settingsOwnedKeys) {
            if (POINT_OF_USE.includes(key)) continue;
            const name = constForKey.get(key);
            const asLiteral = `"${key.replace(/[.]/g, "\\.")}"`;
            const pattern = name ? `(?:${asLiteral}|\\b${name}\\b)` : asLiteral;
            const reads = chat.match(new RegExp(`AsyncStorage\\.getItem\\(\\s*${pattern}`, "g")) ?? [];
            if (reads.length > 0) twice.push(key);
        }
        expect(twice).toEqual([]);
    });
});

describe("the settings that were silently mount-only", () => {
    // Named individually rather than counted, so this fails with the name of
    // whatever was dropped instead of an unhelpful "expected 29, got 28".
    const mustReload = [
        "imotara.voice.maxDuration.v1", "imotara.voice.quality.v1",
        "imotara.api.timeout.v1", "imotara.status.pollInterval.v1",
        "imotara.haptic.intensity.v1", "imotara.reactions.set.v1",
        "imotara.typing.speed.v1", "imotara.content.guard.v1",
        "imotara.crisis.threshold.v1", "imotara.tts.rate.v1",
        "imotara.tts.pitch.v1", "imotara.chat.showTimestamps.v1",
        "imotara.sentiment.chips.enabled.v1", "imotara.weekly.recap.enabled.v1",
        "imotara.undo.enabled.v1",
        // the five that had already been patched in one at a time
        "imotara:handsfree.v1", "imotara.voice.confirmTranscription.v1",
        "imotara.voice.autoSend.v1", "imotara.chat.relationshipBackdrop.v1",
        "imotara.voice.cloudTranscription.v1",
    ];
    it.each(mustReload)("%s is refreshed on focus", (key) => {
        expect(fetchList).toContain(`"${key}"`);
        // and is actually consumed, not just fetched
        expect(loader).toMatch(new RegExp(`get\\("${key.replace(/[.]/g, "\\.")}"\\)`));
    });

    // Capsules are referenced by constant, not literal, in the loader.
    const capsules = [
        "DAILY_CHECKIN_ENABLED_KEY", "COLLECTIVE_PULSE_ENABLED_KEY",
        "TONE_REFLECTION_ENABLED_KEY", "RETURN_GREETING_ENABLED_KEY",
        "MOOD_GLIMPSE_ENABLED_KEY", "MILESTONE_ENABLED_KEY",
        "UNSENT_HINT_ENABLED_KEY", "TRIAL_BANNER_ENABLED_KEY",
        "SESSION_GREETING_KEY",
    ];
    it.each(capsules)("%s — turning the capsule back on takes effect", (constName) => {
        expect(fetchList).toContain(constName);
        expect(loader).toMatch(new RegExp(`get\\(${constName}\\)`));
    });
});

/**
 * Where each setting ends up. Spelled out because fetching a key is only half
 * the job: an earlier version of this test was satisfied by a key that was
 * fetched, read into a local, and then never applied to anything — the setting
 * did nothing, and the suite stayed green. Both halves are now pinned.
 */
const SETTER_FOR: Record<string, string> = {
    "imotara.voice.maxDuration.v1": "setVoiceMaxDurationMs",
    "imotara.voice.quality.v1": "setVoiceQuality",
    "imotara.voice.cloudTranscription.v1": "setVoiceCloudTranscription",
    "imotara.api.timeout.v1": "setApiTimeoutMs",
    "imotara.status.pollInterval.v1": "setStatusPollMs",
    "imotara.haptic.intensity.v1": "setHapticIntensity",
    "imotara.reactions.set.v1": "setChatReactionsSet",
    "imotara.typing.speed.v1": "setChatTypingSpeed",
    "imotara.content.guard.v1": "setContentGuardSensitivity",
    "imotara.crisis.threshold.v1": "setCrisisThresholdSetting",
    "imotara.tts.rate.v1": "setTtsRate",
    "imotara.tts.pitch.v1": "setTtsPitch",
    "imotara.voice.confirmTranscription.v1": "setVoiceConfirm",
    "imotara.voice.autoSend.v1": "setVoiceAutoSend",
    "imotara.chat.relationshipBackdrop.v1": "setRelationshipBackdrop",
    "imotara:handsfree.v1": "setHandsfree",
    "imotara.sentiment.chips.enabled.v1": "setSentimentChipsEnabled",
    "imotara.weekly.recap.enabled.v1": "setWeeklyRecapSettingEnabled",
    "imotara.undo.enabled.v1": "setUndoSettingEnabled",
    "imotara.chat.showTimestamps.v1": "setShowMsgTimestamps",
    "imotara.daily.checkin.show.v1": "setDailyCheckinEnabled",
    "imotara.collective.pulse.show.v1": "setCollectivePulseEnabled",
    "imotara.tone.reflection.show.v1": "setToneReflectionEnabled",
    "imotara.return.greeting.show.v1": "setReturnGreetingEnabled",
    "imotara.mood.glimpse.show.v1": "setMoodGlimpseEnabled",
    "imotara.milestone.show.v1": "setMilestoneEnabled",
    "imotara.unsent.hint.show.v1": "setUnsentHintEnabled",
    "imotara.trial.banner.show.v1": "setTrialBannerEnabled",
    "imotara.session.greeting.show.v1": "setSessionGreetingEnabled",
    "imotara.grow.nudge.perm.v1": "setGrowNudgeDismissed",
};

describe("each setting actually reaches the screen", () => {
    it.each(Object.entries(SETTER_FOR))("%s -> %s", (_key, setter) => {
        expect(loader).toMatch(new RegExp(`\\b${setter}\\(`));
    });

    it("covers every key the loader fetches — no setting arrives unapplied", () => {
        const fetched = (fetchList.match(/"imotara[.:][A-Za-z0-9_.:]+"/g) ?? []).map((k) => k.slice(1, -1));
        const byConst = [...constForKey.entries()]
            .filter(([, name]) => new RegExp(`\\b${name}\\b`).test(fetchList))
            .map(([key]) => key);
        for (const key of [...fetched, ...byConst]) {
            expect(Object.keys(SETTER_FOR)).toContain(key);
        }
    });
});

describe("the loader keeps the behaviour of the effects it replaced", () => {
    it("defaults timestamps ON when never set", () => {
        expect(loader).toMatch(/ts === null \? true : ts === "1"/);
    });
    it("defaults undo OFF, and chips and recap ON", () => {
        expect(loader).toMatch(/setUndoSettingEnabled\(get\("imotara\.undo\.enabled\.v1"\) === "1"\)/);
        expect(loader).toMatch(/setSentimentChipsEnabled\(get\("imotara\.sentiment\.chips\.enabled\.v1"\) !== "0"\)/);
        expect(loader).toMatch(/setWeeklyRecapSettingEnabled\(get\("imotara\.weekly\.recap\.enabled\.v1"\) !== "0"\)/);
    });
    it("assigns the grow nudge symmetrically, so Settings can bring it back", () => {
        // The effect this replaced was one-way — `if (v === "1") set(true)` —
        // so it could dismiss the nudge but never restore it, and the Settings
        // toggle looked broken in one direction only.
        expect(loader).toMatch(/setGrowNudgeDismissed\(get\(GROW_NUDGE_KEY\) === "1"\)/);
        expect(loader).not.toMatch(/if \([^)]*GROW_NUDGE_KEY[^)]*\)[^;]*setGrowNudgeDismissed\(true\)/);
    });

    it("still sets handsfreeRef before auto-starting the mic", () => {
        // startHandsfreeIfIdle checks the ref; setting state alone is not enough.
        const refAt = loader.indexOf("handsfreeRef.current = handsfreeOn");
        const startAt = loader.indexOf("startHandsfreeIfIdleRef.current()");
        expect(refAt).toBeGreaterThan(-1);
        expect(startAt).toBeGreaterThan(refAt);
    });
});
