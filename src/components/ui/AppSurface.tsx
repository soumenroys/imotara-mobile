// src/components/ui/AppSurface.tsx
import React from "react";
import { View, ViewStyle, StyleProp } from "react-native";
import { useColors } from "../../theme/ThemeContext";

export type AppSurfaceProps = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    padding?: number;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    radius?: number;
};

export const AppSurface: React.FC<AppSurfaceProps> = ({
    children,
    style,
    padding = 12,
    backgroundColor,
    borderColor,
    borderWidth,
    radius,
}) => {
    const colors = useColors();
    return (
        <View
            style={[
                {
                    borderRadius: radius ?? 16,
                    borderWidth: borderWidth ?? 0.5,
                    borderColor: borderColor ?? colors.border,
                    backgroundColor: backgroundColor ?? colors.surface,
                    padding,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
};

export default AppSurface;
