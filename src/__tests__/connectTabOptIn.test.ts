/**
 * #108 (owner, 22 Nov 2026): "add a setting with selected as off. if user check it on, only then
 * connect will be shown" — web, Android and iOS, OFF by default.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { SETTINGS_CATALOG } from "../data/settingsCatalog";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const ctx = read("state/SettingsContext.tsx");
const nav = read("navigation/RootNavigator.tsx");
const screen = read("screens/SettingsScreen.tsx");

describe("Show Connect — off by default", () => {
  it("starts OFF and a stored value that is missing or unreadable stays OFF", () => {
    expect(ctx).toMatch(/const \[showConnect, _setShowConnect\] = useState\(false\)/);
    expect(ctx).toMatch(/_setShowConnect\(safeBool\(\(parsed as any\)\.showConnect, false\)\)/);
  });

  it("is saved with the other settings and re-saved when it changes", () => {
    const payload = ctx.slice(ctx.indexOf("const payload = {"), ctx.indexOf("AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload))"));
    expect(payload).toMatch(/\bshowConnect,/);
    const deps = ctx.slice(ctx.indexOf("AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload))"), ctx.indexOf("// ---- Wrapped setters"));
    expect(deps).toMatch(/\bshowConnect,/);
  });

  it("the Connect tab button is hidden unless the switch is on — the screen stays registered", () => {
    const tab = nav.slice(nav.indexOf('name="Connect"'), nav.indexOf('name="Settings"'));
    expect(tab).toContain("component={ConnectScreen}");
    expect(tab).toMatch(/showConnect \? \{\} : \{ tabBarButton: \(\) => null, tabBarItemStyle: \{ display: "none"/);
    expect(nav).toMatch(/showConnect \} = useSettings\(\)/);
  });

  it("Settings has the switch, and Settings search finds it", () => {
    expect(screen).toMatch(/value=\{!!showConnect\}\s*onValueChange=\{setShowConnect\}/);
    const entry = SETTINGS_CATALOG.find((e) => e.id === "show_connect");
    expect(entry?.sectionKey).toBe("advanced");
    expect(entry?.keywords).toContain("connect");
  });
});
