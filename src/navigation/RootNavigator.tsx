// src/navigation/RootNavigator.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import ChatScreen from "../screens/ChatScreen";
import HistoryScreen from "../screens/HistoryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import colors from "../theme/colors";

const Tab = createBottomTabNavigator();

export default function RootNavigator() {
    return (
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
                            iconName = focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline";
                        } else if (route.name === "History") {
                            iconName = focused ? "time" : "time-outline";
                        } else {
                            // Settings
                            iconName = focused ? "settings" : "settings-outline";
                        }

                        return <Ionicons name={iconName} size={size} color={color} />;
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
    );
}
