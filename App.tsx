// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import { KeyboardAvoidingView, Platform, View, Text, TouchableOpacity, Linking } from "react-native";
import RootNavigator from "./src/navigation/RootNavigator";
import AppThemeProvider from "./src/theme/AppThemeProvider";
import { ThemeProvider } from "./src/theme/ThemeContext";
import HistoryProvider from "./src/state/HistoryContext";
import { SettingsProvider } from "./src/state/SettingsContext";
import { AuthProvider } from "./src/auth/AuthContext";
import Constants from "expo-constants";

// ✅ API base URL (fail-fast in prod; friendly screen here)
import { IMOTARA_API_BASE_URL } from "./src/config/api";

function buildCrashMailto(error: Error, componentStack: string): string {
  const version =
    (Constants as any)?.expoConfig?.version ??
    (Constants as any)?.manifest2?.extra?.expoClient?.version ??
    "unknown";
  const subject = encodeURIComponent("[Imotara] Crash Report");
  const body = encodeURIComponent(
    `App version: ${version}\nPlatform: ${Platform.OS} ${Platform.Version}\n\nError: ${error.name}: ${error.message}\n\nStack:\n${error.stack ?? ""}\n\nComponent stack:${componentStack}`
  );
  return `mailto:info@imotara.com?subject=${subject}&body=${body}`;
}

// ── Error boundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; componentStack: string }
> {
  state = { error: null, componentStack: "" };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  componentDidCatch(e: Error, info: React.ErrorInfo) {
    console.error("[imotara] ErrorBoundary caught:", e, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? "" });
  }
  render() {
    if (this.state.error) {
      const mailtoUrl = buildCrashMailto(this.state.error, this.state.componentStack);
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#0f172a" }}>
          <Text style={{ fontSize: 36, marginBottom: 16 }}>💔</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#f1f5f9", marginBottom: 8, textAlign: "center" }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", marginBottom: 28, lineHeight: 20 }}>
            Imotara ran into an unexpected error. Your data is safe — tap below to restart.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ error: null, componentStack: "" })}
            style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: "rgba(56,189,248,0.18)", borderWidth: 1, borderColor: "rgba(56,189,248,0.4)", marginBottom: 14 }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#38bdf8" }}>Restart app</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL(mailtoUrl).catch(() => {})}
            style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}
          >
            <Text style={{ fontSize: 13, color: "#94a3b8" }}>Send crash report</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

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
      <ThemeProvider>
      {/* Settings MUST wrap HistoryProvider because HistoryProvider calls useSettings() */}
      <AuthProvider>
      <SettingsProvider>
        <HistoryProvider>
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#0f172a" }}
            behavior={Platform.OS === "ios" ? "height" : "padding"}
            keyboardVerticalOffset={0}
          >
            <RootNavigator />
          </KeyboardAvoidingView>

          <StatusBar style="auto" />
        </HistoryProvider>
      </SettingsProvider>
      </AuthProvider>
      </ThemeProvider>
    </AppThemeProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
