// src/components/imotara/ImotaraTypingIndicator.tsx
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import AppSurface from "../ui/AppSurface";
import { useColors } from "../../theme/ThemeContext";

export type ImotaraTypingIndicatorProps = {
    isUser?: boolean;
    speed?: "slow" | "normal" | "fast";
};

const DOT_SIZE = 6;
const BASE_DELAYS = [0, 150, 300];

function AnimatedDot({ delay, duration, color }: { delay: number; duration: number; color?: string }) {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, {
                    toValue: -5,
                    duration,
                    useNativeDriver: true,
                }),
                Animated.timing(anim, {
                    toValue: 0,
                    duration,
                    useNativeDriver: true,
                }),
                Animated.delay(duration * 2 - delay),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [anim, delay, duration]);

    return (
        <Animated.View
            style={[styles.dot, { transform: [{ translateY: anim }], ...(color ? { backgroundColor: color } : {}) }]}
        />
    );
}

export const ImotaraTypingIndicator: React.FC<ImotaraTypingIndicatorProps> = ({
    isUser = false,
    speed = "normal",
}) => {
    const colors = useColors();
    const containerAlignment = isUser ? styles.userAlign : styles.botAlign;
    const duration = speed === "slow" ? 500 : speed === "fast" ? 180 : 300;
    const delayStep = speed === "slow" ? 220 : speed === "fast" ? 80 : 150;
    const delays = BASE_DELAYS.map((_, i) => i * delayStep);

    return (
        <View style={[styles.row, containerAlignment]}>
            <AppSurface style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
                <View style={styles.dotsRow}>
                    {delays.map((delay, i) => (
                        <AnimatedDot key={i} delay={delay} duration={duration} color={colors.textSecondary} />
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
