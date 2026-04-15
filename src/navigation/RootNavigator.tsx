// src/navigation/RootNavigator.tsx
import React, { useRef, useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text, TouchableOpacity, Platform, Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChatScreen from "../screens/ChatScreen";
import HistoryScreen from "../screens/HistoryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import TrendsScreen from "../screens/TrendsScreen";
// lifecycle hook + history store
import { useAppLifecycle } from "../hooks/useAppLifecycle";
import { useHistoryStore } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";

import { OnboardingModal, type OnboardingResult } from "../components/imotara/OnboardingModal";
import { useColors } from "../theme/ThemeContext";

// ── Global sync status strip ───────────────────────────────────────────────────
function SyncStatusStrip() {
    const colors = useColors();
    const store = useHistoryStore() as any;
    const isSyncing: boolean = store.isSyncing ?? false;
    const lastSyncResult = store.lastSyncResult ?? null;
    const hasUnsyncedChanges: boolean = store.hasUnsyncedChanges ?? false;
    const [visible, setVisible] = useState(false);
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (isSyncing) {
            setMessage("Syncing…");
            setIsError(false);
            setVisible(true);
            if (hideTimer.current) clearTimeout(hideTimer.current);
            return;
        }
        if (lastSyncResult) {
            if (!lastSyncResult.ok) {
                setMessage("Sync failed — will retry");
                setIsError(true);
                setVisible(true);
                hideTimer.current = setTimeout(() => setVisible(false), 4000);
            } else if (hasUnsyncedChanges) {
                // still have unsynced items — stay quiet
                setVisible(false);
            } else {
                setMessage("Synced ✓");
                setIsError(false);
                setVisible(true);
                hideTimer.current = setTimeout(() => setVisible(false), 2500);
            }
        }
        return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
    }, [isSyncing, lastSyncResult, hasUnsyncedChanges]);

    if (!visible) return null;

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setVisible(false)}
            style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                zIndex: 999,
                backgroundColor: isError ? "rgba(239,68,68,0.92)" : "rgba(14,165,233,0.88)",
                paddingVertical: 5,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
            }}
        >
            {isSyncing && (
                <Text style={{ fontSize: 11, color: "#fff", opacity: 0.75 }}>⟳</Text>
            )}
            <Text style={{ fontSize: 12, color: "#fff", fontWeight: "600" }}>{message}</Text>
            {!isSyncing && (
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginLeft: 4 }}>tap to dismiss</Text>
            )}
        </TouchableOpacity>
    );
}

const Tab = createBottomTabNavigator();
const ONBOARDING_KEY = "imotara.onboarding.done.v1";

const linking = {
    prefixes: ["imotara://"],
    config: {
        screens: {
            Chat: "chat",
            History: "history",
            Trends: "trends",
            Settings: "settings",
        },
    },
};

export default function RootNavigator() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    useEffect(() => {
        const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
        // Delay hiding to let the resize animation fully settle before the fill View reappears
        const hide = Keyboard.addListener("keyboardDidHide", () =>
            setTimeout(() => setKeyboardVisible(false), 200)
        );
        return () => { show.remove(); hide.remove(); };
    }, []);
    // --- Lifecycle-driven "resume" sync (deduped) ---
    const history = useHistoryStore();
    const { toneContext, setToneContext, setAnalysisMode } = useSettings() as any;

    const fgSyncInFlightRef = useRef(false);
    const lastFgSyncAtRef = useRef(0);

    const runResumeSync = async () => {
        const now = Date.now();
        if (now - lastFgSyncAtRef.current < 1200) return;
        if (fgSyncInFlightRef.current) return;
        fgSyncInFlightRef.current = true;
        lastFgSyncAtRef.current = now;
        try {
            await history.runSync({ reason: "foreground" });
        } finally {
            fgSyncInFlightRef.current = false;
        }
    };

    useAppLifecycle({
        debounceMs: 400,
        onForeground: () => { void runResumeSync(); },
    });

    // --- Onboarding ---
    const [onboardingVisible, setOnboardingVisible] = useState(false);
    const [onboardingChecked, setOnboardingChecked] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
            if (!val) setOnboardingVisible(true);
            setOnboardingChecked(true);
        });
    }, []);

    const handleOnboardingComplete = async (result: OnboardingResult) => {
        setOnboardingVisible(false);
        await AsyncStorage.setItem(ONBOARDING_KEY, "1");

        // Apply settings from onboarding
        if (setAnalysisMode) setAnalysisMode(result.analysisMode);
        if (setToneContext) {
            setToneContext({
                ...(toneContext ?? {}),
                user: {
                    ...(toneContext?.user ?? {}),
                    name: result.name || toneContext?.user?.name || "",
                },
                companion: {
                    ...(toneContext?.companion ?? {}),
                    enabled: true,
                    name: toneContext?.companion?.name || "Imotara",
                    relationship: result.relationship,
                },
            });
        }
    };

    if (!onboardingChecked) return null;

    return (
        <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
            <NavigationContainer linking={linking}>
                <Tab.Navigator
                    screenOptions={({ route }) => ({
                        headerStyle: {
                            backgroundColor: colors.background,
                        },
                        headerTintColor: colors.textPrimary,
                        headerTitleStyle: {
                            fontWeight: "600",
                        },
                        tabBarStyle: {
                            backgroundColor: colors.surfaceSoft,
                            borderTopColor: colors.border,
                        },
                        tabBarHideOnKeyboard: true,
                        tabBarActiveTintColor: colors.primary,
                        tabBarInactiveTintColor: colors.textSecondary,
                        tabBarIcon: ({ color, size, focused }) => {
                            let iconName: keyof typeof Ionicons.glyphMap;

                            if (route.name === "Chat") {
                                iconName = focused
                                    ? "chatbubble-ellipses"
                                    : "chatbubble-ellipses-outline";
                            } else if (route.name === "History") {
                                iconName = focused ? "time" : "time-outline";
                            } else if (route.name === "Trends") {
                                iconName = focused ? "bar-chart" : "bar-chart-outline";
                            } else {
                                iconName = focused ? "settings" : "settings-outline";
                            }

                            return (
                                <Ionicons name={iconName} size={size} color={color} />
                            );
                        },
                    })}
                >
                    <Tab.Screen
                        name="Chat"
                        component={ChatScreen}
                        options={{ headerShown: false, title: "Chat" }}
                    />
                    <Tab.Screen
                        name="History"
                        component={HistoryScreen}
                        options={{ title: "History" }}
                    />
                    <Tab.Screen
                        name="Trends"
                        component={TrendsScreen}
                        options={{ title: "Trends" }}
                    />
                    <Tab.Screen
                        name="Settings"
                        component={SettingsScreen}
                        options={{ title: "Settings" }}
                    />
                </Tab.Navigator>
            </NavigationContainer>

            <OnboardingModal
                visible={onboardingVisible}
                onComplete={(result) => { void handleOnboardingComplete(result); }}
            />
            {/* Android: fill the safe area below the tab bar with the tab bar colour (hidden when keyboard open to avoid overlapping input) */}
            {Platform.OS === "android" && insets.bottom > 0 && !keyboardVisible && (
                <View style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: insets.bottom,
                    backgroundColor: colors.surfaceSoft,
                }} />
            )}
        </View>
    );
}
