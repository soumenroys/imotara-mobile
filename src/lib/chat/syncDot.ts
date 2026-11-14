// src/lib/chat/syncDot.ts
// The small dot beside the companion's name (#121a, 11 Nov 2026).
//
// 🔴 It turned AMBER after every single message: a reply is saved locally and
// sent to the cloud ~8 s later, so for those seconds every message is
// "unsynced". Amber means warning — on a healthy app, for every new user.
// ⇒ Amber only when a message has been waiting well past the normal sync
// delay (something is really behind). Red for a failed sync is unchanged.

/** Normal sync runs 3–60 s after a message (Settings); anything older than this is genuinely behind. */
export const SYNC_BEHIND_AFTER_MS = 90_000;

export type SyncDot = "ok" | "behind" | "failed";

export function syncDotState(
  history: ReadonlyArray<{ isSynced?: boolean; timestamp?: number }>,
  lastSyncStatus: string | null | undefined,
  now: number,
): SyncDot {
  const behind = history.some((h) => !h.isSynced && typeof h.timestamp === "number" && now - h.timestamp > SYNC_BEHIND_AFTER_MS);
  if (behind) return "behind";
  if ((lastSyncStatus || "").toLowerCase().includes("failed")) return "failed";
  return "ok";
}
