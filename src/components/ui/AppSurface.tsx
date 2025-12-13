// src/components/ui/AppSurface.tsx
import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";

export type AppSurfaceProps = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    padding?: number;

    /**
     * Optional style knobs (non-breaking):
     * If you don't pass these, AppSurface behaves exactly like before.
     */
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    radius?: number;
};

/**
 * AppSurface
 * ----------
 * A simple reusable "card" / "surface" wrapper.
 * Defaults preserve current look, but optional props allow
 * consistent theming across Chat, History, and Settings.
 */
export const AppSurface: React.FC<AppSurfaceProps> = ({
    children,
    style,
    padding = 12,
    backgroundColor,
    borderColor,
    borderWidth,
    radius,
}) => {
    return (
        <View
            style={[
                styles.base,
                {
                    padding,
                    ...(backgroundColor ? { backgroundColor } : null),
                    ...(borderColor ? { borderColor } : null),
                    ...(typeof borderWidth === "number" ? { borderWidth } : null),
                    ...(typeof radius === "number" ? { borderRadius: radius } : null),
                },
                style,
            ]}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    base: {
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255, 255, 255, 0.08)",
        backgroundColor: "rgba(15, 15, 25, 0.9)",
    },
});

export default AppSurface;
