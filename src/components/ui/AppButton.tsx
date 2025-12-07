// src/components/ui/AppButton.tsx
import React from "react";
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    StyleProp,
    ViewStyle,
} from "react-native";

export type AppButtonProps = {
    title: string;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
    disabled?: boolean;
};

/**
 * AppButton
 * ---------
 * A simple reusable button primitive.
 * We will theme this later with Aurora Calm gradients/shadows.
 */
export const AppButton: React.FC<AppButtonProps> = ({
    title,
    onPress,
    style,
    disabled = false,
}) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={[
                styles.base,
                disabled && styles.disabled,
                style,
            ]}
        >
            <Text style={styles.text}>{title}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        backgroundColor: "#3A3F58",
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 12,
        alignItems: "center",
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "600",
    },
});

export default AppButton;
