// Regression test for src/lib/rtl.ts — guards the real bug found during the
// 2026-08-14 pre-release review: syncI18nManagerFromStoredSettings() read
// parsed.user.preferredLang, but the actual persisted shape (see
// src/state/SettingsContext.tsx's `payload` object) nests it under
// toneContext.user.preferredLang. The wrong path meant RTL never activated,
// and on a device whose OS locale is already ar/he/ur (I18nManager.isRTL
// defaults to true there) it would have force-disabled RTL instead.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";
import { syncI18nManagerFromStoredSettings } from "../lib/rtl";

const STORAGE_KEY = "imotara_settings_v1";

function settingsPayload(preferredLang: string) {
  return JSON.stringify({
    toneContext: { user: { name: "", preferredLang }, companion: { enabled: false } },
  });
}

describe("syncI18nManagerFromStoredSettings", () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it("reads preferredLang from toneContext.user, not a top-level user key", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, settingsPayload("ar"));
    const allowSpy = jest.spyOn(I18nManager, "allowRTL").mockImplementation(() => {});
    const forceSpy = jest.spyOn(I18nManager, "forceRTL").mockImplementation(() => {});
    Object.defineProperty(I18nManager, "isRTL", { value: false, configurable: true });

    await syncI18nManagerFromStoredSettings();

    expect(allowSpy).toHaveBeenCalledWith(true);
    expect(forceSpy).toHaveBeenCalledWith(true);
  });

  it("does not toggle RTL for a non-RTL language", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, settingsPayload("en"));
    const forceSpy = jest.spyOn(I18nManager, "forceRTL").mockImplementation(() => {});
    Object.defineProperty(I18nManager, "isRTL", { value: false, configurable: true });

    await syncI18nManagerFromStoredSettings();

    expect(forceSpy).not.toHaveBeenCalled();
  });

  it("does not toggle RTL when isRTL already matches the target language", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, settingsPayload("he"));
    const forceSpy = jest.spyOn(I18nManager, "forceRTL").mockImplementation(() => {});
    Object.defineProperty(I18nManager, "isRTL", { value: true, configurable: true });

    await syncI18nManagerFromStoredSettings();

    expect(forceSpy).not.toHaveBeenCalled();
  });

  it("does nothing when no settings are stored yet", async () => {
    const forceSpy = jest.spyOn(I18nManager, "forceRTL").mockImplementation(() => {});
    await syncI18nManagerFromStoredSettings();
    expect(forceSpy).not.toHaveBeenCalled();
  });
});
