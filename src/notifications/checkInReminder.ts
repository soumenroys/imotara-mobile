// src/notifications/checkInReminder.ts
// Schedules / cancels a daily "How are you feeling?" check-in reminder.
// Uses expo-notifications with a lazy require so the app doesn't crash
// in Expo Go / Simulator builds where the native module isn't linked yet.

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CHECKIN_NOTIFICATION_ID_KEY = "imotara.checkin.notif.id";
const CHECKIN_ENABLED_KEY = "imotara.checkin.enabled";

const DEFAULT_HOUR = 20;
const DEFAULT_MINUTE = 0;

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
        return true;
    } catch {
        return false;
    }
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
