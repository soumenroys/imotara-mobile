// src/lib/chat/appendOnce.ts
// Add messages to the chat list WITHOUT duplicating one that is already there.
//
// 🔴 28 Nov 2026 (1.7.4 emulator test): an on-device reply showed TWICE. The reply is saved
// to history first; ChatScreen rebuilds the list from history on every history change, so the
// rebuild already contained the reply — and then the send flow appended it again (same id).
// The extra copy only went away at the next history change (a sync mark), and sometimes stayed.
// Now a message whose id is already in the list is updated IN PLACE (the newer object wins —
// it carries the reflection seed, emotion etc. that history does not keep); new ids append.
export function appendOnce<T extends { id: string }>(prev: T[], add: T[]): T[] {
    if (add.length === 0) return prev;
    const index = new Map<string, number>();
    prev.forEach((m, i) => index.set(m.id, i));
    const next = prev.slice();
    for (const m of add) {
        const at = index.get(m.id);
        if (at !== undefined) {
            next[at] = { ...next[at], ...m };
        } else {
            index.set(m.id, next.length);
            next.push(m);
        }
    }
    return next;
}
