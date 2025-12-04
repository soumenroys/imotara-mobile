// src/screens/SettingsScreen.tsx
import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useHistoryStore } from "../state/HistoryContext";
import colors from "../theme/colors";
import { fetchRemoteHistory } from "../api/historyClient";

export default function SettingsScreen() {
    const { clearHistory } = useHistoryStore();

    const handleClearHistory = () => {
        Alert.alert(
            "Clear chat history?",
            "This will remove all local messages stored in this app on this device.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: () => {
                        clearHistory();
                    },
                },
            ]
        );
    };

    const handleTestRemoteHistory = async () => {
        try {
            const remote = await fetchRemoteHistory();
            const count = Array.isArray(remote) ? remote.length : 0;

            Alert.alert(
                "Remote history debug",
                `Fetched ${count} item(s) from backend.`,
                [{ text: "OK" }]
            );
        } catch (error) {
            console.error("Failed to fetch remote history:", error);
            Alert.alert(
                "Remote history error",
                "Could not connect to the Imotara backend right now. Please check your network or try again later.",
                [{ text: "OK" }]
            );
        }
    };

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: colors.background,
                paddingHorizontal: 16,
                paddingVertical: 12,
            }}
        >
            <Text
                style={{
                    fontSize: 22,
                    fontWeight: "700",
                    marginBottom: 12,
                    color: colors.textPrimary,
                }}
            >
                Settings & Privacy
            </Text>

            <Text
                style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginBottom: 24,
                }}
            >
                Imotara Mobile (local preview). Your messages are stored only on this
                device for now. In future updates, you&apos;ll control remote AI, sync,
                and Teen safety options here.
            </Text>

            {/* Local history card */}
            <View
                style={{
                    backgroundColor: colors.surfaceSoft,
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                <Text
                    style={{
                        fontSize: 14,
                        color: colors.textPrimary,
                        marginBottom: 6,
                        fontWeight: "500",
                    }}
                >
                    Local history
                </Text>
                <Text
                    style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                        marginBottom: 12,
                    }}
                >
                    Clear all chat messages stored on this device. This does not affect
                    any future cloud backups or sync features.
                </Text>

                <TouchableOpacity
                    onPress={handleClearHistory}
                    style={{
                        alignSelf: "flex-start",
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: "#fca5a5",
                        backgroundColor: "rgba(248, 113, 113, 0.12)",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: "#fecaca",
                        }}
                    >
                        Clear Local History
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Remote debug card */}
            <View
                style={{
                    backgroundColor: colors.surfaceSoft,
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                <Text
                    style={{
                        fontSize: 14,
                        color: colors.textPrimary,
                        marginBottom: 6,
                        fontWeight: "500",
                    }}
                >
                    Remote history (debug)
                </Text>
                <Text
                    style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                        marginBottom: 12,
                    }}
                >
                    Test connection to the Imotara backend and see how many history items
                    the server reports. This does not modify your local history.
                </Text>

                <TouchableOpacity
                    onPress={handleTestRemoteHistory}
                    style={{
                        alignSelf: "flex-start",
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        backgroundColor: "rgba(56, 189, 248, 0.16)",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: colors.textPrimary,
                        }}
                    >
                        Test Remote History Fetch
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
