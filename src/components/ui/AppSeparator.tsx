// src/components/ui/AppSeparator.tsx
import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useColors } from "../../theme/ThemeContext";

export type AppSeparatorProps = {
    style?: StyleProp<ViewStyle>;
    inset?: number;
};

export const AppSeparator: React.FC<AppSeparatorProps> = ({
    style,
    inset = 0,
}) => {
    const colors = useColors();
    return (
        <View style={[styles.container, style]}>
            <View
                style={[
                    styles.line,
                    { backgroundColor: colors.border },
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
    },
});

export default AppSeparator;
