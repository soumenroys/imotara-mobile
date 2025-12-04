import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function AppThemeProvider({ children }: { children: React.ReactNode }) {
    return (
        <SafeAreaProvider>
            {children}
        </SafeAreaProvider>
    );
}
