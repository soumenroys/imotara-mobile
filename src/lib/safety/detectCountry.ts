/**
 * Detect the user's country code (ISO 3166-1 alpha-2) using the standard
 * Intl API — no native modules or extra packages required.
 *
 * Strategy:
 *  1. Intl.DateTimeFormat locale region tag  (e.g. "en-IN" → "IN")
 *  2. navigator.language region tag          (e.g. "de-DE" → "DE")
 *  3. Timezone-to-country heuristic for common unambiguous zones
 *  4. null if nothing is deterministic
 */
export function detectCountryCode(): string | null {
    try {
        // 1. Intl locale (most reliable on modern RN/JSC/Hermes)
        const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
        const fromIntl = extractRegion(intlLocale);
        if (fromIntl) return fromIntl;

        // 2. navigator.language (fallback)
        const navLang =
            (typeof navigator !== "undefined" ? navigator.language : "") ?? "";
        const fromNav = extractRegion(navLang);
        if (fromNav) return fromNav;

        // 3. Timezone heuristic for unambiguous single-country zones
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
        const fromTz = tzToCountry(tz);
        if (fromTz) return fromTz;
    } catch {
        // Intl may not be available in very old RN environments
    }
    return null;
}

/** Extracts 2-letter region from a BCP-47 tag like "en-IN" or "zh-Hans-CN". */
function extractRegion(tag: string): string | null {
    const parts = tag.split(/[-_]/);
    // Region subtag is always 2 uppercase letters (ISO 3166-1 alpha-2)
    for (let i = parts.length - 1; i >= 1; i--) {
        if (/^[A-Za-z]{2}$/.test(parts[i])) {
            return parts[i].toUpperCase();
        }
    }
    return null;
}

/**
 * Maps IANA timezone identifiers that unambiguously belong to one country.
 * Only covers zones where the prefix clearly identifies the country.
 */
function tzToCountry(tz: string): string | null {
    if (!tz) return null;
    const t = tz.toLowerCase();
    if (t.startsWith("asia/kolkata") || t.startsWith("asia/calcutta")) return "IN";
    if (t.startsWith("america/new_york") || t.startsWith("america/chicago") ||
        t.startsWith("america/denver") || t.startsWith("america/los_angeles") ||
        t.startsWith("america/phoenix") || t.startsWith("america/anchorage") ||
        t.startsWith("pacific/honolulu")) return "US";
    if (t.startsWith("america/toronto") || t.startsWith("america/vancouver") ||
        t.startsWith("america/winnipeg") || t.startsWith("america/halifax")) return "CA";
    if (t.startsWith("europe/london")) return "GB";
    if (t.startsWith("europe/berlin") || t.startsWith("europe/busingen")) return "DE";
    if (t.startsWith("europe/paris")) return "FR";
    if (t.startsWith("europe/madrid") || t.startsWith("atlantic/canary")) return "ES";
    if (t.startsWith("europe/rome")) return "IT";
    if (t.startsWith("europe/amsterdam")) return "NL";
    if (t.startsWith("europe/lisbon") || t.startsWith("atlantic/azores") ||
        t.startsWith("atlantic/madeira")) return "PT";
    if (t.startsWith("europe/stockholm")) return "SE";
    if (t.startsWith("europe/oslo")) return "NO";
    if (t.startsWith("europe/copenhagen")) return "DK";
    if (t.startsWith("europe/helsinki")) return "FI";
    if (t.startsWith("europe/zurich")) return "CH";
    if (t.startsWith("europe/vienna")) return "AT";
    if (t.startsWith("europe/brussels")) return "BE";
    if (t.startsWith("europe/warsaw")) return "PL";
    if (t.startsWith("europe/dublin")) return "IE";
    if (t.startsWith("europe/athens")) return "GR";
    if (t.startsWith("europe/bucharest")) return "RO";
    if (t.startsWith("europe/prague")) return "CZ";
    if (t.startsWith("europe/budapest")) return "HU";
    if (t.startsWith("europe/moscow") || t.startsWith("europe/kaliningrad")) return "RU";
    if (t.startsWith("asia/tokyo")) return "JP";
    if (t.startsWith("asia/seoul")) return "KR";
    if (t.startsWith("asia/singapore")) return "SG";
    if (t.startsWith("asia/kuala_lumpur") || t.startsWith("asia/kuching")) return "MY";
    if (t.startsWith("asia/manila")) return "PH";
    if (t.startsWith("asia/bangkok")) return "TH";
    if (t.startsWith("asia/jakarta") || t.startsWith("asia/makassar") ||
        t.startsWith("asia/jayapura")) return "ID";
    if (t.startsWith("asia/hong_kong")) return "HK";
    if (t.startsWith("asia/taipei")) return "TW";
    if (t.startsWith("asia/colombo")) return "LK";
    if (t.startsWith("asia/karachi")) return "PK";
    if (t.startsWith("asia/dhaka")) return "BD";
    if (t.startsWith("asia/jerusalem") || t.startsWith("asia/tel_aviv")) return "IL";
    if (t.startsWith("europe/istanbul") || t.startsWith("asia/istanbul")) return "TR";
    if (t.startsWith("asia/dubai")) return "AE";
    if (t.startsWith("asia/riyadh")) return "SA";
    if (t.startsWith("australia/sydney") || t.startsWith("australia/melbourne") ||
        t.startsWith("australia/perth") || t.startsWith("australia/darwin") ||
        t.startsWith("australia/brisbane") || t.startsWith("australia/adelaide")) return "AU";
    if (t.startsWith("pacific/auckland") || t.startsWith("pacific/chatham")) return "NZ";
    if (t.startsWith("africa/johannesburg")) return "ZA";
    if (t.startsWith("africa/lagos")) return "NG";
    if (t.startsWith("africa/nairobi")) return "KE";
    if (t.startsWith("africa/cairo")) return "EG";
    if (t.startsWith("america/sao_paulo") || t.startsWith("america/manaus") ||
        t.startsWith("america/recife") || t.startsWith("america/belem")) return "BR";
    if (t.startsWith("america/argentina")) return "AR";
    if (t.startsWith("america/santiago")) return "CL";
    if (t.startsWith("america/bogota")) return "CO";
    if (t.startsWith("america/lima")) return "PE";
    if (t.startsWith("america/mexico_city") || t.startsWith("america/cancun") ||
        t.startsWith("america/monterrey")) return "MX";
    return null;
}
