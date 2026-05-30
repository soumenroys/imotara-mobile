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
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";

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
    icon?: string;
    iconName?: string;
    animate?: boolean;
};

// Theme-aware chip colors — dark values for dark mode, readable values for light mode
function getVariantColors(variant: AppChipVariant, isDark: boolean): { bg: string; border: string; text: string } {
    if (isDark) {
        const dark: Record<AppChipVariant, { bg: string; border: string; text: string }> = {
            neutral: { bg: "rgba(148,163,184,0.20)", border: "rgba(148,163,184,0.45)", text: "rgba(255,255,255,0.80)" },
            primary: { bg: "rgba(56,189,248,0.18)",  border: "#38bdf8",                text: "#e0f2fe" },
            success: { bg: "rgba(74,222,128,0.18)",  border: "#4ade80",                text: "#dcfce7" },
            warning: { bg: "rgba(250,204,21,0.18)",  border: "#facc15",                text: "#fef9c3" },
            danger:  { bg: "rgba(248,113,113,0.22)", border: "#f87171",                text: "#fecaca" },
        };
        return dark[variant];
    } else {
        const light: Record<AppChipVariant, { bg: string; border: string; text: string }> = {
            neutral: { bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.35)", text: "rgba(30,41,59,0.80)"  },
            primary: { bg: "rgba(14,165,233,0.10)",  border: "rgba(14,165,233,0.40)",  text: "#0369a1"             },
            success: { bg: "rgba(22,163,74,0.10)",   border: "rgba(22,163,74,0.40)",   text: "#15803d"             },
            warning: { bg: "rgba(202,138,4,0.12)",   border: "rgba(202,138,4,0.45)",   text: "#92400e"             },
            danger:  { bg: "rgba(220,38,38,0.10)",   border: "rgba(220,38,38,0.40)",   text: "#b91c1c"             },
        };
        return light[variant];
    }
}

const AppChip: React.FC<AppChipProps> = ({
    label,
    variant = "neutral",
    style,
    textStyle,
    icon,
    iconName,
    animate = false,
}) => {
    const { isDark } = useTheme();
    const vc = getVariantColors(variant, isDark);

    const scale = React.useRef(new Animated.Value(1)).current;
    const opacity = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        if (!animate) return;
        scale.stopAnimation();
        opacity.stopAnimation();
        scale.setValue(0.98);
        opacity.setValue(0.92);
        const anim = Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180, mass: 0.8 }),
            Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]);
        anim.start();
        return () => { anim.stop(); };
    }, [animate, label, variant, icon, opacity, scale]);

    const Container: any = animate ? Animated.View : View;

    return (
        <Container
            style={[
                styles.base,
                { backgroundColor: vc.bg, borderColor: vc.border },
                animate && { transform: [{ scale }], opacity },
                style,
            ]}
        >
            <View style={styles.row}>
                {iconName ? (
                    <Ionicons name={iconName as any} size={10} color={vc.text} style={{ marginRight: 6, opacity: 0.95 }} />
                ) : icon ? (
                    <Text style={[styles.icon, { color: vc.text }]}>{icon}</Text>
                ) : null}
                <Text style={[styles.text, { color: vc.text }, textStyle]}>
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
    row: { flexDirection: "row", alignItems: "center" },
    icon: { fontSize: 10, fontWeight: "700", marginRight: 6, opacity: 0.95 },
    text: { fontSize: 10, fontWeight: "500" },
});

export default AppChip;
