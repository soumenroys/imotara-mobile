// src/components/imotara/ImotaraChatBubble.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import AppSurface from "../ui/AppSurface";
import AppText from "../ui/AppText";

export type ImotaraChatBubbleProps = {
    text: string;
    isUser?: boolean;
    emotion?: string | null;
    /**
     * Sync-related flags (we'll wire these later).
     */
    isSynced?: boolean;
    isPending?: boolean;
};

export const ImotaraChatBubble: React.FC<ImotaraChatBubbleProps> = ({
    text,
    isUser = false,
    emotion = null,
    isSynced = true,
    isPending = false,
}) => {
    // For now, keep styling neutral and safe.
    // We'll hook mood-based tint and sync icons later.
    const containerAlignment = isUser ? styles.userAlign : styles.botAlign;

    return (
        <View style={[styles.row, containerAlignment]}>
            <AppSurface
                style={[
                    styles.bubble,
                    isUser ? styles.userBubble : styles.botBubble,
                ]}
            >
                <AppText size={15}>{text}</AppText>
            </AppSurface>
        </View>
    );
};

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
        maxWidth: "86%",
    },
    userBubble: {
        // subtle user-side difference (we'll refine later)
        opacity: 0.95,
    },
    botBubble: {
        opacity: 0.95,
    },
});

export default ImotaraChatBubble;
