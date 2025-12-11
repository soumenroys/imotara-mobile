// src/components/imotara/ImotaraChatBubble.tsx
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Animated } from "react-native";
import AppSurface from "../ui/AppSurface";
import AppText from "../ui/AppText";
import colors from "../../theme/colors";
import { LinearGradient } from "expo-linear-gradient";

export type ImotaraChatBubbleProps = {
    text: string;
    isUser?: boolean;
    emotion?: string | null;
    timestamp?: number | null;
    isSynced?: boolean;
    isPending?: boolean;
    source?: "cloud" | "local";
    onLongPress?: () => void;
    onRetrySync?: () => void; // retry handler
};

// ------------------------
// Mood helpers
// ------------------------
function getMoodEmoji(hint?: string | null): string {
    if (!hint) return "";
    const t = hint.toLowerCase();
    if (t.includes("low")) return "💙";
    if (t.includes("worry") || t.includes("tense")) return "💛";
    if (t.includes("upset") || t.includes("angry")) return "❤️";
    if (t.includes("stuck") || t.includes("unsure")) return "🟣";
    if (t.includes("light") || t.includes("hope")) return "💚";
    return "⚪️";
}

function getMoodTint(hint?: string | null): string {
    if (!hint) return colors.emotionNeutral;
    const t = hint.toLowerCase();
    if (t.includes("low")) return colors.emotionSad;
    if (t.includes("worry") || t.includes("tense")) return colors.emotionAnxious;
    if (t.includes("upset") || t.includes("angry")) return colors.emotionAngry;
    if (t.includes("stuck") || t.includes("unsure")) return colors.emotionConfused;
    if (t.includes("hope") || t.includes("light")) return colors.emotionHopeful;
    return colors.emotionNeutral;
}

function getMoodGradient(base: string) {
    return {
        start: base.replace("rgb", "rgba").replace(")", ", 0.55)"),
        end: base.replace("rgb", "rgba").replace(")", ", 0.95)"),
    };
}

// ------------------------
// Component
// ------------------------
export const ImotaraChatBubble: React.FC<ImotaraChatBubbleProps> = ({
    text,
    isUser = false,
    emotion = null,
    timestamp = null,
    isSynced = true,
    isPending = false,
    source = undefined,
    onLongPress,
    onRetrySync,
}) => {
    const moodEmoji = !isUser ? getMoodEmoji(emotion) : "";
    const tint = !isUser ? getMoodTint(emotion) : null;
    const gradient = tint ? getMoodGradient(tint) : null;

    // ------------------------
    // FADE-IN ANIMATION (NEW)
    // ------------------------
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
        }).start();
    }, []);

    // ------------------------
    // Sync label logic
    // ------------------------
    let syncLabel: string | null = null;
    let syncBorderColor = colors.primary;
    let syncBgColor = "rgba(56, 189, 248, 0.18)";
    let syncTextColor = colors.textPrimary;

    if (!isSynced) {
        if (isPending) {
            syncLabel = "Syncing…";
            syncBorderColor = "#fbbf24";
            syncBgColor = "rgba(251, 191, 36, 0.15)";
            syncTextColor = "#fbbf24";
        } else {
            syncLabel = "On this device only";
            syncBorderColor = "#fca5a5";
            syncBgColor = "rgba(248, 113, 113, 0.18)";
            syncTextColor = "#fecaca";
        }
    } else {
        syncLabel = "Synced to cloud";
    }

    // Source icon
    let srcIcon = "";
    if (!isUser) {
        if (source === "local") srcIcon = " 🌙";
        else if (source === "cloud") srcIcon = " ☁️";
    }

    const containerAlignment = isUser ? styles.userAlign : styles.botAlign;

    const haloStyle = !isSynced
        ? {
            backgroundColor: "rgba(248, 113, 113, 0.06)",
            borderRadius: 18,
            paddingHorizontal: 3,
            paddingVertical: 2,
        }
        : null;

    // ------------------------
    // ROTATING SYNC ICON
    // ------------------------
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isPending) {
            const loop = Animated.loop(
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 900,
                    useNativeDriver: true,
                })
            );
            loop.start();
            return () => loop.stop();
        } else {
            rotateAnim.setValue(0);
        }
    }, [isPending]);

    const Wrapper = onLongPress ? Pressable : View;

    return (
        <Animated.View style={{ opacity: fadeAnim }}>
            <View style={[styles.row, containerAlignment, haloStyle]}>
                <Wrapper onLongPress={onLongPress} delayLongPress={280}>
                    {/* USER -------------------------------------- */}
                    {isUser ? (
                        <AppSurface style={[styles.bubble, styles.userBubble]}>
                            <AppText
                                size={12}
                                weight="semibold"
                                style={{ color: colors.textSecondary, marginBottom: 2 }}
                            >
                                You
                            </AppText>

                            <AppText size={15}>{text}</AppText>

                            {timestamp && (
                                <AppText
                                    size={11}
                                    style={{ color: colors.textSecondary, marginTop: 4 }}
                                >
                                    {new Date(timestamp).toLocaleTimeString()}
                                </AppText>
                            )}

                            {/* SYNC PILL */}
                            {syncLabel && (
                                <View
                                    style={[
                                        styles.statusPill,
                                        {
                                            borderColor: syncBorderColor,
                                            backgroundColor: syncBgColor,
                                        },
                                        { alignSelf: "flex-end" },
                                    ]}
                                >
                                    {isPending ? (
                                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                                            <Animated.View
                                                style={{
                                                    marginRight: 4,
                                                    transform: [
                                                        {
                                                            rotate: rotateAnim.interpolate({
                                                                inputRange: [0, 1],
                                                                outputRange: ["0deg", "360deg"],
                                                            }),
                                                        },
                                                    ],
                                                }}
                                            >
                                                <AppText
                                                    size={11}
                                                    weight="semibold"
                                                    style={{ color: syncTextColor }}
                                                >
                                                    ⟳
                                                </AppText>
                                            </Animated.View>

                                            <AppText
                                                size={11}
                                                weight="semibold"
                                                style={{ color: syncTextColor }}
                                            >
                                                {syncLabel}
                                            </AppText>
                                        </View>
                                    ) : (
                                        <AppText
                                            size={11}
                                            weight="semibold"
                                            style={{ color: syncTextColor }}
                                        >
                                            {syncLabel}
                                        </AppText>
                                    )}
                                </View>
                            )}

                            {/* RETRY LINK */}
                            {!isSynced && !isPending && onRetrySync && (
                                <Pressable onPress={onRetrySync}>
                                    <AppText
                                        size={11}
                                        style={{
                                            color: "#93c5fd",
                                            marginTop: 4,
                                            textDecorationLine: "underline",
                                            alignSelf: "flex-end",
                                        }}
                                    >
                                        Tap to retry sync
                                    </AppText>
                                </Pressable>
                            )}
                        </AppSurface>
                    ) : (
                        /* BOT -------------------------------------- */
                        <LinearGradient
                            colors={[
                                gradient?.start || "rgba(148, 163, 184, 0.25)",
                                gradient?.end || "rgba(148, 163, 184, 0.45)",
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={[styles.bubble, styles.botBubble]}
                        >
                            <AppText
                                size={12}
                                weight="semibold"
                                style={{ color: colors.textSecondary, marginBottom: 2 }}
                            >
                                Imotara{srcIcon} {moodEmoji}
                            </AppText>

                            <AppText size={15} style={{ color: colors.textPrimary }}>
                                {text}
                            </AppText>

                            {emotion && (
                                <AppText
                                    size={11}
                                    style={{ color: colors.textSecondary, marginTop: 4 }}
                                >
                                    {emotion}
                                </AppText>
                            )}

                            {timestamp && (
                                <AppText
                                    size={11}
                                    style={{ color: colors.textSecondary, marginTop: 4 }}
                                >
                                    {new Date(timestamp).toLocaleTimeString()}
                                </AppText>
                            )}

                            {/* BOT SYNC PILL */}
                            {syncLabel && (
                                <View
                                    style={[
                                        styles.statusPill,
                                        {
                                            borderColor: syncBorderColor,
                                            backgroundColor: syncBgColor,
                                        },
                                        { alignSelf: "flex-start" },
                                    ]}
                                >
                                    {isPending ? (
                                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                                            <Animated.View
                                                style={{
                                                    marginRight: 4,
                                                    transform: [
                                                        {
                                                            rotate: rotateAnim.interpolate({
                                                                inputRange: [0, 1],
                                                                outputRange: ["0deg", "360deg"],
                                                            }),
                                                        },
                                                    ],
                                                }}
                                            >
                                                <AppText
                                                    size={11}
                                                    weight="semibold"
                                                    style={{ color: syncTextColor }}
                                                >
                                                    ⟳
                                                </AppText>
                                            </Animated.View>

                                            <AppText
                                                size={11}
                                                weight="semibold"
                                                style={{ color: syncTextColor }}
                                            >
                                                {syncLabel}
                                            </AppText>
                                        </View>
                                    ) : (
                                        <AppText
                                            size={11}
                                            weight="semibold"
                                            style={{ color: syncTextColor }}
                                        >
                                            {syncLabel}
                                        </AppText>
                                    )}
                                </View>
                            )}
                        </LinearGradient>
                    )}
                </Wrapper>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    row: {
        width: "100%",
        marginVertical: 6,
    },
    userAlign: {
        alignItems: "flex-end",
    },
    botAlign: {
        alignItems: "flex-start",
    },
    bubble: {
        maxWidth: "84%",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.4)",
    },
    userBubble: {
        backgroundColor: "rgba(56, 189, 248, 0.35)",
    },
    botBubble: {
        backgroundColor: "rgba(30, 41, 59, 0.8)",
    },
    statusPill: {
        marginTop: 6,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
});

export default ImotaraChatBubble;
