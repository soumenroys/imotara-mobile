// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import { KeyboardAvoidingView, Platform } from "react-native";
import RootNavigator from "./src/navigation/RootNavigator";
import AppThemeProvider from "./src/theme/AppThemeProvider";
import HistoryProvider from "./src/state/HistoryContext";
import { SettingsProvider } from "./src/state/SettingsContext";

// ✅ Stripe (Donate / future licensing payments)
import { StripeProvider } from "@stripe/stripe-react-native";
import { STRIPE_ENABLED, STRIPE_PUBLISHABLE_KEY } from "./src/payments/stripe";

function AppShell() {
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
  // ✅ If Stripe isn't configured, run the app normally (Donate UI can still show “Coming soon”)
  if (!STRIPE_ENABLED) {
    return <AppShell />;
  }

  // ✅ When configured, provide Stripe context for PaymentSheet / future IAP-like flows
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <AppShell />
    </StripeProvider>
  );
}
