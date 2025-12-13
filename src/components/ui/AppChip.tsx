// src/components/ui/AppChip.tsx
import React from "react";
import {
    View,
    Text,
    StyleSheet,
    StyleProp,
    ViewStyle,
    TextStyle,
    Animated,
} from "react-native";

export type AppChipVariant =
    | "neutral"
    | "primary"
    | "success"
    | "warning"
    | "danger";

export type AppChipProps = {
    label: string;
    variant?: AppChipVariant;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;

    /**
     * Optional icon (e.g., "✓", "⚠", "☁")
     * Non-breaking: if omitted, renders label only.
     */
    icon?: string;

    /**
     * Non-breaking enhancement:
     * - default false → existing chips stay static
     * - when true → subtle pulse + tiny fade
     */
    animate?: boolean;
};

/**
 * AppChip
 * --------
 * Small status / badge / pill component.
 * Pure UI primitive — no logic.
 *
 * Safe defaults:
 * - variant: "neutral"
 * - animate: false
 * - icon: undefined (no icon shown)
 */
const AppChip: React.FC<AppChipProps> = ({
    label,
    variant = "neutral",
    style,
    textStyle,
    icon,
    animate = false,
}) => {
    const scale = React.useRef(new Animated.Value(1)).current;
    const opacity = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        if (!animate) return;

        // Stop any in-flight animations before resetting (QA stability)
        scale.stopAnimation();
        opacity.stopAnimation();

        scale.setValue(0.98);
        opacity.setValue(0.92);

        const anim = Animated.parallel([
            Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
                damping: 14,
                stiffness: 180,
                mass: 0.8,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }),
        ]);

        anim.start();

        return () => {
            // Prevent warnings if parent unmounts mid-animation
            anim.stop();
        };
        // Only re-pulse when the visible content or mood changes
    }, [animate, label, variant, icon, opacity, scale]);

    const Container: any = animate ? Animated.View : View;

    return (
        <Container
            style={[
                styles.base,
                variantStyles.container[variant],
                animate && { transform: [{ scale }], opacity },
                style,
            ]}
        >
            <View style={styles.row}>
                {icon ? (
                    <Text style={[styles.icon, variantStyles.text[variant]]}>
                        {icon}
                    </Text>
                ) : null}

                <Text style={[styles.text, variantStyles.text[variant], textStyle]}>
                    {label}
                </Text>
            </View>
        </Container>
    );
};

const styles = StyleSheet.create({
    base: {
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
    },
    icon: {
        fontSize: 10,
        fontWeight: "700",
        marginRight: 6,
        opacity: 0.95,
    },
    text: {
        fontSize: 10,
        fontWeight: "500",
    },
});

const variantStyles = {
    container: StyleSheet.create({
        neutral: {
            backgroundColor: "rgba(148, 163, 184, 0.20)",
            borderColor: "#9ca3af",
        },
        primary: {
            backgroundColor: "rgba(56, 189, 248, 0.18)",
            borderColor: "#38bdf8",
        },
        success: {
            backgroundColor: "rgba(74, 222, 128, 0.18)",
            borderColor: "#4ade80",
        },
        warning: {
            backgroundColor: "rgba(250, 204, 21, 0.18)",
            borderColor: "#facc15",
        },
        danger: {
            backgroundColor: "rgba(248, 113, 113, 0.22)",
            borderColor: "#f87171",
        },
    }),
    text: StyleSheet.create({
        neutral: {
            color: "rgba(255,255,255,0.85)",
        },
        primary: {
            color: "#e0f2fe",
        },
        success: {
            color: "#dcfce7",
        },
        warning: {
            color: "#fef9c3",
        },
        danger: {
            color: "#fecaca",
        },
    }),
};

export default AppChip;
