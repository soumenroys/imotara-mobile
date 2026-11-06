import fs from "fs";
import path from "path";
import { CONSENT_COPY_BY_LANG } from "../lib/legal/consentCopy";

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * 🔑 Owner, 30 Oct 2026: the app must say that no person writes the replies.
 * 🔄 Owner, 6 Nov 2026 (testing 1.6.3): the line under the chat box "looks so
 * artificial" ⇒ said ONCE, on the first-visit WELCOME screen, in the person's
 * own language and the screen's own voice — and nothing under the box.
 * ⚠️ Owner chose first visit only; advised that some places expect a repeated
 * reminder (decision recorded 6 Nov 2026). Same copy as the website.
 */
describe("the welcome screen says who writes the replies", () => {
  it("every language has the line, and it names software", () => {
    expect(Object.keys(CONSENT_COPY_BY_LANG)).toHaveLength(22);
    for (const [k, c] of Object.entries(CONSENT_COPY_BY_LANG)) expect([k, c.software.length > 10]).toEqual([k, true]);
    expect(CONSENT_COPY_BY_LANG.en.software).toBe("Its replies come from software, so you can say anything.");
  });

  it("the welcome screen shows it under the 'not a therapist' line", () => {
    const gate = read("src/components/legal/ConsentGate.tsx");
    expect(gate.indexOf("{copy.software}")).toBeGreaterThan(gate.indexOf("{copy.body}"));
  });

  it("⛔ nothing under the chat box, and no greeting bubble in the chat", () => {
    expect(read("src/components/chat/ChatInputBar.tsx")).not.toContain("Replies come from software");
    expect(read("src/screens/ChatScreen.tsx")).not.toContain("opening-greeting");
  });
});
