// src/components/ui/AppText.tsx
import React from "react";
import { Text, StyleSheet, TextStyle, StyleProp } from "react-native";

export type AppTextProps = {
    children: React.ReactNode;
    style?: StyleProp<TextStyle>;
    weight?: "regular" | "medium" | "semibold" | "bold";
    size?: number;
    color?: string;
};

/**
 * AppText
 * -------
 * Simple wrapper around <Text> that lets us standardize
 * fonts, sizes, and weights later.
 */
export const AppText: React.FC<AppTextProps> = ({
    children,
    style,
    weight = "regular",
    size = 16,
    color = "#ffffff",
}) => {
    return (
        <Text
            style={[
                styles.base,
                styles[weight],
                { fontSize: size, color },
                style,
            ]}
        >
            {children}
        </Text>
    );
};

const styles = StyleSheet.create({
    base: {
        letterSpacing: 0.2,
    },
    regular: {
        fontWeight: "400",
    },
    medium: {
        fontWeight: "500",
    },
    semibold: {
        fontWeight: "600",
    },
    bold: {
        fontWeight: "700",
    },
});

export default AppText;
