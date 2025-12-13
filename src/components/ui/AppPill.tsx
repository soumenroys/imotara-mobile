// src/components/ui/AppPill.tsx
import React from "react";
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    StyleProp,
    ViewStyle,
    TextStyle,
} from "react-native";

export type AppPillProps = {
    label: string;
    onPress: () => void;
    active?: boolean;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
};

/**
 * AppPill
 * -------
 * Small rounded "pill" selector used for presets (e.g., 5s / 8s / 15s).
 * Defaults are intentionally conservative; screens can still override style.
 */
export default function AppPill({
    label,
    onPress,
    active = false,
    disabled = false,
    style,
    textStyle,
}: AppPillProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected: active }}
            style={[
                styles.base,
                active ? styles.active : styles.inactive,
                disabled && styles.disabled,
                style,
            ]}
        >
            <Text
                style={[
                    styles.text,
                    active ? styles.textActive : styles.textInactive,
                    textStyle,
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    inactive: {
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(15, 23, 42, 0.9)",
    },
    active: {
        borderColor: "rgba(56, 189, 248, 0.75)",
        backgroundColor: "rgba(56, 189, 248, 0.18)",
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        fontSize: 12,
        fontWeight: "600",
    },
    textInactive: {
        color: "rgba(255,255,255,0.72)",
    },
    textActive: {
        color: "rgba(255,255,255,0.92)",
    },
});
