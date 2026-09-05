// src/__tests__/haptics.test.ts
// UX-07. The old implementation used RN's Vibration API for everything. On iOS
// that never reaches the Taptic Engine and vibration PATTERNS are dropped
// entirely, so the off/light/strong control in Settings was wired to nothing
// for every iPhone user. These tests pin the two things that were wrong: that
// iOS goes through expo-haptics at all, and that "off" really is silent.

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

// Named `mockVibrate` because jest.mock factories may only reference
// out-of-scope variables whose names begin with "mock".
const mockVibrate = jest.fn();
jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Vibration: { vibrate: (...a: unknown[]) => mockVibrate(...a) },
}));

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Imported after the mocks so the module picks them up.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { haptic, setHapticIntensity, getHapticIntensity } = require("../lib/haptics");

const impact = Haptics.impactAsync as jest.Mock;
const notify = Haptics.notificationAsync as jest.Mock;

beforeEach(() => {
  impact.mockClear(); notify.mockClear(); mockVibrate.mockClear();
  (Platform as { OS: string }).OS = "ios";
  setHapticIntensity("light");
});

describe("the setting is honoured", () => {
  it("does nothing at all when off", () => {
    setHapticIntensity("off");
    haptic.tap(); haptic.receive(); haptic.error();
    expect(impact).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it("ignores a value that is not one of the three", () => {
    setHapticIntensity("light");
    setHapticIntensity("VERY STRONG");
    expect(getHapticIntensity()).toBe("light");
  });

  it("survives a missing stored value", () => {
    setHapticIntensity("strong");
    setHapticIntensity(null);
    expect(getHapticIntensity()).toBe("strong");
  });
});

describe("iOS reaches the Taptic Engine — the actual bug", () => {
  it("tap uses an impact, never Vibration", () => {
    haptic.tap();
    expect(impact).toHaveBeenCalledWith("light");
    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it("strong tap is a heavier impact", () => {
    setHapticIntensity("strong");
    haptic.tap();
    expect(impact).toHaveBeenCalledWith("heavy");
  });

  it("receive and error use patterned feedback on strong", () => {
    setHapticIntensity("strong");
    haptic.receive();
    expect(notify).toHaveBeenCalledWith("success");
    notify.mockClear();
    haptic.error();
    expect(notify).toHaveBeenCalledWith("error");
  });

  it("light receive is a plain impact, not a notification", () => {
    haptic.receive();
    expect(impact).toHaveBeenCalledWith("light");
    expect(notify).not.toHaveBeenCalled();
  });

  it("a rejected haptic never escapes", async () => {
    // No haptic hardware, or the user disabled system haptics. Sending a
    // message must not become an unhandled rejection.
    impact.mockImplementationOnce(() => Promise.reject(new Error("no hardware")));
    expect(() => haptic.tap()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe("Android keeps what already worked", () => {
  beforeEach(() => { (Platform as { OS: string }).OS = "android"; });

  it("still uses Vibration, not expo-haptics", () => {
    haptic.tap();
    expect(mockVibrate).toHaveBeenCalledWith(10);
    expect(impact).not.toHaveBeenCalled();
  });

  it("keeps the tuned patterns", () => {
    haptic.receive();
    expect(mockVibrate).toHaveBeenCalledWith([0, 8, 40, 8]);
    mockVibrate.mockClear();
    setHapticIntensity("strong");
    haptic.error();
    expect(mockVibrate).toHaveBeenCalledWith([0, 50, 80, 50]);
  });
});
