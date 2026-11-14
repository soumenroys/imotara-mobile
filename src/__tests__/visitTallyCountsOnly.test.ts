// #77d — the phone's anonymous visit tally counts exactly like the website's, and
// sends nothing but ±1 bucket counts (no id, no text, no time of day).
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as fs from "fs";
import * as path from "path";
import {
    __setSender, ageBucket, messagesBucket, minutesBucket, noteMessageSent, noteVisit, reportVisit,
    visitEvents, GAP_MS, type TallyEvent,
} from "../lib/analytics/visitTally";

jest.mock("@react-native-async-storage/async-storage", () => {
    let store: Record<string, string> = {};
    return {
        __esModule: true,
        default: {
            getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
            setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
            clear: () => { store = {}; },
        },
    };
});

const T0 = new Date(2026, 10, 14, 10, 0, 0).getTime();
let sent: TallyEvent[][] = [];
beforeEach(() => { (AsyncStorage as any).clear(); sent = []; __setSender((e) => { sent.push(e); }); });

describe("buckets match the website", () => {
    it("same edges as imotaraapp src/lib/analytics/visitTally.ts", () => {
        expect([0, 30, 31, 90, 91].map(ageBucket)).toEqual([0, 30, 31, 31, 91]);
        expect([0, 5, 6, 10, 11, 40].map(messagesBucket)).toEqual([0, 5, 6, 6, 11, 11]);
        expect([0.5, 1, 2, 5.9, 6, 10.9, 11, 20.9, 21].map(minutesBucket)).toEqual([0, 1, 2, 3, 6, 6, 11, 11, 21]);
    });
    it("the web's bucket code is literally the same rules (guards drift)", () => {
        const web = path.resolve(__dirname, "../../../imotaraapp/src/lib/analytics/visitTally.ts");
        if (!fs.existsSync(web)) return; // web repo not checked out next to this one
        const src = fs.readFileSync(web, "utf8");
        expect(src).toMatch(/return d <= 30 \? d : d <= 90 \? 31 : 91;/);
        expect(src).toMatch(/return m <= 5 \? m : m <= 10 \? 6 : 11;/);
    });
});

describe("a visit", () => {
    it("first open reports day 0 once, then the visit's size when backgrounded", async () => {
        await noteVisit(T0);
        await noteVisit(T0 + 60_000); // same day: no second visit_age
        await noteMessageSent(T0 + 2 * 60_000);
        await noteMessageSent(T0 + 3 * 60_000);
        await reportVisit(T0 + 4 * 60_000);
        expect(sent).toEqual([
            [{ kind: "visit_age", bucket: 0, delta: 1 }],
            [{ kind: "session_messages", bucket: 2, delta: 1 }, { kind: "session_minutes", bucket: 3, delta: 1 }],
        ]);
    });

    it("a later report CORRECTS the earlier buckets with -1/+1", async () => {
        await noteVisit(T0);
        await reportVisit(T0 + 30_000);
        await noteMessageSent(T0 + 60_000);
        await reportVisit(T0 + 90_000);
        expect(sent.at(-1)).toEqual([
            { kind: "session_messages", bucket: 0, delta: -1 },
            { kind: "session_messages", bucket: 1, delta: 1 },
            { kind: "session_minutes", bucket: 0, delta: -1 },
            { kind: "session_minutes", bucket: 1, delta: 1 },
        ]);
    });

    it("next day counts as day 1; a gap over 30 min starts a new visit", async () => {
        await noteVisit(T0);
        await noteVisit(T0 + 24 * 3600_000);
        expect(sent.map((e) => e[0])).toContainEqual({ kind: "visit_age", bucket: 1, delta: 1 });
        expect(visitEvents({ start: T0, last: T0, messages: 0, sent: null }, T0).events.length).toBe(2);
        expect(GAP_MS).toBe(30 * 60_000);
    });

    it("only bucket counts ever leave the phone", async () => {
        await noteVisit(T0);
        await noteMessageSent(T0 + 1000);
        await reportVisit(T0 + 2000);
        for (const batch of sent) for (const e of batch) {
            expect(Object.keys(e).sort()).toEqual(["bucket", "delta", "kind"]);
        }
    });
});

describe("wiring", () => {
    const app = fs.readFileSync(path.resolve(__dirname, "../../App.tsx"), "utf8");
    const chat = fs.readFileSync(path.resolve(__dirname, "../screens/ChatScreen.tsx"), "utf8");
    it("App: visit on open + foreground, report on background", () => {
        expect(app).toMatch(/void noteVisit\(\);\s*const sub = AppState\.addEventListener\("change", \(next\) => \{\s*if \(next === "active"\) void noteVisit\(\);\s*else if \(next === "background"\) void reportVisit\(\);/);
    });
    it("Chat: counted only after the double-send guard", () => {
        expect(chat).toMatch(/if \(isTyping \|\| isSendingRef\.current\) return;\s*\/\/[^\n]*\n\s*void noteMessageSent\(\);/);
    });
});
