// src/auth/AuthContext.tsx
// Handles silent session restore and zero-friction OAuth sign-in.
// Strategy:
//   1. On app start: try to restore persisted Supabase session (SecureStore).
//   2. Offer Google / Apple sign-in via a one-time bottom sheet prompt.
//   3. Once signed in the session is kept alive via Supabase autoRefreshToken.
//   4. The access_token is exposed via useAuth() for API calls.

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
} from "react";
import { Alert, Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "../lib/supabase/client";
import { buildApiUrl } from "../config/api";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";

// Required so the auth redirect can close the browser tab on iOS.
// Guarded: native module may not be available in bare Expo Go dev environment.
try { WebBrowser.maybeCompleteAuthSession(); } catch { /* no-op in Expo Go */ }

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
    status: AuthStatus;
    user: User | null;
    session: Session | null;
    /** Supabase JWT — pass as Authorization: Bearer header to /api/respond */
    accessToken: string | null;
    /** Returns {success:true} if a session was established synchronously, {success:false} otherwise.
     *  On Android the session may still arrive async via onAuthStateChange after success:false. */
    signInWithGoogle: () => Promise<{ success: boolean }>;
    signInWithApple: () => Promise<void>;
    signOut: () => Promise<void>;
    /** True if running on a device where Apple Sign In is available */
    appleSignInAvailable: boolean;
};

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
    status: "loading",
    user: null,
    session: null,
    accessToken: null,
    signInWithGoogle: async () => ({ success: false }),
    signInWithApple: async () => {},
    signOut: async () => {},
    appleSignInAvailable: false,
});

export function useAuth(): AuthContextValue {
    return useContext(AuthContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [status, setStatus] = useState<AuthStatus>("loading");
    const [appleAvailable, setAppleAvailable] = useState(false);

    // Check Apple Sign In availability once on mount
    useEffect(() => {
        if (Platform.OS === "ios") {
            AppleAuthentication.isAvailableAsync()
                .then(setAppleAvailable)
                .catch(() => setAppleAvailable(false));
        }
    }, []);

    // Restore persisted session on mount, then subscribe to auth state changes
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setStatus(data.session ? "authenticated" : "unauthenticated");
        }).catch(() => {
            // Network error or Supabase outage — treat as unauthenticated so
            // the app is usable rather than stuck on "loading" forever.
            setStatus("unauthenticated");
        });

        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event, newSession) => {
                setSession(newSession);
                setStatus(newSession ? "authenticated" : "unauthenticated");

                // LIC-4: seed free license row on sign-in (no-op if already exists)
                if (newSession?.access_token) {
                    fetchWithTimeout(buildApiUrl("/api/license/seed"), {
                        method: "POST",
                        headers: { Authorization: `Bearer ${newSession.access_token}` },
                    }, 10_000).catch(() => {});
                }
            },
        );

        return () => {
            listener.subscription.unsubscribe();
        };
    }, []);

    // ── Android deep-link auth handler ────────────────────────────────────────
    // On Android, Chrome Custom Tabs cannot intercept custom URI schemes mid-flow.
    // Instead the system fires an intent to the app with the imotara:// URL.
    // This useEffect catches that URL, extracts tokens, and sets the session
    // so onAuthStateChange fires and completes the sign-in / purchase flow.
    useEffect(() => {
        const handleAuthUrl = async (url: string) => {
            if (!url.includes("auth/callback")) return;
            try {
                const u = new URL(url);
                const src = u.hash.startsWith("#") ? u.hash.slice(1) : u.search.startsWith("?") ? u.search.slice(1) : "";
                const params = new URLSearchParams(src);
                const accessToken = params.get("access_token");
                const refreshToken = params.get("refresh_token");
                if (accessToken && refreshToken) {
                    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
                }
            } catch {
                // malformed URL — ignore
            }
        };

        // App opened cold from a deep link (Android background → foreground)
        Linking.getInitialURL().then((url) => { if (url) handleAuthUrl(url); }).catch(() => {});

        // App already running — deep link arrives while foregrounded
        const sub = Linking.addEventListener("url", ({ url }) => handleAuthUrl(url));
        return () => sub.remove();
    }, []);

    // ── Google Sign In ────────────────────────────────────────────────────────
    // Uses a relay page on imotara.com as the Supabase redirect destination.
    // The relay page reads the tokens from the URL hash and fires imotara://auth/callback#<tokens>.
    // On iOS: ASWebAuthenticationSession intercepts imotara:// and returns it to the app.
    // On Android: the system intent brings the app to foreground; the Linking handler above
    //             picks up the URL and calls supabase.auth.setSession asynchronously.
    //
    // Required Supabase config (one-time):
    //   Authentication → URL Configuration → Additional Redirect URLs →
    //   add:  https://imotara.com/auth/callback-mobile

    const MOBILE_AUTH_REDIRECT = "https://imotara.com/auth/callback-mobile";

    const signInWithGoogle = useCallback(async (): Promise<{ success: boolean }> => {
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: MOBILE_AUTH_REDIRECT,
                    skipBrowserRedirect: true,
                },
            });

            if (error || !data.url) {
                console.warn("[Auth] Google OAuth init failed:", error?.message);
                Alert.alert("Sign-in failed", "Could not start Google sign-in. Please try again.");
                return { success: false };
            }

            // callbackURLScheme:"imotara" tells ASWebAuthenticationSession (iOS) to
            // intercept ANY navigation to imotara://, including the relay page's redirect.
            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                "imotara://",
            );

            if (result.type === "success" && result.url) {
                // iOS path: relay page redirected to imotara://auth/callback#<tokens>
                // and ASWebAuthenticationSession intercepted it synchronously.
                const u = new URL(result.url);
                const src = u.hash.startsWith("#") ? u.hash.slice(1) : u.search.startsWith("?") ? u.search.slice(1) : "";
                const params = new URLSearchParams(src);
                const accessToken = params.get("access_token");
                const refreshToken = params.get("refresh_token");

                if (accessToken && refreshToken) {
                    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
                    return { success: true };
                }
            }

            // result.type === "dismiss" or "cancel":
            // On Android (including Realme/ColorOS) the relay page fires imotara:// as a system
            // intent — the browser closes and the Linking handler sets the session asynchronously.
            // Poll briefly so we can return success: true if the session arrives quickly.
            if (Platform.OS === "android") {
                const deadline = Date.now() + 5000;
                while (Date.now() < deadline) {
                    await new Promise(r => setTimeout(r, 700));
                    const { data: { session: s } } = await supabase.auth.getSession();
                    if (s) return { success: true };
                }
            }
            // iOS: user manually closed the browser — no session.
            return { success: false };
        } catch (err) {
            console.warn("[Auth] Google sign-in error:", err);
            Alert.alert("Sign-in failed", "An unexpected error occurred during Google sign-in. Please try again.");
            return { success: false };
        }
    }, []);

    // ── Apple Sign In ─────────────────────────────────────────────────────────
    // Uses the native Apple authentication sheet (iOS only).
    // The identity token is exchanged for a Supabase session.

    const signInWithApple = useCallback(async () => {
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (!credential.identityToken) {
                console.warn("[Auth] Apple: no identity token returned");
                return;
            }

            const { error } = await supabase.auth.signInWithIdToken({
                provider: "apple",
                token: credential.identityToken,
                // nonce omitted: authorizationCode is not a cryptographic nonce.
                // Supabase does not require a nonce for Apple Sign In unless configured server-side.
            });

            if (error) {
                console.warn("[Auth] Apple sign-in Supabase error:", error.message);
                Alert.alert("Sign-in failed", "Apple sign-in could not be completed. Please try again.");
            }
        } catch (err: any) {
            // ERR_CANCELED = user dismissed the sheet — not a real error
            if (err?.code !== "ERR_CANCELED") {
                console.warn("[Auth] Apple sign-in error:", err);
                Alert.alert("Sign-in failed", "An unexpected error occurred during Apple sign-in. Please try again.");
            }
        }
    }, []);

    // ── Sign Out ──────────────────────────────────────────────────────────────

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        // Clear all user-specific local data so a subsequent user on this device starts fresh
        await Promise.allSettled([
            AsyncStorage.removeItem("imotara.companion.memories.v1"),
            AsyncStorage.removeItem("imotara_settings_v1"),
            AsyncStorage.removeItem("imotara_license_tier_v1"),
        ]);
    }, []);

    // ── Context value ─────────────────────────────────────────────────────────

    const value: AuthContextValue = {
        status,
        user: session?.user ?? null,
        session,
        accessToken: session?.access_token ?? null,
        signInWithGoogle,
        signInWithApple,
        signOut,
        appleSignInAvailable: appleAvailable,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
