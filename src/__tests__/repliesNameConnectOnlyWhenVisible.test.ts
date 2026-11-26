/**
 * #17 (26 Nov 2026): the server names Imotara Connect to a lonely person only when the
 * person's own Show Connect switch is on (and a companion exists). The app must send
 * that switch on BOTH reply paths — the stream and the JSON fallback — or a person who
 * switched Connect on would never hear of it, and (worse, before the fix) a person who
 * could not see it was sent there.
 */
import fs from "fs";
import path from "path";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const chat = read("screens/ChatScreen.tsx");
const client = read("api/aiClient.ts");

describe("the app sends the Show Connect switch with every reply request", () => {
  it("reads it from settings", () => {
    expect(chat).toMatch(/showConnect,\s*\n\s*\} = useSettings\(\);/);
  });

  it("the streaming payload carries it", () => {
    expect(chat).toContain("connectVisible: showConnect === true,\n          };");
  });

  it("the JSON fallback carries it, and the client puts it in the body", () => {
    expect(chat).toContain("timeoutMs: apiTimeoutMs,\n                connectVisible: showConnect === true,");
    expect(client).toContain("connectVisible: opts?.connectVisible === true,");
  });

  it("⛔ only a literal true is sent as on", () => {
    expect(client).not.toMatch(/connectVisible: opts\?\.connectVisible\s*,/);
  });
});

describe("#17 B (26 Nov 2026): a cut reply's clean ending replaces the streamed text", () => {
  it("the stream reader applies the server's replace event", () => {
    expect(client).toContain('if (typeof parsed.replace === "string" && parsed.replace.trim()) {');
    expect(client).toMatch(/accumulated = parsed\.replace;\s*\n\s*pendingAccumulated = accumulated;\s*\n\s*flush\(\);/);
  });
});
