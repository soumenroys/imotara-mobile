/**
 * The bubble must not tell someone they are offline when they are not.
 *
 * 🔴 MEASURED ON A REAL iPHONE, 2026-10-11. With BOTH wifi and mobile data on,
 * one cold-start cloud failure rendered "Imotara (offline)". At that same
 * moment /api/chat-reply answered the identical crisis phrase in 2.4 / 3.1 /
 * 2.4 seconds when called directly. The server was healthy, the phone was
 * online, and the app blamed the person's connection.
 *
 * The cause was a single render-time guess:
 *
 *     source === "local" ? " (offline)" : ""
 *
 * which also labelled the GREETING and the content-guard reply "(offline)" —
 * both of which never go to the cloud by design.
 *
 * ⛔ WHY THIS IS NOT FIXED BY READING `isOnline` IN THE RENDERER. ChatScreen's
 * own comment records that on iOS `isOnline` is a PROBE and "a Vercel blip or
 * a cold start makes that probe time out" — the very failure that produced the
 * wrong label. So the reason is stamped at creation and only rendered here.
 */

import { localSourceLabel, type LocalReason } from "../lib/chat/localSourceLabel";

describe("🔴 'offline' is claimed only when it is true", () => {
    it("says (offline) ONLY when there was genuinely no connection", () => {
        expect(localSourceLabel({ source: "local", localReason: "offline" }))
            .toBe(" (offline)");
    });

    it("⛔ an online cloud failure must NOT be called offline", () => {
        // The exact 2026-10-11 case: wifi + mobile data on, cloud threw.
        const label = localSourceLabel({ source: "local", localReason: "cloud_failed" });
        expect(label).not.toContain("offline");
        expect(label).toBe(" (on-device)");
    });

    it("⛔ running out of cloud replies is not a connection problem either", () => {
        const label = localSourceLabel({ source: "local", localReason: "quota" });
        expect(label).not.toContain("offline");
        expect(label).toBe(" (on-device)");
    });

    it("⛔ a greeting is not labelled at all — it is not a degraded reply", () => {
        // This used to render "Imotara (offline)" before the person had typed
        // a single word.
        expect(localSourceLabel({ source: "local", localReason: "by_design" })).toBe("");
    });

    it("🔑 an unstamped local message degrades to the ACCURATE label, never the lie", () => {
        // Messages restored from history predate this field. "on-device" is
        // true whether or not they had a connection; "offline" is a claim we
        // cannot support.
        const label = localSourceLabel({ source: "local" });
        expect(label).not.toContain("offline");
        expect(label).toBe(" (on-device)");
    });

    it("cloud replies carry no suffix at all", () => {
        expect(localSourceLabel({ source: "cloud" })).toBe("");
        expect(localSourceLabel({})).toBe("");
        // ⚠️ A reason without a local source must not leak a label.
        expect(localSourceLabel({ source: "cloud", localReason: "offline" })).toBe("");
    });

    it("⛔ NO reason value may produce the word 'offline' except 'offline'", () => {
        // The point of the file in one assertion: if someone adds a new reason
        // and maps it to the old string, this fails.
        const reasons: LocalReason[] = ["offline", "cloud_failed", "quota", "by_design"];
        const lying = reasons.filter(
            (r) => r !== "offline" &&
                localSourceLabel({ source: "local", localReason: r }).includes("offline"),
        );
        expect(lying).toEqual([]);
    });
});

describe("⚠️ the renderer must not start guessing again", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const screen = fs.readFileSync(
        path.join(__dirname, "..", "screens", "ChatScreen.tsx"), "utf8");

    it("🔴 ChatScreen no longer builds the label inline", () => {
        // The original bug, in the form it had. If this string returns, the
        // module above has been bypassed.
        expect(screen).not.toMatch(/source === "local" \? " \(offline\)" : ""/);
    });

    it("…and every local message creation stamps a reason", () => {
        // Each `source: "local"` literal must have a localReason near it.
        // ⚠️ Counts sites rather than naming line numbers, which rot.
        const sites = [...screen.matchAll(/source: "local",/g)];
        expect(sites.length).toBeGreaterThanOrEqual(3);
        for (const m of sites) {
            const after = screen.slice(m.index!, m.index! + 400);
            if (!/localReason:/.test(after)) {
                const line = screen.slice(0, m.index!).split("\n").length;
                throw new Error(
                    `a local message at ChatScreen.tsx:${line} does not stamp localReason — ` +
                    `it will fall back to "(on-device)" instead of saying what actually happened`,
                );
            }
        }
    });
});
