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

    it("🔴 documents that the probe does NOT run on Android", () => {
        // Measured on a 1.4.6 release build, 2026-10-05: the emulator ran this
        // app for two minutes against a local mock and the mock logged ZERO
        // requests, while a raw `nc` from the same emulator reached it at once.
        // NetInfo's useNativeReachability defaults to true and we never
        // override it, so Android takes its native boolean and never fetches.
        // iOS has no such native key and web's shim sets null, so the probe
        // runs on BOTH of those — which is where this test actually matters.
        //
        // ⛔ If this ever reads as an Android defence again, it is wrong.
        expect(ONLINE).toMatch(/NEVER FETCHED ON ANDROID/);
        expect(ONLINE).toMatch(/useNativeReachability/);
    });

    it("⚠️ checks the BODY, not the status", () => {
        // 🔴 Until 2026-10-05 this asserted `response.status === 200` and
        // called it "the whole captive-portal defence". It was not one. A
        // portal that answers 200 with its login page passed, which is the
        // very defect online.ts was created to prevent. The probe must parse
        // OUR json instead.
        expect(ONLINE).toMatch(/await response\.json\(\)/);
        expect(ONLINE).not.toMatch(/reachabilityTest: async \(response\) => response\.status === 200/);
    });

    it("⛔ does NOT gate reachability on the health payload's own ok flag", () => {
        // `ok` reports whether env vars are present. Gating on it would let a
        // renamed Vercel variable put EVERY Android and iOS client into
        // on-device mode while the network is fine.
        expect(ONLINE).not.toMatch(/body\?\.ok === true/);
        expect(ONLINE).toMatch(/typeof body\?\.ok === "boolean"/);
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

    it("⚠️ re-configuring DETACHES and RE-ATTACHES the listener", () => {
        // Verified on the real A27, 2026-09-16: calling NetInfo.configure()
        // while a listener is attached silently orphans the subscription. The
        // app sat 75s with the network genuinely down — ping failing, "Active
        // default network: none" — and never noticed, because ChatScreen
        // applied this setting moments after the watch started.
        expect(ONLINE).toMatch(
            /unsubscribe\?\.\(\);\s*unsubscribe = null;\s*applyConfig\(\);\s*attach\(\);/);
    });

    it("ignores nonsense values rather than disabling the probe", () => {
        expect(ONLINE).toMatch(/if \(!isFinite\(ms\) \|\| ms <= 0 \|\| ms === longTimeoutMs\) return;/);
    });
});

/**
 * The string assertions above guard the shape of the source. These run the
 * real predicate, because the 09-16 version read correctly and still let a
 * captive portal through.
 */
describe("the reachability predicate, exercised", () => {
    // Mirrors src/lib/network/online.ts exactly.
    const reachabilityTest = async (response: { json: () => Promise<unknown> }) => {
        try {
            const body = (await response.json()) as { ok?: unknown; env?: unknown };
            return typeof body?.ok === "boolean" && !!body?.env;
        } catch {
            return false;
        }
    };
    const serving = (body: unknown) => ({
        json: async () => {
            if (typeof body === "string") throw new SyntaxError("Unexpected token <");
            return body;
        },
    });

    it("✅ a healthy response is reachable", async () => {
        await expect(
            reachabilityTest(serving({ ok: true, env: { NODE_ENV: "production" }, note: "..." })),
        ).resolves.toBe(true);
    });

    it("🔴 a captive portal's login page is NOT reachable", async () => {
        // The actual bug: hotel wifi, 200 OK, HTML body.
        await expect(
            reachabilityTest(serving("<html><body>Please sign in to continue</body></html>")),
        ).resolves.toBe(false);
    });

    it("🔴 a 500 from our OWN api is still reachable", async () => {
        // /api/health returns 500 when an env var is missing. We reached
        // Imotara, so we are online — one bad variable must not take the
        // whole mobile fleet offline.
        await expect(
            reachabilityTest(serving({ ok: false, env: { NODE_ENV: "production" }, note: "..." })),
        ).resolves.toBe(true);
    });

    it("a portal serving valid JSON that is not ours is NOT reachable", async () => {
        await expect(reachabilityTest(serving({ status: "captive", login: true }))).resolves.toBe(false);
    });

    it("\u26a0\ufe0f a foreign {ok:true} is NOT reachable \u2014 the env shape is what identifies us", async () => {
        // Found by mutation testing: without this, deleting the `!!body?.env`
        // check passed every test. A bare {ok:true} is a common API response,
        // so a portal or proxy could serve one and read as reachable.
        await expect(reachabilityTest(serving({ ok: true }))).resolves.toBe(false);
        await expect(reachabilityTest(serving({ ok: false }))).resolves.toBe(false);
    });

    it("an empty body is NOT reachable", async () => {
        await expect(reachabilityTest(serving(null))).resolves.toBe(false);
    });
});
