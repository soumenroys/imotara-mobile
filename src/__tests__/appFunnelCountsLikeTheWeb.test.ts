// #16 (owner, 25 Nov 2026): the app keeps the same anonymous STEP counts as the website —
// ~70% of new chatters are on the app and nothing there was counted.
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FUNNEL_STEPS, funnelOncePerDay, tallyFunnel, noteVisit, __setSender, type TallyEvent } from "../lib/analytics/visitTally";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("same step numbers as the website (never renumber)", () => {
  it("each app step has the web's number", () => {
    expect(FUNNEL_STEPS).toEqual({
      invite_shown: 1, invite_accepted: 2, invite_declined: 3,
      welcome_shown: 4, welcome_pick: 5, welcome_fresh: 6,
      checkin_opened: 7, quota_hit: 12,
    });
  });
  const web = join(__dirname, "../../../imotaraapp/src/lib/analytics/visitTally.ts");
  (existsSync(web) ? it : it.skip)("…and the web file agrees (when the sibling repo is present)", () => {
    const w = readFileSync(web, "utf8");
    for (const [k, v] of Object.entries(FUNNEL_STEPS)) expect(w).toMatch(new RegExp(`\\b${k}: ${v},`));
  });
});

describe("once per device per day per step, and nothing else is sent", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it("funnelOncePerDay", () => {
    expect(funnelOncePerDay({}, "invite_shown", "2026-11-25")).toBe(true);
    expect(funnelOncePerDay({ invite_shown: "2026-11-25" }, "invite_shown", "2026-11-25")).toBe(false);
    expect(funnelOncePerDay({ invite_shown: "2026-11-24" }, "invite_shown", "2026-11-25")).toBe(true);
  });

  it("sends {kind:'funnel', bucket, delta:1} once a day — no id, no text", async () => {
    const sent: TallyEvent[][] = [];
    __setSender((e) => { sent.push(e); });
    const day = new Date(2026, 10, 25, 10).getTime();
    await tallyFunnel("invite_shown", day);
    await tallyFunnel("invite_shown", day + 3_600_000);
    await tallyFunnel("invite_accepted", day);
    await tallyFunnel("invite_shown", day + 86_400_000);
    expect(sent).toEqual([
      [{ kind: "funnel", bucket: 1, delta: 1 }],
      [{ kind: "funnel", bucket: 2, delta: 1 }],
      [{ kind: "funnel", bucket: 1, delta: 1 }],
    ]);
    for (const batch of sent) for (const e of batch) expect(Object.keys(e).sort()).toEqual(["bucket", "delta", "kind"]);
  });
});

describe("wiring — the same moments as the website", () => {
  const card = src("components/imotara/CheckInInviteCard.tsx");
  const chat = src("screens/ChatScreen.tsx");
  const nav = src("navigation/RootNavigator.tsx");
  it("invite card: shown on mount, accepted on success, declined on 'Not now' or a refused permission", () => {
    expect(card).toMatch(/useEffect\(\(\) => \{ void tallyFunnel\("invite_shown"\); \}, \[\]\)/);
    expect(card).toMatch(/if \(r\.ok\) \{ void tallyFunnel\("invite_accepted"\);/);
    expect((card.match(/tallyFunnel\("invite_declined"\)/g) ?? []).length).toBe(2);
  });
  it("welcome-back: shown / pick up / start fresh; daily limit reached", () => {
    expect(chat).toMatch(/setWelcomeBack\(last\); void tallyFunnel\("welcome_shown"\);/);
    expect(chat).toMatch(/void tallyFunnel\("welcome_pick"\)/);
    expect(chat).toMatch(/void tallyFunnel\("welcome_fresh"\)/);
    expect(chat).toMatch(/if \(cloudQuotaHit\) \{ setQuotaLimited\(true\); void tallyFunnel\("quota_hit"\); \}/);
  });
  it("visits are reported on open/background, and a check-in reminder tap is counted once", () => {
    expect(nav).toMatch(/onForeground: \(\) => \{[^}]*void noteVisit\(\);/);
    expect(nav).toMatch(/onBackground: \(\) => \{ void reportVisit\(\); \}/);
    expect(nav).toMatch(/type !== "checkin"\) return;/);
    expect(nav).toMatch(/=== id\) return;/);
    expect(nav).toContain('void tallyFunnel("checkin_opened")');
  });
});

describe("⚠️ simultaneous calls on launch count once (seen 25 Nov 2026: 4 for one install)", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });
  it("two noteVisit calls in the same instant report 'day 0' once", async () => {
    const sent: TallyEvent[][] = [];
    __setSender((e) => { sent.push(e); });
    const t = new Date(2026, 10, 25, 10).getTime();
    await Promise.all([noteVisit(t), noteVisit(t), noteVisit(t + 1000)]);
    const ages = sent.flat().filter((e) => e.kind === "visit_age");
    expect(ages).toEqual([{ kind: "visit_age", bucket: 0, delta: 1 }]);
  });
  it("two tallyFunnel calls in the same instant count once", async () => {
    const sent: TallyEvent[][] = [];
    __setSender((e) => { sent.push(e); });
    const t = new Date(2026, 10, 25, 10).getTime();
    await Promise.all([tallyFunnel("invite_shown", t), tallyFunnel("invite_shown", t)]);
    expect(sent.flat()).toEqual([{ kind: "funnel", bucket: 1, delta: 1 }]);
  });
});
