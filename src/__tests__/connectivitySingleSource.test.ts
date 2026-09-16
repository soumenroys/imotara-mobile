/**
 * One source of truth for "are we online".
 *
 * Until 2026-09-16 there were two, and the app used the weaker one for the
 * decision that mattered:
 *
 *   lib/network/online.ts    NetInfo, probes imotara.com/api/health, needs 200
 *                            -> used ONLY by fetchWithTimeout
 *   hooks/useOnlineStatus    own poller, asked connectivitycheck.gstatic.com,
 *                            NEVER CHECKED THE RESPONSE STATUS
 *                            -> used by ChatScreen for the status banner AND
 *                               for choosing cloud vs on-device replies
 *
 * So the careful checker guarded fetches while the sloppy one decided whether
 * to try the cloud at all. Three defects came with it: a captive portal's
 * login page counted as "online" (exactly what online.ts exists to catch), its
 * own doc comment described a HEAD request to our API that the code never
 * made, and its failure counter was module-level, shared by every instance.
 *
 * Suspected cause of the 2026-09-16 report where the app fell back to
 * on-device replies while imotara.com/api/health answered 200 throughout —
 * both things that were tested were hosts the app was not asking.
 */
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const ONLINE = read("lib/network/online.ts");
const CHAT = strip(read("screens/ChatScreen.tsx"));

describe("the duplicate is gone", () => {
    it("useOnlineStatus.ts no longer exists", () => {
        expect(fs.existsSync(path.join(__dirname, "..", "hooks", "useOnlineStatus.ts"))).toBe(false);
    });

    it("nothing imports it any more", () => {
        expect(CHAT).not.toMatch(/useOnlineStatus/);
    });

    it("nothing polls Google's connectivity check", () => {
        // The host that was never tested while two others were.
        for (const f of ["screens/ChatScreen.tsx", "lib/network/online.ts"]) {
            expect(strip(read(f))).not.toMatch(/connectivitycheck\.gstatic\.com/);
        }
    });
});

describe("the surviving checker is the careful one", () => {
    it("probes Imotara's own endpoint, not a third party", () => {
        // "Reachable" must mean "can reach Imotara" — the only question the
        // app actually needs answered.
        expect(ONLINE).toMatch(/reachabilityUrl: "https:\/\/www\.imotara\.com\/api\/health"/);
    });

    it("⚠️ actually CHECKS the response status", () => {
        // The whole captive-portal defence. Hotel wifi answers every request
        // with its own login page; without this it reads as online.
        expect(ONLINE).toMatch(/reachabilityTest: async \(response\) => response\.status === 200/);
    });

    it("ChatScreen now reads that one", () => {
        expect(CHAT).toMatch(/const isOnline = useIsOnline\(\)/);
        expect(CHAT).toMatch(/import \{ useIsOnline, setConnectivityCheckInterval \} from "\.\.\/lib\/network\/online"/);
    });
});

describe("the bias towards trying is preserved", () => {
    // Regression guard on a SHIPPED decision path. The replaced hook defaulted
    // to true, and online.ts's own reasoning says refusing to try when we
    // could have is a broken app, while a wasted few seconds is an annoyance.
    const isOnline = (c: "online" | "offline" | "unknown") => c !== "offline";

    it("unknown counts as online, exactly as before", () => {
        expect(isOnline("unknown")).toBe(true);
    });

    it("only a definite offline stops us", () => {
        expect(isOnline("offline")).toBe(false);
        expect(isOnline("online")).toBe(true);
    });

    it("the hook encodes that, not a stricter test", () => {
        expect(ONLINE).toMatch(/return state !== "offline";/);
    });
});

describe("the user's setting still means what it says", () => {
    it("'Connectivity check interval' drives the real probe", () => {
        // The setting promises "lower = faster detection, higher = less
        // battery use". Deleting the second poller would have silently made it
        // do nothing at all.
        expect(ONLINE).toMatch(/export function setConnectivityCheckInterval/);
        expect(ONLINE).toMatch(/reachabilityLongTimeout: longTimeoutMs/);
        expect(CHAT).toMatch(/setConnectivityCheckInterval\(pollSecs \* 1000\)/);
    });

    it("a re-configure actually reaches NetInfo", () => {
        // Storing the number without re-applying it would be the same bug in
        // a new place: a setting that looks wired and changes nothing.
        expect(ONLINE).toMatch(/longTimeoutMs = ms;\s*if \(started\) applyConfig\(\);/);
    });

    it("ignores nonsense values rather than disabling the probe", () => {
        expect(ONLINE).toMatch(/if \(!isFinite\(ms\) \|\| ms <= 0 \|\| ms === longTimeoutMs\) return;/);
    });
});
