// src/lib/chat/keepTransientCards.ts
// 🔴 11 Nov 2026: the chat is rebuilt from history on EVERY history change (the
// reply being saved, a sync mark). The check-in invite and the quota notice are
// cards that never go into history ⇒ they were wiped before anyone saw them
// (simulator, fresh install, 3 messages: never shown; invite state never set).
// Keep them while the SAME conversation stays open; drop them on a thread switch.

type Card = { id: string; timestamp?: number; isCheckInInvite?: boolean; isQuotaNotice?: boolean };

export function keepTransientCards<T extends Card>(prev: T[], hydrated: T[], sameThread: boolean): T[] {
    if (!sameThread) return hydrated;
    const ids = new Set(hydrated.map((m) => m.id));
    const cards = prev.filter((m) => (m.isCheckInInvite || m.isQuotaNotice) && !ids.has(m.id));
    if (cards.length === 0) return hydrated;
    return [...hydrated, ...cards].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}
