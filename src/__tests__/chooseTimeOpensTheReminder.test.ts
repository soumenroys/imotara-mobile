// Dec release check (26 Nov 2026): the check-in invite's "Choose a time" opened Settings at the
// TOP, and Settings search stopped at the section header — the reminder was further down.
import * as fs from "fs";
import * as path from "path";
import { SETTINGS_CATALOG } from "../data/settingsCatalog";

const read = (f: string) =>
  fs.readFileSync(path.join(__dirname, "..", f), "utf8").replace(/\/\/.*$/gm, "");
const settings = read("screens/SettingsScreen.tsx");
const chat = read("screens/ChatScreen.tsx");

describe("Choose a time lands on the reminder", () => {
  it("the invite asks Settings for the reminder itself", () => {
    expect(chat).toMatch(/onChooseTime=\{\(\) => \{ retire\(\); navigation\.navigate\("Settings", \{ focus: "checkin_reminder" \}\); \}\}/);
  });

  it("Settings reads the focus param, opens that setting, then clears it", () => {
    expect(settings).toContain("route?.params?.focus");
    const effect = settings.slice(settings.indexOf("const focusId"));
    expect(effect).toMatch(/handleSearchSelect\(entry\.sectionKey, entry\.id\)/);
    expect(effect).toMatch(/setParams\?\.\(\{ focus: undefined \}\)/);
  });

  it("search and focus scroll to the item when it has a ref, else to its section", () => {
    expect(settings).toMatch(/\(settingId \? itemRefs\.current\[settingId\] : null\) \?\? sectionRefs\.current\[sectionKey\]/);
  });

  it.each(["checkin_reminder", "show_connect"])("%s has a scroll target and a catalog entry", (id) => {
    expect(settings).toContain(`ref={itemRef("${id}")}`);
    expect(SETTINGS_CATALOG.some((e) => e.id === id)).toBe(true);
  });

  it("the reminder target wraps the reminder card (not some other card)", () => {
    const i = settings.indexOf('ref={itemRef("checkin_reminder")}');
    expect(settings.slice(i, i + 800)).toContain("Daily check-in reminder");
    const j = settings.indexOf('ref={itemRef("show_connect")}');
    expect(settings.slice(j, j + 600)).toContain("Show Connect");
  });
});
