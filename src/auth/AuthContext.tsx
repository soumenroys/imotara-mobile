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
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "../lib/supabase/client";

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
    signInWithGoogle: () => Promise<void>;
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
    signInWithGoogle: async () => {},
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
        });

        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event, newSession) => {
                setSession(newSession);
                setStatus(newSession ? "authenticated" : "unauthenticated");
            },
        );

        return () => {
            listener.subscription.unsubscribe();
        };
    }, []);

    // ── Google Sign In ────────────────────────────────────────────────────────
    // Uses expo-auth-session to open a browser-based OAuth flow.
    // Supabase generates the OAuth URL; the redirect lands back in the app.

    const signInWithGoogle = useCallback(async () => {
        try {
            const redirectTo = AuthSession.makeRedirectUri({ scheme: "imotara" });

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                },
            });

            if (error || !data.url) {
                console.warn("[Auth] Google OAuth init failed:", error?.message);
                Alert.alert("Sign-in failed", "Could not start Google sign-in. Please try again.");
                return;
            }

            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                redirectTo,
            );

            if (result.type === "success" && result.url) {
                // Extract tokens from the redirect URL fragment
                const url = new URL(result.url);
                const params = new URLSearchParams(
                    url.hash.startsWith("#") ? url.hash.slice(1) : url.search.slice(1),
                );
                const accessToken = params.get("access_token");
                const refreshToken = params.get("refresh_token");

                if (accessToken && refreshToken) {
                    await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                }
            }
        } catch (err) {
            console.warn("[Auth] Google sign-in error:", err);
            Alert.alert("Sign-in failed", "An unexpected error occurred during Google sign-in. Please try again.");
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
