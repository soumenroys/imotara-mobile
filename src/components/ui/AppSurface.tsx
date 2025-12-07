// src/components/ui/AppSurface.tsx
import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";

export type AppSurfaceProps = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    padding?: number;
};

/**
 * AppSurface
 * ----------
 * A simple reusable "card" / "surface" wrapper.
 * We’ll later hook this into the Aurora Calm theme and use it
 * across Chat, History, and Settings.
 */
export const AppSurface: React.FC<AppSurfaceProps> = ({
    children,
    style,
    padding = 12,
}) => {
    return (
        <View style={[styles.base, { padding }, style]}>
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
