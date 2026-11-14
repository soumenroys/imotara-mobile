// #94 (owner, 14 Nov 2026): sign-out = "keep, but hide" for EVERYTHING personal on the
// phone (lib/personalData). Found in the simulator: after sign-out the guest's reply said
// "take care on your walk" — the account's companion memories were never touched.
import { readFileSync } from "fs";

const mem: Record<string, string> = {};
const sec: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (k: string) => (k in mem ? mem[k] : null)),
        setItem: jest.fn(async (k: string, v: string) => { mem[k] = v; }),
        removeItem: jest.fn(async (k: string) => { delete mem[k]; }),
    },
}));
jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn(async (k: string) => {
        if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error("Invalid key");   // the real rule
        return k in sec ? sec[k] : null;
    }),
    setItemAsync: jest.fn(async (k: string, v: string) => {
        if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error("Invalid key");
        sec[k] = v;
    }),
    deleteItemAsync: jest.fn(async (k: string) => { delete sec[k]; }),
}));

import {
    PERSONAL_ASYNC_KEYS, hidePersonalData, mergeBack, showPersonalData, stashKey,
} from "../lib/personalData";

const MEMORIES = "imotara.companion.memories.v2";
const LETTERS = "imotara.companion_letters.archive.v1";
const WELCOME = "imotara.welcomeBack.last.v1";
const REACTIONS = "imotara.reactions.v1";
const USER = "2c55229b-0954-4606-9b38-20bc3c985a0d";

beforeEach(() => {
    for (const k of Object.keys(mem)) delete mem[k];
    for (const k of Object.keys(sec)) delete sec[k];
});

describe("sign-out hides, sign-in shows", () => {
    it("the next person sees none of it — memories included", async () => {
        sec[MEMORIES] = JSON.stringify([{ id: "m1", text: "goes for a walk every evening" }]);
        mem[LETTERS] = JSON.stringify([{ id: "letter-1", body: "Dear Ray" }]);
        mem[WELCOME] = JSON.stringify({ topic: "work" });
        await hidePersonalData(USER);
        expect(sec[MEMORIES]).toBeUndefined();
        expect(mem[LETTERS]).toBeUndefined();
        expect(mem[WELCOME]).toBeUndefined();
    });

    it("it all comes back at that person's next sign-in", async () => {
        sec[MEMORIES] = JSON.stringify([{ id: "m1", text: "walk" }]);
        mem[WELCOME] = JSON.stringify({ topic: "work" });
        await hidePersonalData(USER);
        await showPersonalData(USER);
        expect(JSON.parse(sec[MEMORIES])).toEqual([{ id: "m1", text: "walk" }]);
        expect(JSON.parse(mem[WELCOME])).toEqual({ topic: "work" });
        expect(Object.keys(mem).some((k) => k.includes(".acct."))).toBe(false);
    });

    it("another account signing in does NOT get them", async () => {
        sec[MEMORIES] = JSON.stringify([{ id: "m1", text: "walk" }]);
        await hidePersonalData(USER);
        await showPersonalData("someone-else");
        expect(sec[MEMORIES]).toBeUndefined();
    });

    it("what a guest made meanwhile is kept and moves into the account (#135)", async () => {
        mem[LETTERS] = JSON.stringify([{ id: "a" }]);
        mem[REACTIONS] = JSON.stringify({ m1: "✨" });
        await hidePersonalData(USER);
        mem[LETTERS] = JSON.stringify([{ id: "g" }]);
        mem[REACTIONS] = JSON.stringify({ m9: "🙏" });
        await showPersonalData(USER);
        expect(JSON.parse(mem[LETTERS]).map((x: any) => x.id)).toEqual(["a", "g"]);
        expect(JSON.parse(mem[REACTIONS])).toEqual({ m9: "🙏", m1: "✨" });
    });

    it("the SecureStore stash key is legal there (no ':')", () => {
        expect(stashKey(MEMORIES, USER)).toMatch(/^[A-Za-z0-9._-]+$/);
        expect(stashKey(MEMORIES, "we:ird/id")).toMatch(/^[A-Za-z0-9._-]+$/);
    });
});

describe("merging back", () => {
    it("lists: account first, no duplicates", () => {
        expect(JSON.parse(mergeBack('[{"id":1},{"id":2}]', '[{"id":2},{"id":3}]')).map((x: any) => x.id)).toEqual([1, 2, 3]);
    });
    it("plain values (a timestamp): the account's", () => {
        expect(mergeBack("1794663210931", "1794669999999")).toBe("1794663210931");
    });
    it("nothing from the guest: the account's value as it was", () => {
        expect(mergeBack('{"a":1}', null)).toBe('{"a":1}');
    });
});

describe("wiring", () => {
    const AUTH = readFileSync("src/auth/AuthContext.tsx", "utf8");
    const CHAT = readFileSync("src/screens/ChatScreen.tsx", "utf8");
    const SETTINGS = readFileSync("src/screens/SettingsScreen.tsx", "utf8");
    const CTX = readFileSync("src/state/SettingsContext.tsx", "utf8");
    it("auth hides at sign-out and shows at sign-in", () => {
        expect(AUTH).toMatch(/if \(previous\) await hidePersonalData\(previous\);\s*await showPersonalData\(realId\);\s*announcePersonalDataChanged\(\);/);
        expect(AUTH).toMatch(/void hidePersonalData\(leaving\)\.then\(announcePersonalDataChanged\);/);
    });
    it("screens that hold memories / reactions reload when the person changes", () => {
        expect(CHAT.match(/return onPersonalDataChanged\(load\);/g)?.length).toBe(2);
        expect(SETTINGS).toMatch(/return onPersonalDataChanged\(load\);/);
    });
    it("the profile comes back at sign-in, not only when Settings opens", () => {
        expect(CTX).toMatch(/event === "SIGNED_IN" \|\| event === "INITIAL_SESSION"[\s\S]{0,900}mergeServerProfile\(prev, srv\)/);
    });
    it("every personal store is listed (letters, insights, reactions, last topic, follow-ups)", () => {
        expect([...PERSONAL_ASYNC_KEYS].sort()).toEqual([
            "imotara.companion_letter.last_at.v1", "imotara.companion_letters.archive.v1",
            "imotara.open_loops.v1", "imotara.pending_insights.v2", "imotara.reactions.v1",
            "imotara.welcomeBack.last.v1",
        ]);
    });
});
