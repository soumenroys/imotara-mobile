// src/auth/SignInPrompt.tsx
// Non-intrusive one-time sign-in prompt shown after the user's first message.
// Appears as a bottom sheet — user can dismiss it permanently.
// No username or password required: only Google and Apple OAuth.

import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Animated,
    Platform,
    Pressable,
    Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

const DISMISSED_KEY = "imotara.auth.prompt.dismissed.v1";

// Number of messages to wait before showing the prompt
const SHOW_AFTER_MESSAGES = 1;

type Props = {
    messageCount: number;
};

export function SignInPrompt({ messageCount }: Props) {
    const { status, signInWithGoogle, signInWithApple, appleSignInAvailable } =
        useAuth();
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(true); // start hidden until loaded
    const [signingIn, setSigningIn] = useState(false);
    const slideAnim = React.useRef(new Animated.Value(300)).current;

    // Load dismissed flag
    useEffect(() => {
        AsyncStorage.getItem(DISMISSED_KEY).then((val) => {
            setDismissed(val === "true");
        });
    }, []);

    // Show when threshold reached, user is not signed in, and not dismissed
    useEffect(() => {
        if (
            !dismissed &&
            status === "unauthenticated" &&
            messageCount >= SHOW_AFTER_MESSAGES
        ) {
            setVisible(true);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        }
    }, [dismissed, status, messageCount, slideAnim]);

    const handleDismiss = async () => {
        Animated.timing(slideAnim, {
            toValue: 300,
            duration: 200,
            useNativeDriver: true,
        }).start(() => setVisible(false));
        setDismissed(true);
        await AsyncStorage.setItem(DISMISSED_KEY, "true");
    };

    const handleGoogle = async () => {
        if (signingIn) return;
        setSigningIn(true);
        try { await signInWithGoogle(); await handleDismiss(); } finally { setSigningIn(false); }
    };

    const handleApple = async () => {
        if (signingIn) return;
        setSigningIn(true);
        try { await signInWithApple(); await handleDismiss(); } finally { setSigningIn(false); }
    };

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleDismiss}
        >
            <Pressable style={styles.backdrop} onPress={handleDismiss}>
                <Animated.View
                    style={[
                        styles.sheet,
                        { transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    {/* Stop backdrop press propagating into the sheet */}
                    <Pressable>
                        <View style={styles.handle} />

                        <Text style={styles.title}>Remember you, always</Text>
                        <Text style={styles.subtitle}>
                            Sign in once so Imotara can remember how you feel over time —
                            even if you switch devices. No account creation needed.
                        </Text>

                        {/* Google button */}
                        <TouchableOpacity
                            style={[styles.googleBtn, signingIn && { opacity: 0.5 }]}
                            onPress={handleGoogle}
                            disabled={signingIn}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.googleBtnText}>{signingIn ? "Signing in…" : "Continue with Google"}</Text>
                        </TouchableOpacity>

                        {/* Apple button — iOS only */}
                        {Platform.OS === "ios" && appleSignInAvailable && (
                            <TouchableOpacity
                                style={[styles.appleBtn, signingIn && { opacity: 0.5 }]}
                                onPress={handleApple}
                                disabled={signingIn}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.appleBtnText}>{signingIn ? "Signing in…" : " Continue with Apple"}</Text>
                            </TouchableOpacity>
                        )}

                        {/* Not now */}
                        <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={handleDismiss}
                            activeOpacity={0.6}
                        >
                            <Text style={styles.skipText}>Not now</Text>
                        </TouchableOpacity>

                        {/* Privacy & Terms links — required by Apple & Google */}
                        <View style={styles.legalRow}>
                            <TouchableOpacity onPress={() => Linking.openURL("https://imotara.com/privacy").catch(() => {})}>
                                <Text style={styles.legalLink}>Privacy Policy</Text>
                            </TouchableOpacity>
                            <Text style={styles.legalSep}>·</Text>
                            <TouchableOpacity onPress={() => Linking.openURL("https://imotara.com/terms").catch(() => {})}>
                                <Text style={styles.legalLink}>Terms of Use</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: "#1a1a2e",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === "ios" ? 40 : 28,
        paddingTop: 12,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: 20,
    },
    title: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 8,
        textAlign: "center",
    },
    subtitle: {
        color: "rgba(255,255,255,0.65)",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
        marginBottom: 28,
    },
    googleBtn: {
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 12,
    },
    googleBtnText: {
        color: "#1a1a2e",
        fontWeight: "600",
        fontSize: 16,
    },
    appleBtn: {
        backgroundColor: "#000",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 12,
    },
    appleBtnText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
    skipBtn: {
        paddingVertical: 10,
        alignItems: "center",
    },
    skipText: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 14,
    },
    legalRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 12,
        gap: 6,
    },
    legalLink: {
        color: "rgba(255,255,255,0.35)",
        fontSize: 12,
        textDecorationLine: "underline",
    },
    legalSep: {
        color: "rgba(255,255,255,0.2)",
        fontSize: 12,
    },
});
