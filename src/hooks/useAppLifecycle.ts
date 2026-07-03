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

    // Store callbacks in refs so the AppState listener never needs to be
    // torn down and re-registered when the caller's function identity changes.
    // Without this, an inline onBackground in ChatScreen causes the subscription
    // to be removed and re-added every 500ms during recording (setDurationMs
    // fires every 500ms), creating a window where an AppState event is silently
    // dropped — leaving the recording stuck after backgrounding.
    const onForegroundRef = useRef(onForeground);
    const onBackgroundRef = useRef(onBackground);
    useEffect(() => { onForegroundRef.current = onForeground; });
    useEffect(() => { onBackgroundRef.current = onBackground; });

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
                onForegroundRef.current?.({ from: prev, to: next, at: now });
                return;
            }

            // Background: active -> inactive/background
            if (isBackgroundish(next) && prev === "active") {
                onBackgroundRef.current?.({ from: prev, to: next, at: now });
                return;
            }
        });

        return () => {
            sub.remove();
        };
    // Callbacks intentionally excluded — they are read via refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounceMs, isBackgroundish]);

    return {
        appState,
        isActive: appState === "active",
        isBackground: isBackgroundish(appState),
        lastKnownStateRef: lastStateRef,
    };
}
