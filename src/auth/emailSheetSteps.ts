// src/auth/emailSheetSteps.ts — the email sheet's steps and headings (pure: no Supabase import, so tests can load it).
import type { EmailIntent } from "./emailSignInBus";

export type Step =
    | { kind: "choose" }
    | { kind: "code-email"; intent: EmailIntent }
    | { kind: "code-enter"; email: string; intent: EmailIntent }
    | { kind: "set-password"; intent: EmailIntent }
    | { kind: "password" };

/** The heading says what this step is for — "Sign in" on a reset screen read wrong (simulator, 12 Nov). */
export function sheetTitle(step: Step): string {
    if (step.kind === "set-password") return step.intent === "reset" ? "Choose a new password" : "Choose a password";
    if (step.kind === "code-email" || step.kind === "code-enter") {
        if (step.intent === "reset") return "Reset your password";
        if (step.intent === "create") return "Create your account";
    }
    return "Sign in with your email";
}
