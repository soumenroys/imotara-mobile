// src/payments/androidPurchaseSafety.ts
//
// 🔴 A GOOGLE PLAY PURCHASE IS ONLY FINISHED WHEN OUR SERVER HAS CONFIRMED IT (27 Nov 2026).
//
// The audit of 27 Nov found three ways a paying Android user could lose what they paid for:
//
//   1. PENDING payments (UPI collect, cash at a shop, slow bank) were sent to verify, the server
//      answered "invalid", and the person was shown "Verification failed" — moments after paying.
//      The web route now answers HTTP 202 { ok:false, pending:true, error:"payment_pending" }.
//   2. On ANY verification failure the sheet still called finishTransaction (= acknowledge /
//      consume). An acknowledged purchase never comes back from Play as "unfinished", so nothing
//      could ever retry it — the money was taken and Plus never turned on.
//   3. The only listener lived inside UpgradeSheet. A purchase that completed while the sheet was
//      closed (every pending payment, by definition) was never verified by anybody.
//
// ⇒ Leave failed / pending purchases UNFINISHED (Play keeps them in getAvailablePurchases and
// refunds them by itself after 3 days if we never confirm — the honest outcome), and sweep them:
// once per launch and from "Restore previous plan". The server grants once per purchase token
// (web lib/imotara/claimPayment.ts), so posting the same purchase again is safe.

import { Platform } from "react-native";
import type { Purchase, PurchaseAndroid } from "expo-iap";
import { buildApiUrl } from "../config/api";
import { iosSkuToProductId, type ProductId } from "./upgradePlans";

let _iapMod: typeof import("expo-iap") | null = null;
try { _iapMod = require("expo-iap"); } catch { /* not available in dev builds / tests */ }

export type AndroidVerifyOutcome =
    | { status: "ok" }
    | { status: "pending" }
    | { status: "failed"; error: string };

/** True when Google says the money has not arrived yet (expo-iap PurchaseState = 'pending'). */
export function isPendingPurchase(purchase: Pick<Purchase, "purchaseState"> | null | undefined): boolean {
    return purchase?.purchaseState === "pending";
}

/**
 * Reads the answer of POST /api/payments/google-play/verify.
 * 202 + pending:true is the server's "not paid yet" — never a failure.
 */
export function classifyAndroidVerifyResponse(httpStatus: number, data: unknown): AndroidVerifyOutcome {
    const d = (data ?? {}) as { ok?: unknown; pending?: unknown; error?: unknown };
    if (d.ok === true) return { status: "ok" };
    if (d.pending === true || d.error === "payment_pending" || (httpStatus === 202 && d.ok !== true)) {
        return { status: "pending" };
    }
    return { status: "failed", error: typeof d.error === "string" && d.error ? d.error : "Google Play verification failed" };
}

/** The calm message for a payment Google is still processing. Plain, no blame, no "failed". */
export const PENDING_PAYMENT_TITLE = "Payment still processing";
export function pendingPaymentMessage(isTokenPack: boolean): string {
    const what = isTokenPack ? "Your credits will be added" : "Plus will turn on";
    return `Your payment is still being processed. ${what} automatically once it completes — usually within a few minutes, and at the latest the next time you open Imotara. There's no need to pay again.`;
}

/**
 * Which purchases from getAvailablePurchases still need our server. Play only lists purchases it
 * still holds: a CONSUMED credit pack disappears, so any credit pack listed is unfinished; a
 * subscription stays listed after acknowledgement, so only `isAcknowledgedAndroid !== true` counts.
 * Pending ones are skipped — there is nothing to grant until Google has the money.
 */
export function purchasesNeedingVerification(purchases: readonly Purchase[]): Array<{ purchase: Purchase; productId: ProductId; isTokenPack: boolean; purchaseToken: string }> {
    const out: Array<{ purchase: Purchase; productId: ProductId; isTokenPack: boolean; purchaseToken: string }> = [];
    for (const purchase of purchases) {
        const productId = iosSkuToProductId(purchase.productId ?? "");
        if (!productId) continue;
        if (isPendingPurchase(purchase)) continue;
        const purchaseToken = purchase.purchaseToken ?? "";
        if (!purchaseToken) continue;
        const isTokenPack = productId.startsWith("tokens_");
        if (!isTokenPack && (purchase as PurchaseAndroid).isAcknowledgedAndroid === true) continue;
        out.push({ purchase, productId, isTokenPack, purchaseToken });
    }
    return out;
}

export type RecoveryResult = { grantedPlans: number; grantedCredits: number; pending: number; failed: number };

export type RecoveryDeps = {
    initConnection: () => Promise<unknown>;
    getAvailablePurchases: () => Promise<Purchase[]>;
    finishTransaction: (args: { purchase: Purchase; isConsumable: boolean }) => Promise<unknown>;
    fetchImpl: typeof fetch;
};

function defaultDeps(): RecoveryDeps | null {
    if (!_iapMod) return null;
    const iap = _iapMod;
    return {
        initConnection: () => iap.initConnection(),
        getAvailablePurchases: () => iap.getAvailablePurchases(),
        finishTransaction: ({ purchase, isConsumable }) => iap.finishTransaction({ purchase, isConsumable }),
        fetchImpl: fetch,
    };
}

// AbortSignal.timeout() is not available on Hermes — same helper as UpgradeSheet.
function fetchWithTimeout(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetchImpl(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/**
 * Sends every unfinished Plus / credit purchase on this Play account to the verify route and
 * finishes ONLY those the server confirms. Never throws; Android only.
 */
export async function recoverAndroidPurchases(accessToken: string, deps: RecoveryDeps | null = defaultDeps()): Promise<RecoveryResult> {
    const result: RecoveryResult = { grantedPlans: 0, grantedCredits: 0, pending: 0, failed: 0 };
    if (Platform.OS !== "android" || !deps || !accessToken) return result;
    try {
        // initConnection is idempotent in expo-iap (returns at once when already connected), and
        // getAvailablePurchases fails on a cold Billing client — so this works with the sheet closed.
        await deps.initConnection();
        const all = await deps.getAvailablePurchases();
        result.pending = all.filter((p) => isPendingPurchase(p) && !!iosSkuToProductId(p.productId ?? "")).length;
        for (const item of purchasesNeedingVerification(all)) {
            let outcome: AndroidVerifyOutcome;
            try {
                const res = await fetchWithTimeout(deps.fetchImpl, buildApiUrl("/api/payments/google-play/verify"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({ productId: item.productId, purchaseToken: item.purchaseToken }),
                }, 30_000);
                const data = await res.json().catch(() => ({}));
                outcome = classifyAndroidVerifyResponse(res.status, data);
            } catch {
                outcome = { status: "failed", error: "network" };
            }
            if (outcome.status === "ok") {
                try { await deps.finishTransaction({ purchase: item.purchase, isConsumable: item.isTokenPack }); } catch { /* granted; Play retries the ack next sweep */ }
                if (item.isTokenPack) result.grantedCredits++; else result.grantedPlans++;
            } else if (outcome.status === "pending") {
                result.pending++;
            } else {
                // ⛔ Not finished — it stays in the list for the next sweep.
                result.failed++;
            }
        }
    } catch {
        // Billing unavailable (no Play services, offline): nothing lost, the next launch tries again.
    }
    return result;
}

let launchSweepStarted = false;

/** Once per app launch (module state): the first signed-in, non-guest session triggers the sweep. */
export function recoverAndroidPurchasesOncePerLaunch(accessToken: string, deps?: RecoveryDeps | null): Promise<RecoveryResult> | null {
    if (Platform.OS !== "android" || launchSweepStarted || !accessToken) return null;
    launchSweepStarted = true;
    return deps === undefined ? recoverAndroidPurchases(accessToken) : recoverAndroidPurchases(accessToken, deps);
}

/** Tests only. */
export function __resetLaunchSweepForTests(): void { launchSweepStarted = false; }
