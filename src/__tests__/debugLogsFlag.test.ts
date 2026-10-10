/**
 * A device failure has to leave a trace.
 *
 * 🔴 2026-10-10: a reply on a physical iPhone fell back to on-device mode and
 * the app claimed the device had gone offline. Diagnosing it meant reading
 * code, because there was no log to read: debugLog / debugWarn are no-ops in a
 * production build unless EXPO_PUBLIC_IMOTARA_DEBUG_UI is set, and NO EAS
 * profile set it. ChatScreen computes `remoteStatus` — the one number that
 * would have named the failure — and threw it away on every build ever
 * shipped to a device.
 *
 * ⚠️ That flag could not just be switched on: it also renders debug-only UI
 * (a HistoryScreen panel, compatibility metadata on chat bubbles), so enabling
 * it would change what the person testing sees. Hence a separate switch.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "fs";
import path from "path";

const EAS = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "eas.json"), "utf8"),
) as { build: Record<string, { env?: Record<string, string> }> };

const envOf = (p: string) => EAS.build[p]?.env ?? {};
const logs = (p: string) => envOf(p).EXPO_PUBLIC_IMOTARA_DEBUG_LOGS;
const ui = (p: string) => envOf(p).EXPO_PUBLIC_IMOTARA_DEBUG_UI;

describe("🔑 device builds used for testing must be diagnosable", () => {
  it("the internal profile writes logs", () => {
    // This is the profile installed on the physical iPhone.
    expect(logs("internal")).toBe("true");
  });

  it("⛔ …without turning on debug UI, which would change what is tested", () => {
    expect(ui("internal")).toBeUndefined();
  });
});

describe("⛔ store builds stay quiet", () => {
  it("production enables neither", () => {
    // These logs include reply text — the person's own conversation. It never
    // leaves the device, but a store build has no reason to write it out.
    expect(logs("production")).toBeUndefined();
    expect(ui("production")).toBeUndefined();
  });

  it("TestFlight enables neither", () => {
    expect(logs("iosTestflight")).toBeUndefined();
    expect(ui("iosTestflight")).toBeUndefined();
  });

  it("every profile is accounted for, so a new one cannot slip through", () => {
    // If a profile is added, this fails and forces a decision about it.
    expect(Object.keys(EAS.build).sort())
      .toEqual(["internal", "iosSimulator", "iosTestflight", "production"]);
  });
});

describe("⚠️ the existing behaviour, unchanged where the flag is unset", () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => { jest.resetModules(); });
  afterEach(() => { process.env = { ...ORIGINAL }; });

  /**
   * Load config/debug fresh under a given environment.
   *
   * ⚠️ `dev` is explicit. Under Jest `global.__DEV__` is true, which made two
   * assertions here vacuous: a mutation that switched debug UI on from the
   * LOGS flag survived, because every expected value was already true for
   * reasons unrelated to the code. Production is the case that matters, and
   * it is only reachable by pinning this.
   */
  const load = (env: Record<string, string | undefined>, dev = true) => {
    (global as unknown as { __DEV__: boolean }).__DEV__ = dev;
    // ⚠️ Per CALL, not per test. Without this the second require() inside one
    // test returns the module cached from the first, so the assertions ran
    // against stale values and the loop below silently proved nothing.
    jest.resetModules();
    for (const k of ["EXPO_PUBLIC_IMOTARA_DEBUG_LOGS", "EXPO_PUBLIC_IMOTARA_DEBUG_UI",
                     "IMOTARA_DEBUG_LOGS", "IMOTARA_DEBUG_UI"]) {
      delete process.env[k];
    }
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../config/debug") as typeof import("../config/debug");
  };

  it("with nothing set, logging follows DEBUG_UI_ENABLED exactly as before", () => {
    const m = load({});
    expect(m.DEBUG_LOGS_ENABLED).toBe(m.DEBUG_UI_ENABLED);
  });

  it("the old flag alone still enables logs — nothing regressed for it", () => {
    const m = load({ EXPO_PUBLIC_IMOTARA_DEBUG_UI: "true" });
    expect(m.DEBUG_UI_ENABLED).toBe(true);
    expect(m.DEBUG_LOGS_ENABLED).toBe(true);
  });

  it("the old flag off still silences logs", () => {
    const m = load({ EXPO_PUBLIC_IMOTARA_DEBUG_UI: "false" });
    expect(m.DEBUG_LOGS_ENABLED).toBe(false);
  });

  it("🔑 the new flag enables logs WITHOUT enabling debug UI", () => {
    // The whole point of splitting them. ⚠️ DEBUG_UI is pinned explicitly
    // off rather than left to default: under Jest `__DEV__` is true, so an
    // unset DEBUG_UI is true here for reasons that have nothing to do with
    // the code being tested.
    const m = load({
      EXPO_PUBLIC_IMOTARA_DEBUG_LOGS: "true",
      EXPO_PUBLIC_IMOTARA_DEBUG_UI: "false",
    });
    expect(m.DEBUG_LOGS_ENABLED).toBe(true);
    expect(m.DEBUG_UI_ENABLED).toBe(false);
  });

  it("⛔ …and the new flag never switches debug UI on by itself", () => {
    // In a PRODUCTION build with only the logs flag set: logs on, UI off.
    // This is the exact shape of the internal profile, and the only
    // configuration in which the two flags can be told apart.
    const m = load({ EXPO_PUBLIC_IMOTARA_DEBUG_LOGS: "true" }, false);
    expect(m.DEBUG_LOGS_ENABLED).toBe(true);
    expect(m.DEBUG_UI_ENABLED).toBe(false);
  });

  it("a production build with no flags logs nothing and shows nothing", () => {
    const m = load({}, false);
    expect(m.DEBUG_LOGS_ENABLED).toBe(false);
    expect(m.DEBUG_UI_ENABLED).toBe(false);
  });

  it("the new flag can also silence logs while debug UI stays on", () => {
    const m = load({
      EXPO_PUBLIC_IMOTARA_DEBUG_LOGS: "false",
      EXPO_PUBLIC_IMOTARA_DEBUG_UI: "true",
    });
    expect(m.DEBUG_LOGS_ENABLED).toBe(false);
    expect(m.DEBUG_UI_ENABLED).toBe(true);
  });

  it("accepts the same boolean spellings as the existing flag", () => {
    for (const v of ["1", "yes", "y", "on", "TRUE", "true"]) {
      expect(load({ EXPO_PUBLIC_IMOTARA_DEBUG_LOGS: v }).DEBUG_LOGS_ENABLED,
      ).toBe(true);
    }
    for (const v of ["0", "no", "n", "off", "FALSE", "false"]) {
      expect(load({ EXPO_PUBLIC_IMOTARA_DEBUG_LOGS: v }).DEBUG_LOGS_ENABLED,
      ).toBe(false);
    }
  });

  it("a nonsense value falls back rather than throwing", () => {
    // This file must never throw — it is imported by almost everything.
    const m = load({ EXPO_PUBLIC_IMOTARA_DEBUG_LOGS: "maybe" });
    expect(m.DEBUG_LOGS_ENABLED).toBe(m.DEBUG_UI_ENABLED);
  });
});

describe("🔑 the helpers actually write when enabled", () => {
  const ORIGINAL = { ...process.env };
  afterEach(() => { process.env = { ...ORIGINAL }; });

  const loadWith = (logsOn: boolean) => {
    jest.resetModules();
    (global as unknown as { __DEV__: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_IMOTARA_DEBUG_LOGS = logsOn ? "true" : "false";
    delete process.env.EXPO_PUBLIC_IMOTARA_DEBUG_UI;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../config/debug") as typeof import("../config/debug");
  };

  it("debugLog reaches console.log when logging is on", () => {
    // Without this the flag could be perfectly correct and the helper still
    // a no-op — which is the state the whole report exposed.
    const m = loadWith(true);
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    m.debugLog("hello", 1);
    expect(spy).toHaveBeenCalledWith("hello", 1);
    spy.mockRestore();
  });

  it("debugWarn reaches console.warn when logging is on", () => {
    const m = loadWith(true);
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    m.debugWarn("careful");
    expect(spy).toHaveBeenCalledWith("careful");
    spy.mockRestore();
  });

  it("⛔ and both stay silent when logging is off", () => {
    const m = loadWith(false);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    m.debugLog("x");
    m.debugWarn("y");
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    log.mockRestore();
    warn.mockRestore();
  });
});

describe("the status that was being discarded is actually logged", () => {
  it("ChatScreen records remoteStatus on a failed cloud reply", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/ChatScreen.tsx"), "utf8");
    expect(src).toMatch(/debugLog\("\[imotara\] remote:"/);
    expect(src).toMatch(/remoteStatus/);
  });
});
