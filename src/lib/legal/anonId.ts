// src/lib/legal/anonId.ts
//
// A stable per-device identifier for people who are not signed in.
//
// ⛔ NOT an authentication token and never treated as one. Its only job is to
// let an acceptance record, or a crisis event, be attributed to *somebody*
// rather than to nobody — because the person who never signs in is exactly the
// one an incident is most likely to involve.
//
// Mirrors imotaraapp/src/lib/legal/anonId.ts, on AsyncStorage instead of
// localStorage. The id is per-install: reinstalling produces a new one, which
// is correct — a new install cannot prove the old one's acceptance.

import AsyncStorage from "@react-native-async-storage/async-storage";

const ANON_ID_KEY = "imotara.anonId.v1";

/**
 * Pure JS on purpose.
 *
 * ⛔ Deliberately does NOT pull in expo-crypto or react-native-get-random-values.
 * This id is an ATTRIBUTION key, not a secret: nothing is authorised by holding
 * it, and guessing one buys an attacker nothing. Adding a native module for it
 * would mean a new native build and, on Android, the prebuilt-artifact handling
 * recorded in trap_expo_modules_are_prebuilt_on_android — real cost for no
 * security gain.
 *
 * Entropy is ample for uniqueness: a millisecond timestamp plus ~104 bits drawn
 * across four Math.random() calls. Collisions across installs are not a
 * practical concern at Imotara's scale.
 */
function randomId(): string {
    const rand = () => Math.random().toString(36).slice(2, 15);
    return `a${Date.now().toString(36)}${rand()}${rand()}${rand()}${rand()}`.slice(0, 64);
}

/**
 * Returns this device's anon id, creating one on first call.
 *
 * Returns null when storage is unavailable rather than inventing a fresh id per
 * call — a different id each time would scatter one person's records across
 * many rows and be worse than none.
 */
export async function getOrCreateAnonId(): Promise<string | null> {
    try {
        const existing = await AsyncStorage.getItem(ANON_ID_KEY);
        if (existing && existing.length >= 8) return existing;
        const created = randomId();
        await AsyncStorage.setItem(ANON_ID_KEY, created);
        return created;
    } catch {
        return null;
    }
}
