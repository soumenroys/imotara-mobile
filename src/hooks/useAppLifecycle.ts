// src/hooks/useAppLifecycle.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * App lifecycle helper for background/foreground transitions.
 *
 * Goals:
 * - Provide a single, reusable place to observe AppState transitions.
 * - Prevent duplicate foreground triggers on quick app switches.
 * - Keep behavior opt-in (no existing functionality changes until you wire it in).
 */
export type AppLifecycleOptions = {
    /** Called when app becomes active (background/inactive -> active). */
    onForeground?: (info: { from: AppStateStatus; to: AppStateStatus; at: number }) => void;
    /** Called when app leaves active (active -> inactive/background). */
    onBackground?: (info: { from: AppStateStatus; to: AppStateStatus; at: number }) => void;
    /**
     * Ignore transitions that happen too quickly back-to-back.
     * Helps avoid duplicate sync calls on rapid switches.
     */
    debounceMs?: number;
    /**
     * If true, treat "inactive" as background-ish (iOS often uses inactive briefly).
     * Default: true
     */
    treatInactiveAsBackground?: boolean;
};

export function useAppLifecycle(options: AppLifecycleOptions = {}) {
    const {
        onForeground,
        onBackground,
        debounceMs = 350,
        treatInactiveAsBackground = true,
    } = options;

    const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

    const lastStateRef = useRef<AppStateStatus>(AppState.currentState);
    const lastEventAtRef = useRef<number>(0);

    const isBackgroundish = useMemo(() => {
        return (s: AppStateStatus) =>
            s === "background" || (treatInactiveAsBackground && s === "inactive");
    }, [treatInactiveAsBackground]);

    useEffect(() => {
        const sub = AppState.addEventListener("change", (next) => {
            const prev = lastStateRef.current;
            const now = Date.now();

            // Always keep state updated for UI consumers.
            lastStateRef.current = next;
            setAppState(next);

            // Debounce: ignore rapid flip-flops that often cause double work.
            if (debounceMs > 0 && now - lastEventAtRef.current < debounceMs) {
                return;
            }
            lastEventAtRef.current = now;

            // Foreground: background/inactive -> active
            if (next === "active" && isBackgroundish(prev)) {
                onForeground?.({ from: prev, to: next, at: now });
                return;
            }

            // Background: active -> inactive/background
            if (isBackgroundish(next) && prev === "active") {
                onBackground?.({ from: prev, to: next, at: now });
                return;
            }
        });

        return () => {
            sub.remove();
        };
    }, [debounceMs, isBackgroundish, onBackground, onForeground]);

    return {
        appState,
        isActive: appState === "active",
        isBackground: isBackgroundish(appState),
        lastKnownStateRef: lastStateRef,
    };
}
