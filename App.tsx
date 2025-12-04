// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import { KeyboardAvoidingView, Platform } from "react-native";
import RootNavigator from "./src/navigation/RootNavigator";
import AppThemeProvider from "./src/theme/AppThemeProvider";
import HistoryProvider from "./src/state/HistoryContext";

export default function App() {
  return (
    <AppThemeProvider>
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
    </AppThemeProvider>
  );
}
