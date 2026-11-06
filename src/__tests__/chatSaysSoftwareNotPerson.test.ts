import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * 🔑 Owner, 30 Oct 2026: Imotara is a "private companion", no longer an "AI
 * companion" — so the chat itself must say that no person writes the replies.
 * Imotara Connect DOES offer real people, so the doubt is a reasonable one.
 * Same sentence as the web chat (imotaraapp src/app/chat/page.tsx).
 */
describe("the chat says who is replying", () => {
  const bar = read("src/components/chat/ChatInputBar.tsx");

  it("the input bar carries the line, after the Send button and unconditionally", () => {
    const afterSend = bar.slice(bar.indexOf('accessibilityLabel="Send message"'));
    expect(afterSend).toContain("Replies come from software, not a person.");
    // ⛔ not behind a condition: no `&&` / ternary between Send and the line.
    const between = afterSend.slice(0, afterSend.indexOf("Replies come from software"));
    expect(between).not.toMatch(/&&|\?\s*\(/);
  });

  it("the chat screen actually renders the input bar", () => {
    expect(read("src/screens/ChatScreen.tsx")).toMatch(/<ChatInputBar\b/);
  });
});
