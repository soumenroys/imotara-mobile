// src/navigation/RootNavigator.tsx
import React, { useRef, useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBadgeCount } from "../lib/pendingInsights";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChatScreen from "../screens/ChatScreen";
import HistoryScreen from "../screens/HistoryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import TrendsScreen from "../screens/TrendsScreen";
import ConnectScreen from "../screens/connect/ConnectScreen";
// lifecycle hook + history store
import { useAppLifecycle } from "../hooks/useAppLifecycle";
import { useHistoryStore } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";
import { useAuth } from "../auth/AuthContext";
import { buildApiUrl } from "../config/api";

import { OnboardingModal, type OnboardingResult } from "../components/imotara/OnboardingModal";
import { DEFERRED, FIRST_OPEN_RESULT, shouldOfferDeferredSetup } from "../lib/onboarding/firstRun";
import { getInviteState } from "../notifications/checkInInvite";
import { useColors, useTheme } from "../theme/ThemeContext";
import * as Application from "expo-application";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { APP_VERSION } from "../config/appVersion";
import { RECHECK_AFTER_MS, deviceLocale, shouldOfferUpdate, updateStrings } from "../lib/update/updatePrompt";
import UpdateAvailableBanner, { STORE_PLATFORM, openStorePage } from "../components/imotara/UpdateAvailableBanner";
let NavigationBar: typeof import("expo-navigation-bar") | null = null;
try { NavigationBar = require("expo-navigation-bar"); } catch { /* not available in dev builds */ }

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

// https://www.imotara.com/open/<screen> is a verified App Link / Universal Link
// (public/.well-known on the web). Listing it here makes /open/chat land on
// Chat instead of just opening the app; without the app, the web sends the same
// link to /chat. Only screens the web also has should be linked this way.
const linking = {
    prefixes: ["imotara://", "https://www.imotara.com/open"],
    config: {
        screens: {
            Chat: "chat",
            History: "history",
            Trends: "trends",
            Settings: "settings",
            Connect: "connect",
        },
    },
};

export default function RootNavigator() {
    const colors = useColors();
    const { isDark } = useTheme();
    const insets = useSafeAreaInsets();

    // Set nav bar button style (light/dark icons). Background color is a no-op on
    // edge-to-edge apps (API 35+) and silently fails on older APIs — skip it and
    // instead use the outer View backgroundColor to fill behind the nav bar.
    useEffect(() => {
        if (Platform.OS !== "android") return;
        const style = isDark ? "light" : "dark";
        NavigationBar?.setButtonStyleAsync(style).catch(() => {});
    }, [isDark]);

    // --- Lifecycle-driven "resume" sync (deduped) ---
    const history = useHistoryStore();
    const { toneContext, setToneContext, setAnalysisMode } = useSettings() as any;
    const { accessToken } = useAuth();

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
        onForeground: () => { void runResumeSync(); void checkForUpdate(); },
    });

    // --- Onboarding ---
    const [onboardingVisible, setOnboardingVisible] = useState(false);

    // --- "A new version is available" (owner, 7 Nov 2026) ⇒ lib/update/updatePrompt.ts ---
    // ⛔ never on the first open: `usedBefore` turns true only when the onboarding
    // key was ALREADY there when this launch began.
    const [usedBefore, setUsedBefore] = useState(false);
    const [updateVisible, setUpdateVisible] = useState(false);
    const lastUpdateCheckRef = useRef(0);

    const checkForUpdate = async () => {
        if (!usedBefore || !STORE_PLATFORM) return;
        const now = Date.now();
        if (now - lastUpdateCheckRef.current < RECHECK_AFTER_MS) return;
        lastUpdateCheckRef.current = now;
        try {
            const r = await fetchWithTimeout(buildApiUrl("/api/app/latest-version"), {}, 8_000);
            if (!r.ok) return;
            const j = (await r.json()) as Record<string, unknown>;
            const installed = Application.nativeApplicationVersion ?? APP_VERSION;
            setUpdateVisible(shouldOfferUpdate({ firstOpen: false, installed, latest: j?.[STORE_PLATFORM] }));
        } catch {
            // offline / server down ⇒ say nothing; the next open tries again
            lastUpdateCheckRef.current = 0;
        }
    };

    useEffect(() => {
        void checkForUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usedBefore]);
    const [trendsBadge, setTrendsBadge] = useState(0);

    // #97a (owner, 7 Nov 2026): first open goes STRAIGHT TO THE CHAT with the
    // "Skip setup" defaults; the setup is offered once on a later open, after a
    // first real conversation ⇒ lib/onboarding/firstRun.ts.
    useEffect(() => {
        (async () => {
            const val = await AsyncStorage.getItem(ONBOARDING_KEY);
            // ⛔ first open ⇒ the update notice stays off too (owner, 7 Nov 2026):
            // setUsedBefore below is never reached on this launch.
            if (!val) {
                await handleOnboardingComplete(FIRST_OPEN_RESULT, DEFERRED);
                return;
            }
            setUsedBefore(true);
            if (val === DEFERRED) {
                const [inviteState, storedSettings] = await Promise.all([
                    getInviteState(),
                    AsyncStorage.getItem("imotara_settings_v1"),
                ]);
                if (shouldOfferDeferredSetup({ onboardingValue: val, inviteState, storedSettings })) {
                    setOnboardingVisible(true);
                }
            }
        })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Poll badge count every 10s so it updates after Chat computes new insights
    useEffect(() => {
        const refresh = () => getBadgeCount().then(setTrendsBadge).catch(() => {});
        refresh();
        const timer = setInterval(refresh, 10_000);
        return () => clearInterval(timer);
    }, []);

    const handleOnboardingComplete = async (result: OnboardingResult, doneValue: string = "1") => {
        setOnboardingVisible(false);
        await AsyncStorage.setItem(ONBOARDING_KEY, doneValue);

        // Apply settings from onboarding
        if (setAnalysisMode) setAnalysisMode(result.analysisMode);

        const nextToneContext = {
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
        };

        if (setToneContext) setToneContext(nextToneContext);

        // Push profile to server immediately if already signed in, so the name is
        // available on other devices without waiting for the user to visit Settings.
        if (accessToken) {
            fetch(buildApiUrl("/api/profile/sync"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(nextToneContext),
            }).catch(() => {}); // best-effort; local AsyncStorage is the source of truth
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.surfaceSoft }}>
            <NavigationContainer linking={linking}>
                <Tab.Navigator
                    backBehavior="history"
                    screenOptions={({ route }) => ({
                        sceneStyle: { backgroundColor: colors.surfaceSoft },
                        headerStyle: {
                            backgroundColor: colors.background,
                        },
                        headerTintColor: colors.textPrimary,
                        headerTitleStyle: {
                            fontWeight: "600",
                        },
                        // The tab bar does NOT hide itself when the keyboard
                        // opens — the default is false, and ChatScreen's code
                        // assumed the opposite ("the tab bar fully hides while
                        // the keyboard is open"). Measured on a Galaxy A27
                        // 2026-09-12: it sat above the keyboard, eating room
                        // and helping open a 771px dead gap on the chat screen.
                        tabBarHideOnKeyboard: true,
                        tabBarStyle: {
                            backgroundColor: colors.surfaceSoft,
                            borderTopColor: colors.border,
                            // Android: let @react-navigation/bottom-tabs auto-size — a fixed
                            // height/paddingBottom here sits behind the system nav bar on
                            // edge-to-edge builds instead of above it.
                            // iOS: pad by insets.bottom so icons sit above the home indicator.
                            ...(Platform.OS === "android"
                                ? {}
                                : { paddingBottom: insets.bottom > 0 ? insets.bottom : 4, height: 56 + (insets.bottom > 0 ? insets.bottom : 4) }),
                        },
                        tabBarVisibilityAnimationConfig: {
                            hide: { animation: "timing", config: { duration: 150 } },
                            show: { animation: "timing", config: { duration: 200, delay: 40 } },
                        },
                        gestureEnabled: true,
                        tabBarActiveTintColor: colors.primary,
                        tabBarInactiveTintColor: colors.textSecondary,
                        animation: "fade",
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
                            } else if (route.name === "Connect") {
                                iconName = focused ? "people" : "people-outline";
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
                        options={{
                            title: "Trends",
                            tabBarBadge: trendsBadge > 0 ? trendsBadge : undefined,
                            tabBarBadgeStyle: { backgroundColor: colors.primary, color: "#fff", fontSize: 10, minWidth: 16, height: 16 },
                        }}
                    />
                    <Tab.Screen
                        name="Connect"
                        component={ConnectScreen}
                        options={{ headerShown: false, title: "Connect" }}
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

            {updateVisible && STORE_PLATFORM && !onboardingVisible ? (
                <UpdateAvailableBanner
                    top={insets.top}
                    colors={colors}
                    strings={updateStrings(toneContext?.user?.preferredLang, deviceLocale())}
                    onUpdate={() => { setUpdateVisible(false); void openStorePage(STORE_PLATFORM!); }}
                    onLater={() => setUpdateVisible(false)}
                />
            ) : null}
        </View>
    );
}
