// src/components/ui/AppSeparator.tsx
import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";

export type AppSeparatorProps = {
    style?: StyleProp<ViewStyle>;
    inset?: number; // left-right padding/inset for the line
};

/**
 * AppSeparator
 * ------------
 * A tiny horizontal divider line to separate sections.
 */
export const AppSeparator: React.FC<AppSeparatorProps> = ({
    style,
    inset = 0,
}) => {
    return (
        <View style={[styles.container, style]}>
            <View
                style={[
                    styles.line,
                    inset ? { marginLeft: inset, marginRight: inset } : null,
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: "center",
    },
    line: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "rgba(255, 255, 255, 0.12)",
    },
});

export default AppSeparator;
