/**
 * 🔴 11 Nov 2026: the check-in invite never appeared — the chat is rebuilt from
 * history after every reply and the invite (never stored there) was wiped.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { keepTransientCards } from "../lib/chat/keepTransientCards";

const h = (id: string, timestamp: number) => ({ id, timestamp });

describe("rebuilding the chat keeps the invite and quota cards", () => {
  it("same conversation ⇒ the invite stays, after the reply", () => {
    const prev = [h("u1", 1), h("b1", 2), { id: "checkin-invite-2", timestamp: 3, isCheckInInvite: true }];
    const out = keepTransientCards(prev, [h("u1", 1), h("b1", 2)], true);
    expect(out.map((m) => m.id)).toEqual(["u1", "b1", "checkin-invite-2"]);
  });
  it("the quota notice stays BEFORE its reply", () => {
    const prev = [{ id: "quota", timestamp: 1, isQuotaNotice: true }, h("b1", 2)];
    expect(keepTransientCards(prev, [h("u0", 0), h("b1", 2)], true).map((m) => m.id)).toEqual(["u0", "quota", "b1"]);
  });
  it("another conversation ⇒ cards are dropped", () => {
    const prev = [{ id: "checkin-invite-2", timestamp: 3, isCheckInInvite: true }];
    expect(keepTransientCards(prev, [h("x", 1)], false)).toEqual([h("x", 1)]);
  });
  it("ordinary messages still come only from history (no duplicates, no ghosts)", () => {
    const prev = [h("stream-placeholder", 5), h("b1", 2)];
    expect(keepTransientCards(prev, [h("b1", 2)], true)).toEqual([h("b1", 2)]);
  });
  it("wired in the chat screen's history effect", () => {
    const screen = readFileSync(join(__dirname, "../screens/ChatScreen.tsx"), "utf8");
    expect(screen).toMatch(/setMessages\(\(prev\) => keepTransientCards\(prev, hydrated, sameThread\)\);/);
    expect(screen).not.toMatch(/\n\s*setMessages\(hydrated\);/);
  });
});
