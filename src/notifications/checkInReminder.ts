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

export const DEFAULT_HOUR = 20;
export const DEFAULT_MINUTE = 0;

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
): Promise<boolean> {
    const Notifications = getNotifications();
    if (!Notifications) return false;

    const granted = await requestNotificationPermission();
    if (!granted) return false;

    await cancelCheckInReminder();

    try {
        // Set the handler (safe to call multiple times)
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: false,
                shouldSetBadge: false,
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
        return true;
    } catch {
        return false;
    }
}

/**
 * Schedules a one-time "we miss you" nudge 48 h after the user's last activity.
 * Call this from the app's background task or on app foreground whenever the
 * daily reminder is enabled and the user hasn't chatted recently.
 * Safe to call multiple times — cancels any previous inactivity notification first.
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

    const silentFor = Date.now() - lastActivityTs;
    const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
    if (silentFor >= TWO_DAYS_MS) return; // already overdue — skip, daily reminder covers it

    const fireInMs = TWO_DAYS_MS - silentFor;
    try {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: "Imotara misses you 💙",
                body: "It's been a couple of days. How are you feeling? A moment of sharing can lighten the load.",
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
