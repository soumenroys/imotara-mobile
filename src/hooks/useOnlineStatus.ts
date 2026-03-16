// src/hooks/useOnlineStatus.ts
// Lightweight connectivity check — no external deps.
// Uses a HEAD request to Google's connectivity check endpoint (204, no body).
// Polls every 15s; also re-checks on AppState foreground transition.

import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

const CHECK_URL = "https://connectivitycheck.gstatic.com/generate_204";
const TIMEOUT_MS = 3000;
const POLL_INTERVAL_MS = 15_000;

async function checkOnline(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const res = await fetch(CHECK_URL, { method: "HEAD", signal: controller.signal });
        clearTimeout(timer);
        return res.status < 500;
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
