// #159 — the OS age signal. Every branch that could lock an adult out, or let
// an under-13 in, is pinned here.
import fs from "fs";
import path from "path";
import {
    AGE_ASKED_KEY,
    REASK_AFTER_MS,
    nextStoredVerdict,
    readAgeVerdict,
    verdictFromRange,
    type AgeRangeApi,
} from "../lib/age/ageSignals";
import { getUnderAgeCopy } from "../lib/age/underAgeCopy";

function memStore(init: Record<string, string> = {}) {
    const m: Record<string, string> = { ...init };
    return {
        m,
        getItem: async (k: string) => (k in m ? m[k] : null),
        setItem: async (k: string, v: string) => {
            m[k] = v;
        },
    } as any;
}

function api(over: Partial<AgeRangeApi> = {}): AgeRangeApi & { calls: string[] } {
    const calls: string[] = [];
    return {
        calls,
        requestAgeRangeAsync: async () => {
            calls.push("range");
            return { lowerBound: 13, upperBound: 15 };
        },
        getRequiredRegulatoryFeaturesAsync: async () => {
            calls.push("features");
            return ["declaredAgeRangeRequired"];
        },
        requestAgeSignalsAccessAsync: async () => {
            calls.push("access");
            return "SHARED";
        },
        ...over,
    } as any;
}

describe("verdictFromRange", () => {
    it.each([
        [null, 12, "under13"],
        [0, 12, "under13"],
        [13, 15, "teen"],
        [16, 17, "teen"],
        [13, 17, "teen"],
        [18, null, "adult"],
        [21, null, "adult"],
        // ⛔ not proof either way
        [0, 15, "unknown"],
        [13, null, "unknown"],
        [null, null, "unknown"],
        [undefined, undefined, "unknown"],
    ] as const)("%s–%s ⇒ %s", (lo, hi, want) => {
        expect(verdictFromRange(lo as any, hi as any)).toBe(want);
    });
});

describe("readAgeVerdict — Android", () => {
    it("asks for access first, and reads the band only when SHARED", async () => {
        const a = api();
        expect(await readAgeVerdict(a, { os: "android", store: memStore() })).toBe("teen");
        expect(a.calls).toEqual(["access", "range"]);
    });

    it("NOT_SHARED ⇒ unknown, remembered so we don't re-prompt every launch", async () => {
        const store = memStore();
        const a = api({ requestAgeSignalsAccessAsync: async () => "NOT_SHARED" });
        expect(await readAgeVerdict(a, { os: "android", store, now: 1000 })).toBe("unknown");
        expect(store.m[AGE_ASKED_KEY]).toBe("1000");
        const b = api();
        expect(await readAgeVerdict(b, { os: "android", store, now: 1000 + 60_000 })).toBe("unknown");
        expect(b.calls).toEqual([]); // not asked again
        const c = api();
        expect(await readAgeVerdict(c, { os: "android", store, now: 1000 + REASK_AFTER_MS + 1 })).toBe("teen");
    });

    it("VERIFICATION_REQUIRED / null / error ⇒ unknown, never blocks", async () => {
        for (const s of ["VERIFICATION_REQUIRED", null] as const) {
            expect(await readAgeVerdict(api({ requestAgeSignalsAccessAsync: async () => s }), { os: "android", store: memStore() })).toBe("unknown");
        }
        const boom = api({ requestAgeSignalsAccessAsync: async () => { throw new Error("-1"); } });
        expect(await readAgeVerdict(boom, { os: "android", store: memStore() })).toBe("unknown");
    });

    it("a hung OS call times out to unknown", async () => {
        const hang = api({ requestAgeSignalsAccessAsync: () => new Promise(() => {}) });
        expect(await readAgeVerdict(hang, { os: "android", store: memStore(), timeoutMs: 20 })).toBe("unknown");
    });
});

describe("readAgeVerdict — iOS", () => {
    it("asks only when the OS says the age range is required", async () => {
        const a = api({ requestAgeRangeAsync: async () => ({ lowerBound: null, upperBound: 12 }) });
        expect(await readAgeVerdict(a, { os: "ios", store: memStore() })).toBe("under13");
        expect(a.calls).toEqual(["features"]);
    });

    it("⛔ older iOS (features null) never asks — its default '18' is not a verified adult", async () => {
        const a = api({ getRequiredRegulatoryFeaturesAsync: async () => null, requestAgeRangeAsync: async () => ({ lowerBound: 18, upperBound: null }) });
        expect(await readAgeVerdict(a, { os: "ios", store: memStore() })).toBe("unknown");
    });

    it("not required in this region ⇒ unknown, no prompt", async () => {
        const a = api({ getRequiredRegulatoryFeaturesAsync: async () => [] });
        const r = await readAgeVerdict(a, { os: "ios", store: memStore() });
        expect(r).toBe("unknown");
    });

    it("web / other ⇒ unknown", async () => {
        expect(await readAgeVerdict(api(), { os: "web", store: memStore() })).toBe("unknown");
    });
});

describe("nextStoredVerdict", () => {
    it("an unknown read keeps a known answer; a fresh known answer replaces it", () => {
        expect(nextStoredVerdict("under13", "unknown")).toBe("under13");
        expect(nextStoredVerdict("under13", "teen")).toBe("teen");
        expect(nextStoredVerdict(null, "unknown")).toBe(null);
        expect(nextStoredVerdict(null, "adult")).toBe("adult");
    });
});

describe("wiring", () => {
    const root = path.join(__dirname, "..", "..");
    const app = fs.readFileSync(path.join(root, "App.tsx"), "utf8");

    it("the age gate sits inside the consent gate and outside every provider", () => {
        const consent = app.indexOf("<ConsentGateMount>");
        const gate = app.indexOf("<AgeSignalGate>");
        const auth = app.indexOf("<AuthProvider>");
        expect(consent).toBeGreaterThan(-1);
        expect(gate).toBeGreaterThan(consent);
        expect(auth).toBeGreaterThan(gate);
        expect(app.indexOf("</AgeSignalGate>")).toBeLessThan(app.indexOf("</ConsentGateMount>"));
    });

    it("teen sync is inside SettingsProvider", () => {
        const i = app.indexOf("<AgeSignalTeenSync />");
        expect(i).toBeGreaterThan(app.indexOf("<SettingsProvider>"));
        expect(i).toBeLessThan(app.indexOf("</SettingsProvider>"));
    });

    it("iOS entitlement is declared", () => {
        const cfg = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
        expect(cfg.expo.ios.entitlements["com.apple.developer.declared-age-range"]).toBe(true);
    });

    it("🔒 the band is never sent anywhere — no fetch in the age code", () => {
        for (const f of ["src/lib/age/ageSignals.ts", "src/components/age/AgeSignalGate.tsx", "src/components/age/AgeSignalTeenSync.tsx"]) {
            // code only — the comments are allowed to SAY "never sent to analytics"
            const src = fs.readFileSync(path.join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
            expect(src).not.toMatch(/\bfetch\(|\btrack\w*\(|analytics|IMOTARA_API_BASE_URL/i);
        }
    });

    it("the stop screen shows crisis help (shared resources, not hard-coded)", () => {
        const src = fs.readFileSync(path.join(root, "src/components/age/AgeSignalGate.tsx"), "utf8");
        expect(src).toMatch(/getCrisisResourcesForCountry\(/);
        expect(src).toMatch(/emergencyLead/);
    });

    it("stop copy falls back to English, never empty", () => {
        expect(getUnderAgeCopy("xx").title).toMatch(/13/);
        expect(getUnderAgeCopy("bn-IN").title).toMatch(/১৩/);
    });
});
