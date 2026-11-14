// src/lib/cloudBackup.ts
//
// 🔑 #94 (owner, 14 Nov 2026): cloud backup of chat history is OPT-IN — the app
// now matches the website (imotaraapp src/lib/imotara/cloudBackup.ts).
//
// Until now every build set EXPO_PUBLIC_LAUNCH_CLOUD_SYNC_FREE_FOR_ALL=true, so
// HistoryContext pushed and pulled everyone's history (guests included, under
// their anonymous id). The owner chose: OFF by default for everyone, free for
// every signed-in (real, non-anonymous) account, switched off on sign-out;
// existing cloud copies are kept as they are.
//
// ⛔ ONE question, asked in two layers that both read THIS module:
//   1. HistoryContext — whether to schedule / run a sync at all.
//   2. api/historyClient — the push and the pull refuse while it is off, so a
//      screen calling the client directly (History, Settings) cannot bypass it.
// Deleting a cloud copy is never gated — taking data away from us is always fine.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export const CLOUD_BACKUP_KEY = "imotara.cloudBackup.v1";

let cached: boolean | null = null;
const listeners = new Set<(on: boolean) => void>();

/** True only when the person switched backup on. Absent key = off. */
export async function isCloudBackupOn(): Promise<boolean> {
    if (cached !== null) return cached;
    try {
        cached = (await AsyncStorage.getItem(CLOUD_BACKUP_KEY)) === "on";
    } catch {
        cached = false;
    }
    return cached;
}

/** Switch backup on or off. Off removes the key entirely. */
export async function setCloudBackupOn(on: boolean): Promise<void> {
    cached = on;
    try {
        if (on) await AsyncStorage.setItem(CLOUD_BACKUP_KEY, "on");
        else await AsyncStorage.removeItem(CLOUD_BACKUP_KEY);
    } catch {
        /* storage failed: the in-memory value still applies this session */
    }
    listeners.forEach((fn) => fn(on));
}

/** React hook: [on, setOn]. Starts false until storage is read. */
export function useCloudBackup(): [boolean, (on: boolean) => Promise<void>] {
    const [on, setOn] = useState<boolean>(cached ?? false);
    useEffect(() => {
        let alive = true;
        void isCloudBackupOn().then((v) => { if (alive) setOn(v); });
        const fn = (v: boolean) => setOn(v);
        listeners.add(fn);
        return () => { alive = false; listeners.delete(fn); };
    }, []);
    return [on, setCloudBackupOn];
}

/** Test-only reset of the in-memory cache. */
export function __resetCloudBackupCache() { cached = null; listeners.clear(); }
