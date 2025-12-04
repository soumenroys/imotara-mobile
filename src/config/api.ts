// src/config/api.ts
//
// Imotara backend URL for the mobile app (DEV VERSION).
// For now we point to your Mac's local IP where the Next.js app runs.
//
// IMPORTANT:
// 1) Make sure `npm run dev` is running for your web app on your Mac.
// 2) Make sure your phone and Mac are on the SAME Wi-Fi network.
// 3) Replace the IP below with your actual local IP.
//
// NEW: When running inside iOS Simulator, localhost refers to your Mac.
// This makes debugging easier without depending only on Wi-Fi IPs.

const WIFI_IP_BASE = "http://192.168.0.186:3000"; // ← your Mac’s LAN IP
const LOCALHOST_BASE = "http://localhost:3000";   // ← works inside iOS Simulator

// Small helper to detect iOS Simulator reliably
function isIosSimulator(): boolean {
    // React Native on iOS Simulator sets this global
    return typeof navigator !== "undefined" && navigator.product === "ReactNative";
}

// Final base URL (non-breaking: still uses your WiFi IP by default)
export const IMOTARA_API_BASE_URL = isIosSimulator()
    ? LOCALHOST_BASE
    : WIFI_IP_BASE;

export function buildApiUrl(path: string): string {
    const base = IMOTARA_API_BASE_URL.replace(/\/+$/, "");
    const cleanPath = path.replace(/^\/+/, "");
    return `${base}/${cleanPath}`;
}
