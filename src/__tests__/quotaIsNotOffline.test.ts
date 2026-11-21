// #163 (owner, 21 Nov 2026, option 1): when today's 20 free replies are used,
// the app must SAY so — not label every simpler reply "Offline mode" on a
// perfect network. Found on the owner's own iPhone after a fresh install.
import { readFileSync } from "fs";
import { join } from "path";

const chat = readFileSync(join(__dirname, "..", "screens", "ChatScreen.tsx"), "utf8");

describe("a used-up daily limit is never shown as offline", () => {
  it("the bubble label depends on WHY the reply is local", () => {
    const m = /statusLabel =\s*message\.localReason === "quota"[\s\S]{0,300}?;/.exec(chat);
    expect(m).toBeTruthy();
    expect(m![0]).toMatch(/"Simpler reply · daily limit reached"/);
    expect(m![0]).toMatch(/message\.localReason === "offline"\s*\?\s*"Offline mode"/);
    expect(m![0]).toMatch(/"Connection issue · simpler reply"/);
  });

  it("'Offline mode' is no longer the blanket label for every local reply", () => {
    expect(chat).not.toMatch(/message\.cloudAttempted\) \{\s*bubbleBorderColor = "#fbbf24";\s*statusLabel = "Offline mode";/);
  });

  it("the card names the limit and offers both ways back", () => {
    expect(chat).toMatch(/You've used today's 20 free replies/);
    expect(chat).toMatch(/my replies come from your phone and will be simpler\. For full replies now, top up or try Plus\./);
    expect(chat).toMatch(/>Top up credits</);
    expect(chat).toMatch(/>Get Plus</);
  });

  it("a strip stays above the composer while replies are simpler, and clears on the next cloud reply", () => {
    expect(chat).toMatch(/\{quotaLimited && !orgId && \(/);
    expect(chat).toMatch(/Simpler replies until your free replies reset/);
    expect(chat).toMatch(/if \(cloudQuotaHit\) setQuotaLimited\(true\);\s*else if \(source === "cloud"\) setQuotaLimited\(false\);/);
  });
});
