// UX-19. The app defaulted to dark and never asked the phone, so anyone whose
// device is in light mode opened a dark app and had to go find the setting.
//
// The two things worth pinning are the two judgement calls: what an unknown
// system value means, and what happens to people who are ALREADY using the app.

import { resolveThemeMode, initialThemePref, appearanceOverride } from "../theme/themeMode";

describe("resolveThemeMode", () => {
  it("follows the device when the pref is system", () => {
    expect(resolveThemeMode("system", "light")).toBe("light");
    expect(resolveThemeMode("system", "dark")).toBe("dark");
  });

  it("treats an unknown device value as dark, not light", () => {
    // Guessing light on no information would visibly change the app for
    // someone on the strength of nothing.
    expect(resolveThemeMode("system", null)).toBe("dark");
    expect(resolveThemeMode("system", undefined)).toBe("dark");
  });

  it("ignores the device once the person has chosen", () => {
    expect(resolveThemeMode("light", "dark")).toBe("light");
    expect(resolveThemeMode("dark", "light")).toBe("dark");
    expect(resolveThemeMode("light", null)).toBe("light");
  });
});

describe("initialThemePref — existing users must not be flipped", () => {
  it("a fresh install follows the device", () => {
    expect(initialThemePref([])).toBe("system");
  });

  it("an install that has used Imotara keeps dark", () => {
    // The regression this guards: someone who has been using a dark app for
    // months should not open it one day to find it light because their phone
    // was always light and they never touched the theme setting.
    expect(initialThemePref(["imotara.accent.v1"])).toBe("dark");
    expect(initialThemePref(["imotara.chat.bookmarks.v1", "something.else"])).toBe("dark");
  });

  it("keys from other apps do not count as an existing Imotara install", () => {
    expect(initialThemePref(["someotherapp.foo", "rn.async.storage"])).toBe("system");
  });
});

// The Appearance override is what makes native dialogs follow the person's
// choice instead of the phone's. The "system" case is the one that matters:
// useColorScheme() reports the override back, so pinning a value here would
// feed our own answer in as the phone's and strand a later "follow my phone".
describe("appearanceOverride", () => {
    it("hands an explicit choice straight through", () => {
        expect(appearanceOverride("dark")).toBe("dark");
        expect(appearanceOverride("light")).toBe("light");
    });

    it("returns null for system, so the OS keeps control", () => {
        expect(appearanceOverride("system")).toBeNull();
    });

    it("never returns a resolved mode for system, whatever the OS says", () => {
        // Guards the feedback loop: if this ever returned "dark"/"light" for
        // system, switching back to system would stick on the last override.
        for (const _ of ["light", "dark"] as const) {
            expect(appearanceOverride("system")).not.toBe("dark");
            expect(appearanceOverride("system")).not.toBe("light");
        }
    });
});
