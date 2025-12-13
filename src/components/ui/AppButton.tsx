// src/components/ui/AppButton.tsx
import React, { useCallback, useRef } from "react";
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    StyleProp,
    ViewStyle,
    TextStyle,
} from "react-native";

export type AppButtonVariant =
    | "primary"
    | "secondary"
    | "destructive"
    | "ghost"
    | "success";

export type AppButtonProps = {
    title: string;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    disabled?: boolean;

    /**
     * Non-breaking enhancement:
     * Defaults to "primary" so existing usage remains visually identical.
     */
    variant?: AppButtonVariant;

    /**
     * Optional size control (safe default = "md")
     */
    size?: "sm" | "md";

    /**
     * QA stability: optional loading state.
     * - When true, button becomes non-interactive.
     * - We keep the label visible (adds a subtle suffix).
     */
    loading?: boolean;

    /**
     * QA stability: prevent accidental double-taps.
     * Default 450ms is a good “human tap” guard without feeling laggy.
     */
    debounceMs?: number;
};

/**
 * AppButton
 * ---------
 * A simple reusable button primitive.
 * Adds safe variants so we can keep consistent hierarchy across the app.
 *
 * Defaults preserve current behavior:
 * - variant: "primary"
 * - size: "md"
 * - loading: false
 * - debounceMs: 450
 */
export const AppButton: React.FC<AppButtonProps> = ({
    title,
    onPress,
    style,
    textStyle,
    disabled = false,
    variant = "primary",
    size = "md",
    loading = false,
    debounceMs = 450,
}) => {
    // Prevent double-presses without changing any upstream logic
    const lastPressAtRef = useRef<number>(0);

    const isDisabled = disabled || loading;

    const handlePress = useCallback(() => {
        if (isDisabled) return;

        const now = Date.now();
        const last = lastPressAtRef.current;

        if (debounceMs > 0 && now - last < debounceMs) {
            return;
        }

        lastPressAtRef.current = now;
        onPress();
    }, [debounceMs, isDisabled, onPress]);

    const label = loading ? `${title}…` : title;

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            style={[
                styles.base,
                size === "sm" ? styles.sizeSm : styles.sizeMd,
                variantStyles.container[variant],
                isDisabled && styles.disabled,
                style,
            ]}
        >
            <Text style={[styles.text, variantStyles.text[variant], textStyle]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
    },
    sizeMd: {
        paddingVertical: 12,
        paddingHorizontal: 18,
    },
    sizeSm: {
        paddingVertical: 9,
        paddingHorizontal: 14,
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        fontSize: 15,
        fontWeight: "600",
    },
});

/**
 * Variant palette:
 * - primary: current look (backward compatible)
 * - secondary: softer outline/button for non-primary actions
 * - destructive: for delete/clear actions
 * - ghost: minimal, text-like action
 * - success: used for safe debug/load actions (HistoryScreen)
 */
const variantStyles = {
    container: StyleSheet.create({
        primary: {
            backgroundColor: "#3A3F58", // previous default
            borderColor: "rgba(255,255,255,0.12)",
        },
        secondary: {
            backgroundColor: "rgba(58, 63, 88, 0.35)",
            borderColor: "rgba(255,255,255,0.14)",
        },
        destructive: {
            backgroundColor: "rgba(248, 113, 113, 0.14)",
            borderColor: "rgba(248, 113, 113, 0.55)",
        },
        ghost: {
            backgroundColor: "transparent",
            borderColor: "rgba(255,255,255,0.10)",
        },
        success: {
            backgroundColor: "rgba(34, 197, 94, 0.14)",
            borderColor: "rgba(34, 197, 94, 0.55)",
        },
    }),
    text: StyleSheet.create({
        primary: {
            color: "#ffffff",
        },
        secondary: {
            color: "#ffffff",
        },
        destructive: {
            color: "#fecaca",
        },
        ghost: {
            color: "rgba(255,255,255,0.85)",
        },
        success: {
            color: "rgba(187, 247, 208, 1)",
        },
    }),
};

export default AppButton;
