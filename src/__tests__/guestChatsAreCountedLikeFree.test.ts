/**
 * 👤 A guest's cloud chat carries the guest's token (25 Oct 2026). Without it the
 * server could neither record the reply nor apply the 20/day the header's "Free"
 * already promises guests — guest retention was unmeasurable and guest cost
 * uncapped. ⛔ Only the CHAT calls change: accessToken itself still means "a real
 * account" everywhere money moves (see anonymousAccessToken in AuthContext).
 */
import { readFileSync } from "fs";
import { join } from "path";

const screen = readFileSync(join(__dirname, "..", "screens", "ChatScreen.tsx"), "utf8");

describe("guest chats are sent with the guest's identity", () => {
  it("the streamed reply", () => expect(screen).toMatch(/streamChatReply\(\s*cloudPayload,\s*guestAccessToken,/));
  it("the non-streamed fallback", () => expect(screen).toMatch(/accessToken: guestAccessToken, \/\/ same reason as the stream above/));
  it("guestAccessToken prefers a real account's token", () =>
    expect(screen).toMatch(/const guestAccessToken = accessToken \?\? anonymousAccessToken \?\? undefined;/));
});
