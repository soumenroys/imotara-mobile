// src/lib/emotion/regexUtils.ts

export function escapeRegexLiteral(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
