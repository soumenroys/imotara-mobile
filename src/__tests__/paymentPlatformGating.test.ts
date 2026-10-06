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
        // Apple's and Google's rules, so update this list in the same commit and
        // say why.
        //
        // 2026-09-18: UpgradeSheet LEFT this list. It held a doAndroidPurchase()
        // that opened Razorpay checkout for subscriptions and token packs — i.e.
        // digital content sold outside Play Billing, which Play policy forbids.
        // Nothing called it, so deleting it changed no behaviour; it was removed
        // because unreachable code that violates a store policy is still a loaded
        // gun. Connect session minutes are now the ONLY native Razorpay call site.
        expect(razorpayCallSites()).toEqual([CONNECT]);
    });

    it("the upgrade sheet never opens Razorpay checkout", () => {
        // Stated separately from the list above so the failure message names the
        // actual rule when someone re-adds it: digital content goes through the
        // store, on BOTH platforms. There is no "if Play Billing is unavailable"
        // escape hatch — that was exactly the shape of the code deleted here.
        expect(read(UPGRADE)).not.toMatch(/RazorpayCheckout\.open\s*\(/);
        expect(read(UPGRADE)).not.toMatch(/function\s+doAndroidPurchase\b/);
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

/**
 * Organisation seat purchase stays OFF the phone — owner decision, 2026-10-06.
 *
 * The web has two org paths: /pricing/corporate, a self-serve Razorpay checkout
 * for 10/50/100/500 seats, and /org/new, an enquiry form that promises a reply
 * in 24–48 hours. Mobile links only to the second, and that is deliberate.
 *
 * 🔴 WHY IT MATTERS MORE THAN IT LOOKS. Pointing an app user at an external
 * payment page is precisely what Apple's and Google's anti-steering rules
 * target — relaxed in the US since 2025, not reliably elsewhere, and unsettled
 * in India, which is our market. Selling the same seats through IAP instead
 * would hand the stores 15% of B2B revenue that need never pass through them:
 * about ₹14,993 a year on a single 50-seat commercial org.
 *
 * Against that, no organisation has ever bought self-serve — all four existing
 * orgs were created by the owner, and SHEOWS is provisioned manually by
 * decision. So the exposure is real and the revenue is hypothetical.
 *
 * This pins the decision, because the tempting change — "just link the phone
 * straight to the checkout" — is one line, looks like an improvement, and would
 * move the risk onto the app itself rather than the feature.
 */
describe("the organisation plan is an ENQUIRY on mobile, never a checkout", () => {
    const SETTINGS = "screens/SettingsScreen.tsx";

    it("the org call-to-action opens the enquiry form", () => {
        expect(read(SETTINGS)).toMatch(/Linking\.openURL\(\s*["']https:\/\/imotara\.com\/org\/new["']\s*\)/);
    });

    it("🔴 no screen links the phone to the web seat checkout", () => {
        // /pricing/corporate is the self-serve Razorpay page. A link to it from
        // inside the app is external-purchase steering.
        const walk = (dir: string): string[] => {
            const out: string[] = [];
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) { if (e.name !== "__tests__") out.push(...walk(p)); }
                else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
            }
            return out;
        };
        const offenders = walk(path.join(__dirname, "..")).filter((f) =>
            /pricing\/corporate/.test(fs.readFileSync(f, "utf8")),
        );
        expect(offenders).toEqual([]);
    });

    it("and the wording still says what it does", () => {
        // "Apply" is honest here: the destination really is an application form.
        // If the link ever becomes a checkout, this copy becomes a lie.
        expect(read(SETTINGS)).toMatch(/Apply for org plan/);
    });
});
