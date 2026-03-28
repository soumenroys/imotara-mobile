// src/hooks/useOnlineStatus.ts
// Lightweight connectivity check — no external deps.
// Uses a HEAD request to the Imotara API (primary) so we know the actual backend
// is reachable, not just that the internet exists. Falls back to Google's
// connectivity check if the API base URL is unavailable.
// Polls every 10s; also re-checks on AppState foreground transition.

import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { IMOTARA_API_BASE_URL } from "../config/api";

// Check actual API reachability, not just generic internet connectivity.
// Uses GET /api/health (lightweight JSON endpoint) instead of HEAD on the root —
// React Native's fetch can silently fail HEAD requests on some networks/CDNs.
const API_HEALTH_URL = IMOTARA_API_BASE_URL
    ? `${IMOTARA_API_BASE_URL}/api/health`
    : "https://connectivitycheck.gstatic.com/generate_204";
const TIMEOUT_MS = 8000;      // 8s — enough for Indian networks without being too forgiving
const POLL_INTERVAL_MS = 10_000; // reduced from 20s — halves the stale-status window

async function checkOnline(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        await fetch(API_HEALTH_URL, { method: "GET", signal: controller.signal });
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
