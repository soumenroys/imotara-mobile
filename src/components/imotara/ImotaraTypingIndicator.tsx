// src/components/imotara/ImotaraTypingIndicator.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import AppSurface from "../ui/AppSurface";

export type ImotaraTypingIndicatorProps = {
    isUser?: boolean;
};

/**
 * ImotaraTypingIndicator
 * ----------------------
 * Simple three-dot typing indicator bubble.
 * For now, this is a static skeleton. We'll add animations later.
 */
export const ImotaraTypingIndicator: React.FC<ImotaraTypingIndicatorProps> = ({
    isUser = false,
}) => {
    const containerAlignment = isUser ? styles.userAlign : styles.botAlign;

    return (
        <View style={[styles.row, containerAlignment]}>
            <AppSurface style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
                <View style={styles.dotsRow}>
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                </View>
            </AppSurface>
        </View>
    );
};

const DOT_SIZE = 6;

const styles = StyleSheet.create({
    row: {
        width: "100%",
        marginVertical: 4,
    },
    userAlign: {
        alignItems: "flex-end",
    },
    botAlign: {
        alignItems: "flex-start",
    },
    bubble: {
        maxWidth: "40%",
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    userBubble: {
        opacity: 0.9,
    },
    botBubble: {
        opacity: 0.9,
    },
    dotsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    dot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: "rgba(255, 255, 255, 0.7)",
    },
});

export default ImotaraTypingIndicator;
