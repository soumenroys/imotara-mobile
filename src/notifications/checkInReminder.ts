// src/notifications/checkInReminder.ts
// Schedules / cancels a daily "How are you feeling?" check-in reminder.
// Uses expo-notifications with a lazy require so the app doesn't crash
// in Expo Go / Simulator builds where the native module isn't linked yet.

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CHECKIN_NOTIFICATION_ID_KEY = "imotara.checkin.notif.id";
const CHECKIN_ENABLED_KEY = "imotara.checkin.enabled";
const CHECKIN_HOUR_KEY = "imotara.checkin.hour";
const CHECKIN_MINUTE_KEY = "imotara.checkin.minute";
const INACTIVITY_NOTIF_ID_KEY = "imotara.checkin.inactivity.id";
const CHECKIN_SOUND_KEY = "imotara.checkin.sound";
const CHECKIN_BADGE_KEY = "imotara.checkin.badge";
const INACTIVITY_HOURS_KEY = "imotara.checkin.inactivity.hours";

export const DEFAULT_HOUR = 20;
export const DEFAULT_MINUTE = 0;
export const DEFAULT_INACTIVITY_HOURS = 48;

export async function getSavedReminderTime(): Promise<{ hour: number; minute: number }> {
    try {
        const h = await AsyncStorage.getItem(CHECKIN_HOUR_KEY);
        const m = await AsyncStorage.getItem(CHECKIN_MINUTE_KEY);
        return {
            hour: h != null ? parseInt(h, 10) : DEFAULT_HOUR,
            minute: m != null ? parseInt(m, 10) : DEFAULT_MINUTE,
        };
    } catch {
        return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };
    }
}

export async function getSavedNotifPrefs(): Promise<{ sound: boolean; badge: boolean; inactivityHours: number }> {
    try {
        const [s, b, ih] = await Promise.all([
            AsyncStorage.getItem(CHECKIN_SOUND_KEY),
            AsyncStorage.getItem(CHECKIN_BADGE_KEY),
            AsyncStorage.getItem(INACTIVITY_HOURS_KEY),
        ]);
        return {
            sound: s === "1",
            badge: b === "1",
            inactivityHours: ih != null ? parseInt(ih, 10) : DEFAULT_INACTIVITY_HOURS,
        };
    } catch {
        return { sound: false, badge: false, inactivityHours: DEFAULT_INACTIVITY_HOURS };
    }
}

export async function saveNotifPrefs(prefs: { sound?: boolean; badge?: boolean; inactivityHours?: number }): Promise<void> {
    try {
        const ops: Promise<void>[] = [];
        if (prefs.sound !== undefined) ops.push(AsyncStorage.setItem(CHECKIN_SOUND_KEY, prefs.sound ? "1" : "0"));
        if (prefs.badge !== undefined) ops.push(AsyncStorage.setItem(CHECKIN_BADGE_KEY, prefs.badge ? "1" : "0"));
        if (prefs.inactivityHours !== undefined) ops.push(AsyncStorage.setItem(INACTIVITY_HOURS_KEY, String(prefs.inactivityHours)));
        await Promise.all(ops);
    } catch { /* non-fatal */ }
}

/** Returns the expo-notifications module or null if not available (Expo Go). */
function getNotifications(): typeof import("expo-notifications") | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require("expo-notifications");
        return mod;
    } catch {
        return null;
    }
}

export async function requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === "web") return false;
    const Notifications = getNotifications();
    if (!Notifications) return false;
    try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing === "granted") return true;
        const { status } = await Notifications.requestPermissionsAsync();
        return status === "granted";
    } catch {
        return false;
    }
}

export async function scheduleCheckInReminder(
    hour = DEFAULT_HOUR,
    minute = DEFAULT_MINUTE,
    sound = false,
    badge = false,
): Promise<boolean> {
    const Notifications = getNotifications();
    if (!Notifications) return false;

    const granted = await requestNotificationPermission();
    if (!granted) return false;

    await cancelCheckInReminder();

    try {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: sound,
                shouldSetBadge: badge,
            }),
        });

        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: "Imotara is here for you 💙",
                body: "How are you feeling today? A moment of reflection can make a big difference.",
                data: { type: "checkin" },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute,
            },
        });

        await AsyncStorage.setItem(CHECKIN_NOTIFICATION_ID_KEY, id);
        await AsyncStorage.setItem(CHECKIN_ENABLED_KEY, "1");
        await AsyncStorage.setItem(CHECKIN_HOUR_KEY, String(hour));
        await AsyncStorage.setItem(CHECKIN_MINUTE_KEY, String(minute));
        await saveNotifPrefs({ sound, badge });
        return true;
    } catch {
        return false;
    }
}

/**
 * Schedules a one-time "we miss you" nudge after the configured inactivity period.
 * Reads inactivityHours from saved prefs (default 48h).
 */
export async function scheduleInactivityReminder(lastActivityTs: number): Promise<void> {
    const Notifications = getNotifications();
    if (!Notifications) return;

    const enabled = await isCheckInReminderEnabled();
    if (!enabled) return;

    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Cancel previous inactivity notification
    const prevId = await AsyncStorage.getItem(INACTIVITY_NOTIF_ID_KEY);
    if (prevId) {
        await Notifications.cancelScheduledNotificationAsync(prevId).catch(() => {});
        await AsyncStorage.removeItem(INACTIVITY_NOTIF_ID_KEY);
    }

    const { inactivityHours } = await getSavedNotifPrefs();
    const thresholdMs = inactivityHours * 60 * 60 * 1000;
    const silentFor = Date.now() - lastActivityTs;
    if (silentFor >= thresholdMs) return; // already overdue — skip, daily reminder covers it

    const fireInMs = thresholdMs - silentFor;
    try {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: "Imotara misses you 💙",
                body: "It's been a while. How are you feeling? A moment of sharing can lighten the load.",
                data: { type: "inactivity" },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: Math.max(60, Math.round(fireInMs / 1000)),
                repeats: false,
            },
        });
        await AsyncStorage.setItem(INACTIVITY_NOTIF_ID_KEY, id);
    } catch { /* silent — non-critical */ }
}

export async function cancelCheckInReminder(): Promise<void> {
    const Notifications = getNotifications();
    const id = await AsyncStorage.getItem(CHECKIN_NOTIFICATION_ID_KEY);
    if (id && Notifications) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        await AsyncStorage.removeItem(CHECKIN_NOTIFICATION_ID_KEY);
    }
    await AsyncStorage.removeItem(CHECKIN_ENABLED_KEY);
}

export async function isCheckInReminderEnabled(): Promise<boolean> {
    const val = await AsyncStorage.getItem(CHECKIN_ENABLED_KEY);
    return val === "1";
}
