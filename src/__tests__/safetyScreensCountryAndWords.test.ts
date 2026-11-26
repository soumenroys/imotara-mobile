// Dec release check (26 Nov 2026), owner chose "fix all three now":
//  1. the under-13 screen and the welcome screen ask our server for the country
//     (no reply has happened yet, so they fell back to the phone's locale / nothing);
//  2. "Emergency" is said in the person's language;
//  3. the Bengali under-13 help line uses তুমি like the rest of that screen.
import * as fs from "fs";
import * as path from "path";
import { emergencyLabel, EMERGENCY_LABEL_LANGS } from "../lib/safety/emergencyLabel";
import { getUnderAgeCopy } from "../lib/age/underAgeCopy";
import { getConsentCopy } from "../lib/legal/consentCopy";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
    },
  };
});

const src = (f: string) => fs.readFileSync(path.join(__dirname, "..", f), "utf8").replace(/\/\/.*$/gm, "");

describe("1. the country comes from our server before any reply", () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it("refreshServerCountry asks /api/geo/country and the answer wins over the locale", async () => {
    const mod = require("../lib/safety/resolveCrisisCountry");
    mod.__resetCrisisCountryCacheForTests();
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      calls.push(String(url));
      return { ok: true, json: async () => ({ country: "gb" }) } as any;
    }) as any;
    expect(await mod.refreshServerCountry()).toBe("GB");
    expect(calls[0]).toMatch(/\/api\/geo\/country$/);
    expect(mod.resolveCrisisCountry()).toBe("GB");
    expect(mod.crisisCountrySource()).toBe("server");
  });

  it("a Settings choice still wins over the server", async () => {
    const mod = require("../lib/safety/resolveCrisisCountry");
    mod.__resetCrisisCountryCacheForTests();
    await mod.setCrisisCountryOverride("US");
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ country: "GB" }) })) as any;
    await mod.refreshServerCountry();
    expect(mod.resolveCrisisCountry()).toBe("US");
  });

  it("offline or a bad answer changes nothing and never throws", async () => {
    const mod = require("../lib/safety/resolveCrisisCountry");
    mod.__resetCrisisCountryCacheForTests();
    global.fetch = jest.fn(async () => { throw new Error("offline"); }) as any;
    await expect(mod.refreshServerCountry()).resolves.toBeNull();
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ country: null }) })) as any;
    await expect(mod.refreshServerCountry()).resolves.toBeNull();
    expect(mod.crisisCountrySource()).toBe("locale");
  });

  it("both pre-reply screens use the hook that asks", () => {
    expect(src("components/age/AgeSignalGate.tsx")).toContain("const country = useCrisisCountry();");
    const consent = src("components/legal/ConsentGate.tsx");
    expect(consent).toContain("const askedCountry = useCrisisCountry();");
    expect(consent).toContain("getCrisisResourcesForCountry(countryCode ?? askedCountry)");
  });

  it("the hook shows the stored/locale answer first and never waits to render", () => {
    const hook = src("lib/safety/useCrisisCountry.ts");
    expect(hook).toContain("useState<string | null>(resolveCrisisCountry())");
    expect(hook.indexOf("hydrateCrisisCountry()")).toBeLessThan(hook.indexOf("refreshServerCountry()"));
  });
});

describe("2. 'Emergency' in the person's language", () => {
  const consentLangs = fs
    .readFileSync(path.join(__dirname, "../lib/legal/consentCopy.ts"), "utf8")
    .match(/^\s+([a-z]{2}): \{ title/gm)!
    .map((l) => l.trim().slice(0, 2));

  it("covers every language the welcome screen speaks", () => {
    expect(consentLangs.length).toBe(22);
    for (const l of consentLangs) expect(EMERGENCY_LABEL_LANGS).toContain(l);
  });

  it("is never the English word outside English", () => {
    for (const l of consentLangs.filter((l) => l !== "en")) expect(emergencyLabel(l)).not.toBe("Emergency");
    expect(emergencyLabel("bn-IN")).toBe("জরুরি পরিষেবা");
    expect(emergencyLabel(undefined)).toBe("Emergency");
  });

  it("both screens print the localized label for the emergency line", () => {
    expect(src("components/age/AgeSignalGate.tsx")).toContain("label: emergencyLabel(lang)");
    expect(src("components/legal/ConsentGate.tsx")).toContain("emergencyLabel(lang)} ${emergency.contact}");
  });
});

describe("3. one register on the child's screen", () => {
  it("Bengali help line speaks to the child with তুমি, like the body", () => {
    const bn = getUnderAgeCopy("bn");
    expect(bn.body).toContain("তুমি");
    expect(bn.emergencyLead).toContain("তুমি");
    expect(bn.emergencyLead).not.toContain("আপনি");
  });

  it("Hindi keeps आप in both — no override needed", () => {
    const hi = getUnderAgeCopy("hi");
    expect(hi.body).toContain("आप");
    expect(hi.emergencyLead).toBeUndefined();
    expect(getConsentCopy("hi").emergencyLead).toContain("आप");
  });

  it("the screen prefers its own line, else the consent line", () => {
    expect(src("components/age/AgeSignalGate.tsx")).toContain("{copy.emergencyLead ?? help.emergencyLead}");
  });
});
