// #94 (owner, 14 Nov 2026): "Keep, but hide". At sign-out the account's chats stay on
// the phone but the next person (guest or another account) cannot see them; signing in
// again shows them. Chats written as a guest MOVE into the account at sign-in (#135).
//
// Found in the simulator 14 Nov: guest and account shared ONE storage key (the first
// anonymous id), so after sign-out the guest read the account's un-backed-up chats.
// ⚠️ No render harness for HistoryContext ⇒ pure helpers are tested for behaviour; the
// wiring is pinned by text (and was checked in the iOS Simulator).
import { readFileSync } from "fs";

import { storageKeyFor, mergeGuestIntoAccount } from "../state/historyScope";

const SRC = readFileSync("src/state/HistoryContext.tsx", "utf8");

describe("where history is kept", () => {
    it("a real account has its OWN key; a guest keeps the old one", () => {
        expect(SRC).toMatch(/function scopedKey\([^)]*\) \{\s*\/\/[^\n]*\n\s*return storageKeyFor\(base, "", chatLinkKey, localUserScopeId\);/);
        expect(storageKeyFor("imotara_history_v1", "acct:user-1", "anon-9", "local_x")).toBe("imotara_history_v1:acct:user-1");
        expect(storageKeyFor("imotara_history_v1", "", "anon-9", "local_x")).toBe("imotara_history_v1:anon-9");
        expect(storageKeyFor("imotara_history_v1", "", "", "local_x")).toBe("imotara_history_v1:local:local_x");
    });
    it("two accounts never share a key, and neither shares the guest's", () => {
        const a = storageKeyFor("k", "acct:a", "anon", "l");
        const b = storageKeyFor("k", "acct:b", "anon", "l");
        const guest = storageKeyFor("k", "", "anon", "l");
        expect(new Set([a, b, guest]).size).toBe(3);
    });
});

describe("guest chats move into the account at sign-in", () => {
    const acct = [{ id: "a1", timestamp: 10 }, { id: "a2", timestamp: 30 }];
    it("keeps the account's chats, adds the guest's, oldest first", () => {
        const guest = [{ id: "g1", timestamp: 20 }];
        expect(mergeGuestIntoAccount(acct, guest).map((i) => i.id)).toEqual(["a1", "g1", "a2"]);
    });
    it("never duplicates a chat that is in both", () => {
        expect(mergeGuestIntoAccount(acct, [{ id: "a2", timestamp: 30 }]).map((i) => i.id)).toEqual(["a1", "a2"]);
    });
    it("nothing from the guest ⇒ the account's chats unchanged", () => {
        expect(mergeGuestIntoAccount(acct, [])).toEqual(acct);
    });
});

describe("wiring (pinned — see header)", () => {
    it("the account comes from the REAL session; loading loads nothing", () => {
        expect(SRC).toMatch(/const authUserId = status === "authenticated" \? String\(user\?\.id \?\? ""\)\.trim\(\) : "";/);
        expect(SRC).toMatch(/status === "loading" \? null : authUserId \? `acct:\$\{authUserId\}` : "";/);
        expect(SRC).toMatch(/if \(accountScope === null\) return;\s*\n\s*try \{/);
    });
    it("save, clear and threads all use the account-aware key", () => {
        expect(SRC.match(/storageKeyFor\((STORAGE|THREADS)_KEY_BASE, accountScope, chatLinkKey, localUserScopeId\)/g)?.length).toBe(3);
    });
    it("the guest copy is removed only AFTER the account copy is saved", () => {
        expect(SRC).toMatch(/await AsyncStorage\.setItem\(acctHistoryKey, JSON\.stringify\(merged\)\);\s*await AsyncStorage\.multiRemove\(/);
    });
    it("🔴 an old load can never finish into a new scope", () => {
        expect(SRC).toMatch(/if \(!cancelled\) setHydrated\(true\);/);
        expect(SRC).toMatch(/return \(\) => \{ cancelled = true; \};\s*\n\s*\}, \[chatLinkKey, localUserScopeId, accountScope\]\);/);
    });
    it("a cloud answer arriving after sign-out is thrown away", () => {
        expect(SRC.match(/accountScopeRef\.current !== accountAtStart/g)?.length).toBe(2);
    });
});

describe("who the person IS does not outlive their session", () => {
    const SETTINGS = readFileSync("src/state/SettingsContext.tsx", "utf8");
    it("a real sign-out clears name, age, gender and reply style (the server copy refills them at sign-in)", () => {
        expect(SETTINGS).toMatch(/if \(event === "SIGNED_OUT" && hadRealSessionRef\.current\) \{[\s\S]{0,200}user: \{ \.\.\.prev\.user, name: "", ageTone: undefined, gender: undefined, responseStyle: undefined \}/);
    });
    it("an anonymous session never counts as the real person", () => {
        expect(SETTINGS).toMatch(/if \(session\?\.user\?\.id\) hadRealSessionRef\.current = !session\.user\.is_anonymous;/);
    });
});
