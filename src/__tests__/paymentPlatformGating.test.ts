// Which payment rail runs on which platform is an App Store compliance
// question, not a style one, and it is spread across three files. This pins it.
//
// Apple requires IAP for digital content: subscriptions, token packs and tips.
// UpgradeSheet and IOSTipJar do that correctly. The ONE deliberate exception is
// Connect session minutes — a realtime one-to-one session with a named
// companion, which Apple's person-to-person services provision covers. That
// exception is narrow, so this test makes adding a second one a red build
// rather than something noticed at review time.

import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

const CONNECT = "screens/connect/ConnectScreen.tsx";
const UPGRADE = "components/imotara/UpgradeSheet.tsx";

/** Every file under src/ that opens the native Razorpay checkout. */
function razorpayCallSites(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (/\.tsx?$/.test(e.name) && !full.includes("__tests__")) {
                const src = fs.readFileSync(full, "utf8");
                if (/RazorpayCheckout\.open\s*\(/.test(src)) {
                    out.push(path.relative(path.join(__dirname, ".."), full));
                }
            }
        }
    };
    walk(path.join(__dirname, ".."));
    return out.sort();
}

describe("the fixture is real", () => {
    it("finds the files it is asserting about", () => {
        expect(read(CONNECT).length).toBeGreaterThan(1000);
        expect(read(UPGRADE).length).toBeGreaterThan(1000);
    });
});

describe("native Razorpay checkout has exactly the call sites we vetted", () => {
    it("no new Razorpay call site has appeared", () => {
        // Adding one is not forbidden — but it must be a conscious decision about
        // Apple's rules, so update this list in the same commit and say why.
        expect(razorpayCallSites()).toEqual([CONNECT, UPGRADE].sort());
    });
});

describe("digital content still goes through Apple IAP on iOS", () => {
    const upgrade = read(UPGRADE);

    it("subscriptions route iOS to IAP, not Razorpay", () => {
        expect(upgrade).toMatch(/Platform\.OS === "ios"\)\s*handleIosPurchase\(sku, "subs"\)/);
    });

    it("token packs route iOS to IAP, not Razorpay", () => {
        expect(upgrade).toMatch(/Platform\.OS === "ios"\)\s*handleIosPurchase\(sku, "in-app"\)/);
    });
});

describe("the one ungated path is the documented person-to-person exception", () => {
    const connect = read(CONNECT);

    it("Connect session recharge explains why it is not gated", () => {
        const i = connect.indexOf("RazorpayCheckout.open");
        expect(i).toBeGreaterThan(-1);
        const preamble = connect.slice(Math.max(0, i - 1400), i);
        expect(preamble).toContain("person-to-person");
        expect(preamble).toContain("3.1.3(d)");
    });

    it("it is still the session recharge, not a general wallet top-up", () => {
        // The wallet top-up call sites were removed with the wallet (137d154).
        // If they come back, they are NOT covered by the exception above.
        expect(connect).not.toMatch(/function\s+(TopUpForm|WalletTopUpModal)\b/);
        expect(connect).toMatch(/function\s+SessionRechargeModal\b/);
    });
});
