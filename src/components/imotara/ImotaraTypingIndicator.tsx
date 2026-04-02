// src/components/imotara/ImotaraTypingIndicator.tsx
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import AppSurface from "../ui/AppSurface";

export type ImotaraTypingIndicatorProps = {
    isUser?: boolean;
};

const DOT_SIZE = 6;
const DELAYS = [0, 150, 300];

function AnimatedDot({ delay }: { delay: number }) {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, {
                    toValue: -5,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(anim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.delay(600 - delay),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [anim, delay]);

    return (
        <Animated.View
            style={[styles.dot, { transform: [{ translateY: anim }] }]}
        />
    );
}

export const ImotaraTypingIndicator: React.FC<ImotaraTypingIndicatorProps> = ({
    isUser = false,
}) => {
    const containerAlignment = isUser ? styles.userAlign : styles.botAlign;

    return (
        <View style={[styles.row, containerAlignment]}>
            <AppSurface style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
                <View style={styles.dotsRow}>
                    {DELAYS.map((delay, i) => (
                        <AnimatedDot key={i} delay={delay} />
                    ))}
                </View>
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
        maxWidth: "40%",
        paddingVertical: 10,
        paddingHorizontal: 14,
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
