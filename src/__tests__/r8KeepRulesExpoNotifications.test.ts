/**
 * R8 keep rules for expo-notifications — without them, reminders cannot be
 * scheduled in ANY Android release build.
 *
 * Found on a real Galaxy A27, 2026-09-16, while verifying an unrelated change.
 * Toggling "Daily check-in reminder" showed "Permission needed" although the OS
 * permission was granted. logcat had the truth:
 *
 *     java.io.NotSerializableException: org.json.JSONObject
 *
 * expo-notifications persists a scheduled request with ObjectOutputStream.
 * NotificationContent has private writeObject/readObject hooks that write its
 * JSONObject body as a string — but R8 stripped them (only reached
 * reflectively), Java fell back to default field serialization, and hit
 * `JSONObject mBody`. The library's own keep rule lives in its SOURCE repo;
 * the published AAR ships no proguard.txt, so it never reaches this app.
 *
 * The rules live in app.json (expo-build-properties.extraProguardRules) so they
 * survive prebuild and EAS — android/ is gitignored and regenerated.
 */
import fs from "fs";
import path from "path";

const app = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "app.json"), "utf8"));
const bp = (app.expo.plugins as unknown[]).find(
    (p) => Array.isArray(p) && p[0] === "expo-build-properties",
) as [string, { android?: { extraProguardRules?: string; enableProguardInReleaseBuilds?: boolean } }] | undefined;

describe("the keep rules R8 needs are owned by the app", () => {
    it("R8 is on for release builds — which is why the rules matter", () => {
        // If this ever flips to false the rules become moot but harmless; if it
        // stays true and the rules vanish, reminders silently die again.
        expect(bp?.[1].android?.enableProguardInReleaseBuilds).toBe(true);
    });

    it("keeps every expo.modules.notifications class and member", () => {
        expect(bp?.[1].android?.extraProguardRules).toMatch(/-keep class expo\.modules\.notifications\.\*\* \{ \*; \}/);
    });

    it("keeps the private Serializable hooks for EVERY Serializable class", () => {
        // The general rule, not just the notifications one: any other prebuilt
        // module in the same situation is covered without a second incident.
        const r = bp?.[1].android?.extraProguardRules ?? "";
        expect(r).toMatch(/-keepclassmembers class \* implements java\.io\.Serializable \{/);
        expect(r).toMatch(/private void writeObject\(java\.io\.ObjectOutputStream\);/);
        expect(r).toMatch(/private void readObject\(java\.io\.ObjectInputStream\);/);
    });

    it("explains itself where the next person will look", () => {
        expect(bp?.[1].android?.extraProguardRules).toMatch(/NotSerializableException/);
    });
});
