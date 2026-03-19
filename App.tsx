// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import { KeyboardAvoidingView, Platform, View, Text, TouchableOpacity } from "react-native";
import { useFonts } from "expo-font";
import RootNavigator from "./src/navigation/RootNavigator";
import AppThemeProvider from "./src/theme/AppThemeProvider";
import { ThemeProvider } from "./src/theme/ThemeContext";
import HistoryProvider from "./src/state/HistoryContext";
import { SettingsProvider } from "./src/state/SettingsContext";
import { AuthProvider } from "./src/auth/AuthContext";

// ✅ API base URL (fail-fast in prod; friendly screen here)
import { IMOTARA_API_BASE_URL } from "./src/config/api";

// ── Error boundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  componentDidCatch(e: Error, info: React.ErrorInfo) {
    console.error("[imotara] ErrorBoundary caught:", e, info.componentStack);
  }
  render() {
    if (this.state.error) {
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
            onPress={() => this.setState({ error: null })}
            style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: "rgba(56,189,248,0.18)", borderWidth: 1, borderColor: "rgba(56,189,248,0.4)" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#38bdf8" }}>Restart app</Text>
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
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
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
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ionicons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"),
  });

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
