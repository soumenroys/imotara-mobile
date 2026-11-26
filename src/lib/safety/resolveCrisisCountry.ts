// src/lib/safety/resolveCrisisCountry.ts
//
// Which country's crisis numbers to show. One answer, three sources, in a
// fixed order of trust.
//
// 🔴 WHAT WAS WRONG BEFORE THIS FILE, found 2026-10-16:
//
//   1. **The Settings choice did nothing.** `imotara.crisis.country.v1` was
//      written by SettingsScreen and read by NOBODY — the key appeared in
//      exactly three places, all inside SettingsScreen: the constant, the
//      load, and the save. ChatScreen called detectCountryCode() directly. So
//      a person who went looking for this control, set it, and trusted it, was
//      shown the auto-detected numbers anyway. Web honoured the same key; only
//      mobile ignored it.
//
//   2. **The auto-detection is not a location.** detectCountryCode() reads the
//      Intl LOCALE. A Bengali- or Hindi-locale phone in London reports IN, so a
//      diaspora user in crisis is shown Tele-MANAS 14416 — a short code that
//      does not dial from the UK. The people most likely to keep a home-country
//      locale are exactly the people furthest from that country's helplines.
//
// 🔑 THE ORDER, and why each beats the next:
//   1. the person's explicit choice in Settings — nothing should override
//      someone who has told us where they are;
//   2. the country the SERVER saw, from the network the request arrived on
//      (meta.resolvedCountry). No permission, no coordinate, and it is a
//      location rather than a language preference;
//   3. detectCountryCode(), the locale guess — kept because it is the only
//      source that works offline and before the first reply. ⛔ Never remove
//      it: a worse answer beats no answer on a crisis card.
//
// ⚠️ Synchronous on purpose. The crisis card renders inline, so this cannot be
// async; the two stored values are hydrated once at startup and cached here.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { detectCountryCode } from "./detectCountry";
import { buildApiUrl } from "../../config/api";
import { fetchWithTimeout } from "../fetchWithTimeout";

/** ⛔ Must match SettingsScreen's CRISIS_COUNTRY_KEY and the web's localStorage key. */
export const CRISIS_COUNTRY_KEY = "imotara.crisis.country.v1";

/** Where the last reply told us the request came from. */
const SERVER_COUNTRY_KEY = "imotara.crisis.serverCountry.v1";

let overrideCache: string | null = null;
let serverCache: string | null = null;

const clean = (v: unknown): string | null => {
    const s = String(v ?? "").trim().toUpperCase();
    return /^[A-Z]{2}$/.test(s) ? s : null;
};

/**
 * Loads both stored values into memory. Call once at startup, before the first
 * crisis card can render. Safe to call more than once.
 */
export async function hydrateCrisisCountry(): Promise<void> {
    try {
        const [ov, sv] = await Promise.all([
            AsyncStorage.getItem(CRISIS_COUNTRY_KEY),
            AsyncStorage.getItem(SERVER_COUNTRY_KEY),
        ]);
        // ⚠️ "auto" is the Settings sentinel for "no choice made", not a code.
        overrideCache = ov && ov !== "auto" ? clean(ov) : null;
        serverCache = clean(sv);
    } catch {
        // Storage unavailable — fall through to the locale guess rather than
        // showing nothing.
    }
}

/** Called by Settings when the person picks a country (or "auto"). */
export async function setCrisisCountryOverride(code: string): Promise<void> {
    overrideCache = code && code !== "auto" ? clean(code) : null;
    try {
        await AsyncStorage.setItem(CRISIS_COUNTRY_KEY, code);
    } catch {
        // The in-memory value still applies for this session.
    }
}

/**
 * Called with `meta.resolvedCountry` from every reply.
 *
 * ⚠️ Persisted so it survives a restart: the next crisis may happen offline,
 * and a country learned yesterday from the network beats a locale guess today.
 */
export async function rememberServerCountry(code: unknown): Promise<void> {
    const c = clean(code);
    if (!c || c === serverCache) return;
    serverCache = c;
    try {
        await AsyncStorage.setItem(SERVER_COUNTRY_KEY, c);
    } catch {
        // In-memory is enough for this session.
    }
}

/**
 * Asks our server which country this request comes from (GET /api/geo/country —
 * the same edge header every reply already carries; nothing stored or logged there)
 * and remembers it like a reply's `resolvedCountry`.
 *
 * 🔑 Dec release check (26 Nov 2026): a child stopped by the under-13 screen never
 * sends a message, so no reply ever told us the country — the screen fell back to
 * the phone's LOCALE (an India-locale phone in London ⇒ Tele-MANAS, which does not
 * dial from the UK). The welcome screen showed no country at all. Both screens now
 * ask once. ⛔ Never awaited before rendering: the locale guess shows first.
 */
export async function refreshServerCountry(timeoutMs = 4_000): Promise<string | null> {
    try {
        const res = await fetchWithTimeout(buildApiUrl("/api/geo/country"), { method: "GET" }, timeoutMs);
        if (!res.ok) return null;
        const data = (await res.json()) as { country?: unknown };
        const c = clean(data?.country);
        if (c) await rememberServerCountry(c);
        return c;
    } catch {
        return null; // offline / timeout — the stored or locale answer stands
    }
}

/**
 * The country whose crisis numbers to show. ⛔ Never throws, and never returns
 * a value the caller has to second-guess — getCrisisResourcesForCountry()
 * handles null by returning the international directory.
 */
export function resolveCrisisCountry(): string | null {
    if (overrideCache) return overrideCache;
    if (serverCache) return serverCache;
    return detectCountryCode();
}

/** Exposed for tests and for a Settings screen that wants to show the source. */
export function crisisCountrySource(): "override" | "server" | "locale" {
    if (overrideCache) return "override";
    if (serverCache) return "server";
    return "locale";
}

/** ⚠️ Tests only — the module caches deliberately. */
export function __resetCrisisCountryCacheForTests(): void {
    overrideCache = null;
    serverCache = null;
}
