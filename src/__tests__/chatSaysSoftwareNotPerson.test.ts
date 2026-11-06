import fs from "fs";
import path from "path";
import { openingGreeting, OPENING_GREETING } from "../lib/welcome/openingGreeting";

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * 🔑 Owner, 30 Oct 2026: the chat must say that no person writes the replies.
 * 🔄 Owner, 6 Nov 2026 (testing 1.6.3): the line under the box "looks so
 * artificial" ⇒ said ONCE, as the chat's opening greeting, in the person's own
 * language (all 22), and nothing under the box. Same table as the website.
 */
describe("the chat says who is replying — in its opening greeting", () => {
  it("the owner's words in English, with the companion's own name", () => {
    expect(openingGreeting()).toBe("I'm Imotara — a private companion. My replies come from software, so you can say anything.");
    expect(openingGreeting("Mira", "en")).toContain("I'm Mira — a private companion.");
  });

  it("in the person's own language — all 22, each naming the companion once", () => {
    expect(Object.keys(OPENING_GREETING).sort()).toEqual(["ar","bn","de","en","es","fr","gu","he","hi","id","ja","kn","ml","mr","or","pa","pt","ru","ta","te","ur","zh"]);
    for (const [k, t] of Object.entries(OPENING_GREETING)) expect([k, t.split("{name}").length - 1]).toEqual([k, 1]);
    expect(openingGreeting("Mira", "bn")).toMatch(/^আমি Mira — /);
    expect(openingGreeting(null, "xx")).toBe(openingGreeting(null, "en"));
  });

  it("shown first in the chat list, in the chosen language", () => {
    expect(read("src/screens/ChatScreen.tsx")).toMatch(/openingGreeting\(effectiveCompanionName, welcomeLang\(toneContext\?\.user\?\.preferredLang\)\)/);
  });

  it("⛔ nothing under the box any more", () => {
    expect(read("src/components/chat/ChatInputBar.tsx")).not.toContain("Replies come from software");
  });
});
