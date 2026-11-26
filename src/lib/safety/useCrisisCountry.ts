// src/lib/safety/useCrisisCountry.ts
// The crisis-number country for screens shown BEFORE any reply (welcome / consent,
// under-13 stop screen). Renders the best answer at once, then improves it:
// stored values (a Settings choice, a country a reply told us) → our server's
// answer for this request. A Settings choice always wins (resolveCrisisCountry).
import { useEffect, useState } from "react";
import { hydrateCrisisCountry, refreshServerCountry, resolveCrisisCountry } from "./resolveCrisisCountry";

export function useCrisisCountry(): string | null {
    const [country, setCountry] = useState<string | null>(resolveCrisisCountry());
    useEffect(() => {
        let alive = true;
        void (async () => {
            await hydrateCrisisCountry();
            if (alive) setCountry(resolveCrisisCountry());
            await refreshServerCountry();
            if (alive) setCountry(resolveCrisisCountry());
        })();
        return () => {
            alive = false;
        };
    }, []);
    return country;
}
