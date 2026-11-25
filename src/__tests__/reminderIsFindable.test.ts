/**
 * Dec release pass (25 Nov 2026): searching Settings for "reminder" found only
 * "Reminder sound" — the daily check-in reminder itself (the one the chat's
 * "Choose a time" sends people to find) had no search entry.
 */
import { SETTINGS_CATALOG } from "../data/settingsCatalog";

describe("the daily check-in reminder can be found by search", () => {
  const entry = SETTINGS_CATALOG.find((e) => e.id === "checkin_reminder");
  it("has its own entry in the Experience section", () => {
    expect(entry?.title).toBe("Daily check-in reminder");
    expect(entry?.sectionKey).toBe("experience");
  });
  it("is found by the words people type", () => {
    for (const w of ["reminder", "remind me", "notification", "reminder time"])
      expect(entry?.keywords).toContain(w);
  });
});

import { searchSettingsLocally } from "../data/settingsCatalog";
describe("…and it comes FIRST", () => {
  it.each(["reminder", "remind me", "reminder time"])("'%s' → the reminder is the top result", (q) => {
    expect(searchSettingsLocally(q, 5)[0]?.id).toBe("checkin_reminder");
  });
});
