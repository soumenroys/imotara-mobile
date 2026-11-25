// src/lib/analytics/visitTally.ts
//
// #77d (owner, 8 Nov 2026): the ANONYMOUS visit tally, on the phone — the same
// three daily counts the website has kept since 31 Oct, so "do people come back,
// and do they talk?" can be answered for the app too (iPhone first-run: 0 of 12
// returned, and nobody could see why).
//
// What leaves the phone: ONLY ±1 counts in a bucket — days since this device's
// first visit (0–30, 31, 91), messages sent in one visit (0–5, 6, 11), minutes in
// one visit (0, 1, 2, 3, 6, 11, 21). ⛔ No user id, no device id, no message
// text, no time of day. The server adds them to a per-day, per-platform total
// (imotaraapp: src/app/api/metrics/visit, docs/sql/visit_tallies.sql).
//
// ⚠️ Owner's condition: the App Store / Play privacy forms declare this
// (App interactions / Product interaction → Analytics, not linked) BEFORE the
// build that contains it is submitted.
//
// 🔑 Bucket rules and the ±1 correction are copied from the web client
// (imotaraapp src/lib/analytics/visitTally*.ts) — the two must count alike or
// web and app numbers cannot be compared. A visit = activity with gaps under
// 30 minutes.
// ⛔ Never throws, never blocks: a lost count is not worth a broken screen.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { IMOTARA_API_BASE_URL } from "../../config/api";

export type TallyKind = "visit_age" | "session_messages" | "session_minutes" | "funnel";

/**
 * #16 (owner, 25 Nov 2026): the app's anonymous STEP counts — the same daily counts the
 * website keeps (imotaraapp src/lib/analytics/visitTally.ts FUNNEL_STEPS). Measured that
 * day: ~70% of new chatters are on the app and only ~5–8% ever come back, but the app
 * recorded none of these steps, so nobody could see where people stop.
 * ⛔ SAME NUMBERS AS THE WEB — never renumber (stored rows would change meaning).
 * ⛔ Once per device per day per step; nothing about the person, the device or the words.
 * Store forms already declare it (25 Nov 2026 checked): Play "App interactions →
 * App functionality, Analytics"; Apple "Usage Data → Product Interaction → Analytics".
 */
export const FUNNEL_STEPS = {
    invite_shown: 1,
    invite_accepted: 2,
    invite_declined: 3,
    welcome_shown: 4,
    welcome_pick: 5,
    welcome_fresh: 6,
    checkin_opened: 7,
    quota_hit: 12,
} as const;
export type FunnelStep = keyof typeof FUNNEL_STEPS;
const FUNNEL_KEY = "imotara.funnelTally.v1";
export type TallyEvent = { kind: TallyKind; bucket: number; delta: 1 | -1 };
type Visit = { start: number; last: number; messages: number; sent: { m: number; t: number } | null };
type State = { firstDay?: string; lastReportedDay?: string; visit?: Visit };

const KEY = "imotara.visitTally.v1";
export const GAP_MS = 30 * 60_000;
const ENDPOINT = "/api/metrics/visit";

/** Days since first visit: 0–30 exact, 31 = 31–90, 91 = 91+. */
export function ageBucket(days: number): number {
    const d = Math.max(0, Math.floor(days));
    return d <= 30 ? d : d <= 90 ? 31 : 91;
}
/** Messages sent in one visit: 0–5 exact, 6 = 6–10, 11 = 11+. */
export function messagesBucket(n: number): number {
    const m = Math.max(0, Math.floor(n));
    return m <= 5 ? m : m <= 10 ? 6 : 11;
}
/** Minutes in one visit: 0 = under 1, 1, 2, 3 = 3–5, 6 = 6–10, 11 = 11–20, 21 = 21+. */
export function minutesBucket(minutes: number): number {
    const m = Math.max(0, minutes);
    if (m < 1) return 0;
    if (m < 2) return 1;
    if (m < 3) return 2;
    if (m < 6) return 3;
    if (m < 11) return 6;
    if (m < 21) return 11;
    return 21;
}

/** The phone's own calendar day — age is counted in the person's days, not UTC's. */
export function localDay(now: number): string {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function daysBetween(fromDay: string, toDay: string): number {
    return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000);
}

/** The ±1 events that bring this visit's reported buckets up to date. Pure — tested. */
export function visitEvents(v: Visit, end: number): { events: TallyEvent[]; sent: { m: number; t: number } } {
    const m = messagesBucket(v.messages);
    const t = minutesBucket((end - v.start) / 60_000);
    const events: TallyEvent[] = [];
    if (v.sent?.m !== m) {
        if (v.sent) events.push({ kind: "session_messages", bucket: v.sent.m, delta: -1 });
        events.push({ kind: "session_messages", bucket: m, delta: 1 });
    }
    if (v.sent?.t !== t) {
        if (v.sent) events.push({ kind: "session_minutes", bucket: v.sent.t, delta: -1 });
        events.push({ kind: "session_minutes", bucket: t, delta: 1 });
    }
    return { events, sent: { m, t } };
}

async function load(): Promise<State> {
    try { return JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}") as State; } catch { return {}; }
}
async function save(s: State): Promise<void> {
    try { await AsyncStorage.setItem(KEY, JSON.stringify(s)); } catch { /* nothing kept, nothing sent twice */ }
}

/** Overridable for tests. */
export let sendEvents = (events: TallyEvent[]): void => {
    if (events.length === 0) return;
    try {
        void fetch(`${IMOTARA_API_BASE_URL}${ENDPOINT}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-imotara-platform": Platform.OS === "ios" ? "ios" : "android",
            },
            body: JSON.stringify({ events }),
        }).catch(() => {});
    } catch { /* never in the way */ }
};
export function __setSender(fn: (events: TallyEvent[]) => void) { sendEvents = fn; }

/** Continue the visit, or start a new one (reporting a lapsed visit never reported). */
function touch(s: State, now: number): Visit {
    const v = s.visit;
    if (v && now - v.last <= GAP_MS) {
        v.last = now;
        return v;
    }
    if (v && !v.sent) sendEvents(visitEvents(v, v.last).events);
    s.visit = { start: now, last: now, messages: 0, sent: null };
    return s.visit;
}

/** App opened or back in the foreground: once per day, report "day N since first visit". */
export async function noteVisit(now = Date.now()): Promise<void> {
    try {
        const s = await load();
        const today = localDay(now);
        if (!s.firstDay) s.firstDay = today;
        if (s.lastReportedDay !== today) {
            sendEvents([{ kind: "visit_age", bucket: ageBucket(daysBetween(s.firstDay, today)), delta: 1 }]);
            s.lastReportedDay = today;
        }
        touch(s, now);
        await save(s);
    } catch { /* never in the way */ }
}

/** Each message the person sends. */
export async function noteMessageSent(now = Date.now()): Promise<void> {
    try {
        const s = await load();
        touch(s, now).messages += 1;
        await save(s);
    } catch { /* never in the way */ }
}

/** App going to the background: report (or correct) this visit's size. */
export async function reportVisit(now = Date.now()): Promise<void> {
    try {
        const s = await load();
        const v = s.visit;
        if (!v || now - v.last > GAP_MS) return;
        v.last = now;
        const { events, sent } = visitEvents(v, now);
        sendEvents(events);
        v.sent = sent;
        await save(s);
    } catch { /* never in the way */ }
}

/** True when this step has not yet been counted today on this device. Pure — tested. */
export function funnelOncePerDay(seen: Record<string, string>, step: FunnelStep, today: string): boolean {
    return seen[step] !== today;
}

/** One anonymous step count, at most once a day per step (same rule as the web). */
export async function tallyFunnel(step: FunnelStep, now = Date.now()): Promise<void> {
    try {
        const today = localDay(now);
        let seen: Record<string, string> = {};
        try { seen = JSON.parse((await AsyncStorage.getItem(FUNNEL_KEY)) ?? "{}") as Record<string, string>; } catch { seen = {}; }
        if (!funnelOncePerDay(seen, step, today)) return;
        seen[step] = today;
        try { await AsyncStorage.setItem(FUNNEL_KEY, JSON.stringify(seen)); } catch { /* best effort */ }
        sendEvents([{ kind: "funnel", bucket: FUNNEL_STEPS[step], delta: 1 }]);
    } catch { /* never in the way */ }
}
