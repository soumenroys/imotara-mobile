// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import { KeyboardAvoidingView, Platform, View, Text } from "react-native";
import RootNavigator from "./src/navigation/RootNavigator";
import AppThemeProvider from "./src/theme/AppThemeProvider";
import HistoryProvider from "./src/state/HistoryContext";
import { SettingsProvider } from "./src/state/SettingsContext";

// ✅ API base URL (fail-fast in prod; friendly screen here)
import { IMOTARA_API_BASE_URL } from "./src/config/api";

function AppShell() {
  // Force evaluation early so we can show a friendly screen if misconfigured.
  // This preserves dev experience and prevents silent localhost fallback in prod.
  let apiBase: string | null = null;
  try {
    apiBase = IMOTARA_API_BASE_URL;
  } catch (e) {
    apiBase = null;
  }

  if (!__DEV__ && !apiBase) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 10 }}>
          App Configuration Error
        </Text>
        <Text style={{ fontSize: 14, opacity: 0.8, textAlign: "center" }}>
          Missing EXPO_PUBLIC_IMOTARA_API_BASE_URL. Please set it in the
          production build environment (EAS/Expo env vars).
        </Text>
      </View>
    );
  }

  return (
    <AppThemeProvider>
      {/* Settings MUST wrap HistoryProvider because HistoryProvider calls useSettings() */}
      <SettingsProvider>
        <HistoryProvider>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            <RootNavigator />
          </KeyboardAvoidingView>

          <StatusBar style="auto" />
        </HistoryProvider>
      </SettingsProvider>
    </AppThemeProvider>
  );
}

export default function App() {
  // Stripe removed (Razorpay is used for donations on mobile)
  return <AppShell />;
}
