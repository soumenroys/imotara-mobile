// src/notifications/checkInReminder.ts
// Schedules / cancels a daily "How are you feeling?" check-in reminder.
// Uses expo-notifications. Requires permission to be granted by the user.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHECKIN_NOTIFICATION_ID_KEY = "imotara.checkin.notif.id";
const CHECKIN_ENABLED_KEY = "imotara.checkin.enabled";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Default check-in time: 8:00 PM
const DEFAULT_HOUR = 20;
const DEFAULT_MINUTE = 0;

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

export async function requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === "web") return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
}

export async function scheduleCheckInReminder(
    hour = DEFAULT_HOUR,
    minute = DEFAULT_MINUTE,
): Promise<boolean> {
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    // Cancel any existing scheduled reminder first
    await cancelCheckInReminder();

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
}

export async function cancelCheckInReminder(): Promise<void> {
    const id = await AsyncStorage.getItem(CHECKIN_NOTIFICATION_ID_KEY);
    if (id) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        await AsyncStorage.removeItem(CHECKIN_NOTIFICATION_ID_KEY);
    }
    await AsyncStorage.removeItem(CHECKIN_ENABLED_KEY);
}

export async function isCheckInReminderEnabled(): Promise<boolean> {
    const val = await AsyncStorage.getItem(CHECKIN_ENABLED_KEY);
    return val === "1";
}
