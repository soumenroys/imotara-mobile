// src/navigation/RootNavigator.tsx
import React, { useRef, useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ChatScreen from "../screens/ChatScreen";
import HistoryScreen from "../screens/HistoryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import colors from "../theme/colors";

// lifecycle hook + history store
import { useAppLifecycle } from "../hooks/useAppLifecycle";
import { useHistoryStore } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";

import { OnboardingModal, type OnboardingResult } from "../components/imotara/OnboardingModal";

const Tab = createBottomTabNavigator();
const ONBOARDING_KEY = "imotara.onboarding.done.v1";

export default function RootNavigator() {
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
        <>
            <NavigationContainer>
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
                        options={{ title: "Chat" }}
                    />
                    <Tab.Screen
                        name="History"
                        component={HistoryScreen}
                        options={{ title: "History" }}
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
        </>
    );
}
