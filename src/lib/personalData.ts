// src/lib/personalData.ts
//
// 🔑 #94 (owner, 14 Nov 2026): sign-out = "KEEP, BUT HIDE" — for everything personal on
// the phone, not only the chat history (that one lives in state/historyScope.ts).
//
// Found in the iOS Simulator 14 Nov: after sign-out the guest's reply said "take care on
// your walk" — the account's companion memories (SecureStore, injected into every
// reply) were never touched by sign-out, and letters / insights / open follow-ups /
// the last-session topic / reactions all stayed readable by the next person.
//
// At a REAL sign-out each value is moved aside under `${key}.acct.<user id>` (the
// SecureStore key alphabet allows only letters, digits, ".", "-" and "_" — no ":").
// At that person's next sign-in it comes back. Anything created as a guest in between
// stays and so moves into whichever account signs in (#135).
//
// ⛔ Add a key here whenever a new store holds something about the PERSON.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const PERSONAL_ASYNC_KEYS = [
    "imotara.companion_letters.archive.v1",
    "imotara.companion_letter.last_at.v1",
    "imotara.pending_insights.v2",
    "imotara.reactions.v1",
    "imotara.welcomeBack.last.v1",
    "imotara.open_loops.v1",
] as const;

export const PERSONAL_SECURE_KEYS = ["imotara.companion.memories.v2"] as const;

/** Where a person's value waits while they are signed out. */
export function stashKey(key: string, userId: string): string {
    const safeId = String(userId).replace(/[^A-Za-z0-9._-]/g, "_");
    return `${key}.acct.${safeId}`;
}

/**
 * The account's value comes back; a guest value made meanwhile is kept too.
 * Lists of {id} ⇒ both, account first, no duplicates · plain objects ⇒ both, the
 * account's entry wins · anything else ⇒ the account's value.
 */
export function mergeBack(accountRaw: string, guestRaw: string | null): string {
    if (guestRaw == null) return accountRaw;
    try {
        const acct = JSON.parse(accountRaw);
        const guest = JSON.parse(guestRaw);
        if (Array.isArray(acct) && Array.isArray(guest)) {
            const id = (x: any) => (x && typeof x === "object" && "id" in x ? String(x.id) : JSON.stringify(x));
            const seen = new Set(acct.map(id));
            return JSON.stringify([...acct, ...guest.filter((g) => !seen.has(id(g)))]);
        }
        const isPlain = (o: unknown) => !!o && typeof o === "object" && !Array.isArray(o);
        if (isPlain(acct) && isPlain(guest)) {
            return JSON.stringify({ ...guest, ...acct });
        }
    } catch {
        /* not JSON (e.g. a timestamp) ⇒ the account's value */
    }
    return accountRaw;
}

type Store = {
    get: (k: string) => Promise<string | null>;
    set: (k: string, v: string) => Promise<void>;
    remove: (k: string) => Promise<void>;
};

const asyncStore: Store = {
    get: (k) => AsyncStorage.getItem(k),
    set: (k, v) => AsyncStorage.setItem(k, v),
    remove: (k) => AsyncStorage.removeItem(k),
};
const secureStore: Store = {
    get: (k) => SecureStore.getItemAsync(k),
    set: (k, v) => SecureStore.setItemAsync(k, v),
    remove: (k) => SecureStore.deleteItemAsync(k),
};

const ALL: Array<[Store, readonly string[]]> = [
    [asyncStore, PERSONAL_ASYNC_KEYS],
    [secureStore, PERSONAL_SECURE_KEYS],
];

/** Real sign-out: move this person's values aside. Copy FIRST, remove after. */
export async function hidePersonalData(userId: string): Promise<void> {
    if (!userId) return;
    for (const [store, keys] of ALL) {
        for (const key of keys) {
            try {
                const v = await store.get(key);
                if (v == null) continue;
                const k = stashKey(key, userId);
                const already = await store.get(k);
                await store.set(k, already == null ? v : mergeBack(already, v));
                await store.remove(key);
            } catch {
                /* one store failing must not stop the others */
            }
        }
    }
}

/** Real sign-in: bring this person's values back (guest values made meanwhile are kept). */
export async function showPersonalData(userId: string): Promise<void> {
    if (!userId) return;
    for (const [store, keys] of ALL) {
        for (const key of keys) {
            try {
                const k = stashKey(key, userId);
                const stashed = await store.get(k);
                if (stashed == null) continue;
                await store.set(key, mergeBack(stashed, await store.get(key)));
                await store.remove(k);
            } catch {
                /* leave the stash in place — it is retried at the next sign-in */
            }
        }
    }
}

// Screens that hold any of these in memory reload when this changes.
type Listener = () => void;
const listeners = new Set<Listener>();
export function onPersonalDataChanged(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}
export function announcePersonalDataChanged(): void {
    listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}
