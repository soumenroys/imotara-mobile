// src/hooks/useOnlineStatus.ts
// Lightweight connectivity check — no external deps.
// Uses a HEAD request to Google's connectivity check endpoint (204, no body).
// Polls every 15s; also re-checks on AppState foreground transition.

import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

const CHECK_URL = "https://connectivitycheck.gstatic.com/generate_204";
const TIMEOUT_MS = 6000;       // increased from 3s — Indian networks can be briefly slow without being offline
const POLL_INTERVAL_MS = 20_000; // increased from 15s — reduces false-positive offline flashes

async function checkOnline(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        await fetch(CHECK_URL, { method: "HEAD", signal: controller.signal });
        clearTimeout(timer);
        return true; // any HTTP response (even 5xx) means network is up; only thrown exceptions mean offline
    } catch {
        return false;
    }
}

export function useOnlineStatus(): boolean {
    const [isOnline, setIsOnline] = useState(true);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        async function run() {
            const online = await checkOnline();
            if (mountedRef.current) setIsOnline(online);
        }

        run();

        const interval = setInterval(run, POLL_INTERVAL_MS);

        const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
            if (state === "active") void run();
        });

        return () => {
            mountedRef.current = false;
            clearInterval(interval);
            sub.remove();
        };
    }, []);

    return isOnline;
}
