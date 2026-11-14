// src/state/historyScope.ts — pure helpers for WHERE history is kept on the phone.
// ⇒ src/__tests__/signOutHidesAccountChats.test.ts

/**
 * 🔑 #94 (owner, 14 Nov 2026): "keep, but hide". Each REAL account keeps its own history
 * on this phone under `${base}:acct:<user id>`; a guest (signed out / anonymous) uses the
 * old scoped key. Signing out therefore hides the account's chats from the next person,
 * and signing in again shows them. Chats written as a guest MOVE into the account at
 * sign-in (#135). accountScope: "" = guest · "acct:<id>" = account.
 */
export function storageKeyFor(base: string, accountScope: string, chatLinkKey: unknown, localUserScopeId: unknown) {
    if (accountScope) return `${base}:${accountScope}`;
    // The pre-#94 guest layout (same as HistoryContext scopedKey).
    const scope = String(chatLinkKey ?? "").trim();
    if (scope) return `${base}:${scope}`;
    const local = String(localUserScopeId ?? "").trim();
    return local ? `${base}:local:${local}` : `${base}:local`;
}

/** Account items first, then guest items not already there; oldest → newest. */
export function mergeGuestIntoAccount<T extends { id: string; timestamp?: number }>(account: T[], guest: T[]): T[] {
    const seen = new Set(account.map((i) => i.id));
    const merged = [...account, ...guest.filter((i) => !seen.has(i.id))];
    return merged
        .map((item, index) => ({ item, index }))
        .sort((a, b) => ((a.item.timestamp ?? 0) - (b.item.timestamp ?? 0)) || (a.index - b.index))
        .map((x) => x.item);
}
