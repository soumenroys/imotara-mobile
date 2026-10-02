// src/licensing/licenseTierStore.ts

/**
 * ONE owner of the current licence tier, shared across contexts.
 *
 * 🔴 WHY THIS EXISTS. There were TWO independent copies of the tier, and they
 * tried to communicate through AsyncStorage:
 *
 *   • `HistoryContext` kept `useState<LicenseTier>("FREE")` and read
 *     `imotara_license_tier_v1` **once, during hydration**.
 *   • `SettingsContext.refreshLicense()` fetched `/api/license/status` and
 *     **wrote that same key** afterwards.
 *
 * ⚠️ **AsyncStorage is a key-value store, not an event bus.** Nothing told
 * HistoryContext to read it again, so its copy stayed at whatever it loaded —
 * or at the "FREE" default on a fresh install, where the key does not exist yet.
 *
 * Observed on an emulator 2026-10-02, both on screen at the same moment:
 *   the chat header read **Free** while the upgrade sheet read **Plus**.
 *
 * 🔴 AND IT IS NOT COSMETIC. `HistoryContext` runs the HISTORY_DAYS_LIMIT
 * retention effect off that same stale value, so a Plus user shown as Free also
 * had local history pruned to the free window. (Only already-synced items, so
 * nothing is lost server-side — but it is data behaviour, not a label.)
 *
 * 🔑 The web app had exactly this bug in a different disguise — eight copies
 * instead of two — and was fixed the night before by giving it one store that
 * everybody subscribes to (`src/lib/imotara/licenseStore.ts` in imotaraapp).
 * This is the same shape, kept deliberately small.
 *
 * ⚠️ THIS IS A NOTIFIER, NOT A CACHE. AsyncStorage stays the source of truth
 * across launches; this only carries changes *within* a running session, to the
 * copies that would otherwise never hear about them. Do not persist from here —
 * two things writing the same key is how this started.
 */

import type { LicenseTier } from "./featureGates";

type Listener = (tier: LicenseTier) => void;

const listeners = new Set<Listener>();

/** Last published tier this session, or null before anything has published. */
let current: LicenseTier | null = null;

/**
 * Announce a new tier to every subscriber.
 *
 * Call this wherever the tier is newly *learned* — after a licence refresh, a
 * purchase, or a debug override. Callers still write AsyncStorage themselves;
 * this is the part that was missing.
 */
export function publishLicenseTier(tier: LicenseTier): void {
    current = tier;
    listeners.forEach((fn) => {
        // One broken subscriber must not stop the others from updating.
        try { fn(tier); } catch { /* ignore */ }
    });
}

/** The last published tier, or null if nothing has published this session. */
export function getPublishedLicenseTier(): LicenseTier | null {
    return current;
}

/**
 * Subscribe to tier changes. Returns the unsubscribe function, so an effect can
 * `return subscribeLicenseTier(fn)` directly.
 *
 * 🔑 If a tier has already been published before you subscribe, you are called
 * immediately with it. Without that, a consumer mounting after the refresh has
 * landed would sit on its stale default until the *next* change — which is the
 * original bug wearing a different hat.
 */
export function subscribeLicenseTier(fn: Listener): () => void {
    listeners.add(fn);
    if (current !== null) {
        try { fn(current); } catch { /* ignore */ }
    }
    return () => { listeners.delete(fn); };
}

/** Test-only. Not exported from any barrel; do not call in app code. */
export function __resetLicenseTierStoreForTests(): void {
    listeners.clear();
    current = null;
}
