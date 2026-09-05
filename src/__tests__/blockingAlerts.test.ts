// UX-18: informational failures became non-blocking toasts, but a few alerts
// must stay modal. This test guards the ones we deliberately kept, so a future
// "convert the remaining alerts" sweep cannot silently downgrade them.
//
// The rule: an alert stays blocking when missing it would leave the user with a
// false belief about their data (a delete that did not happen), or when it asks
// the user to make an irreversible choice.

import fs from "fs";
import path from "path";

const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

describe("alerts that must stay blocking", () => {
    const settings = read("screens/SettingsScreen.tsx");
    const trends = read("screens/TrendsScreen.tsx");

    it("keeps the remote-delete failure paths as modal alerts", () => {
        // The success path shows Alert.alert("Done", "Remote data has been deleted.").
        // If the failure path were a toast the user could miss, they would walk
        // away believing their synced data is gone when it is not.
        expect(settings).toContain(
            'Alert.alert("Error", "Could not delete remote data. Please try again.");',
        );
        expect(settings).toContain(
            'Alert.alert("Error", "Could not reach the server. Please try again.");',
        );
    });

    it("keeps irreversible confirmations as modal alerts", () => {
        expect(trends).toContain('Alert.alert("Delete entry?", "This cannot be undone.", [');
        expect(trends).toContain('Alert.alert("Delete this letter?", "This cannot be undone.", [');
    });
});

describe("informational failures are toasts, not alerts", () => {
    const settings = read("screens/SettingsScreen.tsx");
    const trends = read("screens/TrendsScreen.tsx");

    it.each([
        ["SettingsScreen", "Export unavailable"],
        ["SettingsScreen", "Export failed"],
        ["TrendsScreen", "Nothing to export"],
    ])("%s no longer raises an alert titled %s", (screen, title) => {
        const src = screen === "SettingsScreen" ? settings : trends;
        expect(src).not.toContain(`Alert.alert("${title}"`);
    });

    it("every screen that calls notify() also mounts a Toast to receive it", () => {
        for (const [name, src] of [["SettingsScreen", settings], ["TrendsScreen", trends]] as const) {
            if (!/\bnotify\(/.test(src)) continue;
            expect(src).toMatch(/<Toast ref=\{toastRef\}\s*\/>/);
            expect(src).toContain("useRef<ToastHandle>(null)");
        }
    });
});
