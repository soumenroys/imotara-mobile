import fs from "fs";
import path from "path";

/**
 * https://www.imotara.com/open/* is claimed as a verified link (app.json
 * intentFilters + associatedDomains). Until 26 Oct 2026 the navigator only knew
 * imotara://, so an /open link opened the app on whatever screen it was on.
 */
const root = path.join(__dirname, "..", "..");
const nav = fs.readFileSync(path.join(root, "src/navigation/RootNavigator.tsx"), "utf8");
const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;

describe("an /open link opens the matching screen", () => {
    it("the navigator knows the https /open prefix", () => {
        expect(nav).toMatch(/prefixes: \["imotara:\/\/", "https:\/\/www\.imotara\.com\/open"\]/);
    });

    it("…which is exactly the path the app claims on both platforms", () => {
        const data = app.android.intentFilters[0].data;
        expect(data).toContainEqual({ scheme: "https", host: "www.imotara.com", pathPrefix: "/open" });
        expect(app.ios.associatedDomains).toContain("applinks:www.imotara.com");
    });

    it("chat, history, settings and connect are routable", () => {
        for (const s of ['Chat: "chat"', 'History: "history"', 'Settings: "settings"', 'Connect: "connect"']) expect(nav).toContain(s);
    });
});
