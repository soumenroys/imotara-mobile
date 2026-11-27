// 💳 Purchase-flow safety (audit, 27 Nov 2026). No real customer has paid yet; these close the ways
// a first customer could pay and get nothing:
//   1. Android PENDING payments get a calm "still processing" — never "Verification failed".
//   2. Android never finishes (acknowledges/consumes) a purchase the server did not confirm.
//   3. Unfinished Play purchases are swept: from "Restore previous plan" and once per launch.
//   4. iOS waits for the signed-in answer and requires a REAL account before paying.
//   5. Email sign-in from the sheet resumes the purchase, like Google/Apple.
//
// Source checks (the established pattern — the real flow needs a device and a store) plus unit
// tests of the pure helpers in src/payments/androidPurchaseSafety.ts.

import fs from "fs";
import path from "path";
import { Platform } from "react-native";
import type { Purchase } from "expo-iap";
import {
    classifyAndroidVerifyResponse,
    isPendingPurchase,
    pendingPaymentMessage,
    purchasesNeedingVerification,
    recoverAndroidPurchases,
    recoverAndroidPurchasesOncePerLaunch,
    __resetLaunchSweepForTests,
    type RecoveryDeps,
} from "../payments/androidPurchaseSafety";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const U = read("src/components/imotara/UpgradeSheet.tsx");
const SETTINGS = read("src/state/SettingsContext.tsx");
const BUS = read("src/auth/emailSignInBus.ts");
const EMAIL = read("src/auth/EmailSignInSheet.tsx");

function block(src: string, start: string, end: string): string {
    const a = src.indexOf(start);
    const b = src.indexOf(end, a + start.length);
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    return src.slice(a, b);
}

const androidBranch = block(U, '                if (Platform.OS === "android") {\n                    // ── Android: Google Play Billing verification', "} else {\n                    // ── iOS: Apple IAP verification");

function p(over: Partial<Purchase> & Record<string, unknown>): Purchase {
    return { id: "x", productId: "plus_monthly", purchaseState: "purchased", purchaseToken: "tok", isAutoRenewing: true, platform: "android", quantity: 1, store: "google", transactionDate: 0, ...over } as unknown as Purchase;
}

describe("1 · pending payments (Android)", () => {
    it("isPendingPurchase reads expo-iap's purchaseState", () => {
        expect(isPendingPurchase(p({ purchaseState: "pending" }))).toBe(true);
        expect(isPendingPurchase(p({ purchaseState: "purchased" }))).toBe(false);
        expect(isPendingPurchase(p({ purchaseState: "unknown" }))).toBe(false);
        expect(isPendingPurchase(null)).toBe(false);
    });

    it("the server's 202 pending answer is pending, not a failure", () => {
        expect(classifyAndroidVerifyResponse(202, { ok: false, pending: true, error: "payment_pending" })).toEqual({ status: "pending" });
        expect(classifyAndroidVerifyResponse(200, { ok: true })).toEqual({ status: "ok" });
        expect(classifyAndroidVerifyResponse(400, { ok: false, error: "Purchase not valid" })).toEqual({ status: "failed", error: "Purchase not valid" });
        expect(classifyAndroidVerifyResponse(500, null).status).toBe("failed");
    });

    it("the message is calm and honest: still processing, turns on by itself, no need to pay again", () => {
        for (const m of [pendingPaymentMessage(false), pendingPaymentMessage(true)]) {
            expect(m).toMatch(/still being processed/);
            expect(m).toMatch(/automatically/);
            expect(m).toMatch(/no need to pay again/);
            expect(m).not.toMatch(/fail|error|\bAI\b|OpenAI|Gemini|GPT/i);
        }
        expect(pendingPaymentMessage(false)).toMatch(/Plus/);
        expect(pendingPaymentMessage(true)).toMatch(/credits/);
    });

    it("the sheet checks purchaseState BEFORE verifying, and returns without finishing", () => {
        const pend = androidBranch.indexOf("if (isPendingPurchase(purchase)) {");
        const verify = androidBranch.indexOf("await verifyAndroidPurchase(");
        expect(pend).toBeGreaterThan(-1);
        expect(verify).toBeGreaterThan(pend);
        const pendBlock = androidBranch.slice(pend, androidBranch.indexOf("}", pend));
        expect(pendBlock).toContain("Alert.alert(PENDING_PAYMENT_TITLE, pendingPaymentMessage(isTokenPack));");
        expect(pendBlock).toContain("return;");
        expect(pendBlock).not.toContain("finishTransaction");
    });

    it("a 202 pending answer from verify shows the pending message, not 'Verification failed'", () => {
        expect(U).toMatch(/if \(outcome\.status === "pending"\) return \{ ok: false, pending: true \};/);
        const pendBlock = block(androidBranch, "if (androidResult.pending) {", "}");
        expect(pendBlock).toContain("Alert.alert(PENDING_PAYMENT_TITLE, pendingPaymentMessage(isTokenPack));");
        expect(pendBlock).not.toContain("Verification failed");
        expect(androidBranch.indexOf("if (androidResult.pending)")).toBeLessThan(androidBranch.indexOf("if (!androidResult.ok)"));
    });
});

describe("2 · Android never finishes an unconfirmed purchase", () => {
    it("finishTransaction appears once in the Android branch — after serverVerified = true", () => {
        expect(androidBranch.split("finishTransaction(").length - 1).toBe(1);
        expect(androidBranch.indexOf("serverVerified = true;")).toBeLessThan(androidBranch.indexOf("finishTransaction("));
    });

    it("the verify-failed block does not finish", () => {
        const fail = block(androidBranch, "if (!androidResult.ok) {", "return;");
        expect(fail).not.toContain("finishTransaction");
        expect(fail).toContain('"Verification failed"');
    });

    it("no session: Android is not finished (iOS still is)", () => {
        const noSession = block(U, "if (!accessToken) {\n                    if (DEBUG_UI_ENABLED)", "return;");
        expect(noSession).toMatch(/if \(Platform\.OS !== "android"\) \{\s*try \{ await finishTransaction/);
    });
});

describe("3 · recovery sweep", () => {
    const origOS = Platform.OS;
    beforeEach(() => { (Platform as { OS: string }).OS = "android"; __resetLaunchSweepForTests(); });
    afterAll(() => { (Platform as { OS: string }).OS = origOS; });

    function deps(purchases: Purchase[], answer: (body: { productId: string }) => [number, unknown]) {
        const finished: string[] = [];
        const posted: string[] = [];
        const d: RecoveryDeps = {
            initConnection: jest.fn(async () => true),
            getAvailablePurchases: jest.fn(async () => purchases),
            finishTransaction: jest.fn(async ({ purchase }) => { finished.push(purchase.productId); }),
            fetchImpl: (async (_url: string, init: RequestInit) => {
                const body = JSON.parse(String(init.body));
                posted.push(body.productId);
                const [status, data] = answer(body);
                return { status, json: async () => data } as unknown as Response;
            }) as unknown as typeof fetch,
        };
        return { d, finished, posted };
    }

    it("selects unfinished Plus/credit purchases only", () => {
        const sel = purchasesNeedingVerification([
            p({ productId: "plus_monthly", isAcknowledgedAndroid: false }),
            p({ productId: "plus_annual", isAcknowledgedAndroid: true }),    // already finished
            p({ productId: "tokens_100", isAcknowledgedAndroid: true }),     // listed ⇒ not consumed
            p({ productId: "tokens_250", purchaseState: "pending" }),        // not paid yet
            p({ productId: "plus_monthly", purchaseToken: null }),           // nothing to verify
            p({ productId: "something_else" }),
        ]).map((x) => x.productId);
        expect(sel).toEqual(["plus_monthly", "tokens_100"]);
    });

    it("finishes ONLY what the server confirms", async () => {
        const { d, finished, posted } = deps(
            [p({ productId: "plus_monthly", isAcknowledgedAndroid: false }), p({ productId: "tokens_100" }), p({ productId: "tokens_250" })],
            (b) => b.productId === "plus_monthly" ? [200, { ok: true }] : b.productId === "tokens_100" ? [202, { ok: false, pending: true }] : [400, { ok: false, error: "invalid" }],
        );
        const r = await recoverAndroidPurchases("tok", d);
        expect(posted).toEqual(["plus_monthly", "tokens_100", "tokens_250"]);
        expect(finished).toEqual(["plus_monthly"]);
        expect(r).toEqual({ grantedPlans: 1, grantedCredits: 0, pending: 1, failed: 1 });
        expect(d.initConnection).toHaveBeenCalled();
    });

    it("credit packs are consumed, subscriptions acknowledged", async () => {
        const { d } = deps([p({ productId: "tokens_600" })], () => [200, { ok: true }]);
        const r = await recoverAndroidPurchases("tok", d);
        expect(d.finishTransaction).toHaveBeenCalledWith(expect.objectContaining({ isConsumable: true }));
        expect(r.grantedCredits).toBe(1);
    });

    it("never throws when Billing is unavailable", async () => {
        const d: RecoveryDeps = { initConnection: async () => { throw new Error("no gms"); }, getAvailablePurchases: async () => [], finishTransaction: async () => {}, fetchImpl: fetch };
        await expect(recoverAndroidPurchases("tok", d)).resolves.toEqual({ grantedPlans: 0, grantedCredits: 0, pending: 0, failed: 0 });
    });

    it("does nothing off Android or without a token", async () => {
        (Platform as { OS: string }).OS = "ios";
        const { d } = deps([p({})], () => [200, { ok: true }]);
        await recoverAndroidPurchases("tok", d);
        expect(d.getAvailablePurchases).not.toHaveBeenCalled();
        (Platform as { OS: string }).OS = "android";
        await recoverAndroidPurchases("", d);
        expect(d.getAvailablePurchases).not.toHaveBeenCalled();
    });

    it("runs once per launch", async () => {
        const { d } = deps([], () => [200, { ok: true }]);
        expect(recoverAndroidPurchasesOncePerLaunch("tok", d)).not.toBeNull();
        expect(recoverAndroidPurchasesOncePerLaunch("tok", d)).toBeNull();
    });

    it("'Restore previous plan' on Android sweeps first, then reads the status", () => {
        const fn = block(U, "const handleAndroidRestore = async () => {", "// Keep ref current");
        const sweep = fn.indexOf("await recoverAndroidPurchases(token)");
        const status = fn.indexOf('buildApiUrl("/api/license/status")');
        expect(sweep).toBeGreaterThan(-1);
        expect(status).toBeGreaterThan(sweep);
        expect(fn).toContain("data?.license?.tier");
        // both the signed-in and the sign-in-first paths use it
        expect(U).toMatch(/promptSignIn\(\(\) => \{ void handleAndroidRestore\(\); \}\);/);
        expect(U.split("void handleAndroidRestore();").length - 1).toBe(2);
    });

    it("launch sweep: always-mounted SettingsContext, real accounts only, fire-and-forget, refreshes the licence after a grant", () => {
        const cb = block(SETTINGS, "supabase.auth.onAuthStateChange(\n            async (event, session) => {", "return () => subscription.unsubscribe();");
        const sweep = block(cb, "if (!session.user.is_anonymous && session.access_token && (event === \"SIGNED_IN\" || event === \"INITIAL_SESSION\")) {", ".catch(");
        expect(sweep).toContain("recoverAndroidPurchasesOncePerLaunch(session.access_token)");
        expect(sweep).not.toMatch(/await recoverAndroidPurchasesOncePerLaunch/);
        expect(sweep).toMatch(/if \(r\.grantedPlans \+ r\.grantedCredits === 0\) return;\s*await refreshLicense\(session\);/);
        // no supabase.auth call inside the auth callback (deadlock)
        expect(sweep).not.toContain("supabase.auth.");
    });
});

describe("4 · iOS: a REAL account before paying", () => {
    const fn = block(U, "const handleIosPurchase = async (sku: string, type: \"subs\" | \"in-app\") => {", "purchaseOutcomeHandledRef.current = false;");

    it("no longer passes on a null (still loading) answer", () => {
        expect(fn).not.toMatch(/if \(isSignedInRef\.current === false\) \{/);
        expect(fn).toMatch(/if \(isSignedInRef\.current !== true \|\| !accessTokenRef\.current\) \{\s*promptSignIn\(\(\) => handleIosPurchase\(sku, type\)\);\s*return;/);
    });

    it("waits for the answer first (ref only — no supabase.auth call)", () => {
        const wait = fn.indexOf("await waitForSignedInAnswer()");
        const gate = fn.indexOf("if (isSignedInRef.current !== true");
        expect(wait).toBeGreaterThan(-1);
        expect(gate).toBeGreaterThan(wait);
        const helper = block(U, "const waitForSignedInAnswer = async", "};");
        expect(helper).not.toContain("supabase.auth");
    });

    it("accessTokenRef holds a token only for a real account", () => {
        expect(U.match(/accessTokenRef\.current = isRealAccount\(session\) \? session!\.access_token : null;/g)?.length).toBe(2);
    });
});

describe("5 · email sign-in resumes the purchase", () => {
    it("the email button resumes with the same onSuccess as Google/Apple", () => {
        expect(U).toMatch(/text: "Sign in with email", onPress: \(\) => signInWithEmailThenResume\(onSuccess\)/);
        const fn = block(U, "const signInWithEmailThenResume = (onSuccess: () => void) => {", "const promptSignIn =");
        expect(fn).not.toContain("onClose()");                       // no unmount
        expect(fn).toContain("setHiddenForEmail(true);");
        expect(fn).toContain("onEmailSignInClosed(");
        expect(fn).toMatch(/if \(isSignedInRef\.current === true && accessTokenRef\.current\) setTimeout\(\(\) => onSuccess\(\), \d+\);/);
        expect(fn).toContain("setHiddenForEmail(false);");
    });

    it("the sheet hides its Modal rather than unmounting, and unsubscribes on unmount", () => {
        expect(U).toMatch(/<Modal visible=\{visible && !hiddenForEmail\}/);
        expect(U).toMatch(/useEffect\(\(\) => \(\) => \{ emailResumeCleanupRef\.current\?\.\(\); \}, \[\]\);/);
    });

    it("the email sheet announces it closed, however it closed", () => {
        expect(BUS).toMatch(/export function onEmailSignInClosed\(/);
        expect(EMAIL).toMatch(/if \(wasVisibleRef\.current && !visible\) emailSignInClosed\(\);/);
    });

    it("the bus delivers the close event and can unsubscribe", () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const bus = require("../auth/emailSignInBus") as typeof import("../auth/emailSignInBus");
        const seen: number[] = [];
        const off = bus.onEmailSignInClosed(() => seen.push(1));
        bus.emailSignInClosed();
        off();
        bus.emailSignInClosed();
        expect(seen).toEqual([1]);
    });
});
