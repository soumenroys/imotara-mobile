// src/hooks/useOnlineStatus.ts
// Lightweight connectivity check — no external deps.
// Uses a HEAD request to the Imotara API (primary) so we know the actual backend
// is reachable, not just that the internet exists. Falls back to Google's
// connectivity check if the API base URL is unavailable.
// Polls every 10s; also re-checks on AppState foreground transition.

import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

// Use Google's connectivity check — returns 204 instantly, no cold-start delays,
// no Vercel/Supabase latency. Any thrown exception (timeout/DNS/network) = offline.
const CONNECTIVITY_URL = "https://connectivitycheck.gstatic.com/generate_204";
const TIMEOUT_MS = 6000;
const POLL_INTERVAL_MS = 15_000;

// Require 2 consecutive failures before flipping to offline, to avoid
// a single slow response (Vercel cold start, brief WiFi blip) triggering the banner.
let _failStreak = 0;

async function checkOnline(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        await fetch(CONNECTIVITY_URL, { method: "GET", signal: controller.signal });
        clearTimeout(timer);
        _failStreak = 0;
        return true;
    } catch {
        _failStreak += 1;
        return _failStreak < 2; // stay "online" until 2nd consecutive failure
    }
}

export function useOnlineStatus(pollIntervalMs: number = POLL_INTERVAL_MS): boolean {
    const [isOnline, setIsOnline] = useState(true);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        async function run() {
            const online = await checkOnline();
            if (mountedRef.current) setIsOnline(online);
        }

        run();

        const interval = setInterval(run, pollIntervalMs);

        const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
            if (state === "active") void run();
        });

        return () => {
            mountedRef.current = false;
            clearInterval(interval);
            sub.remove();
        };
    }, [pollIntervalMs]);

    return isOnline;
}
