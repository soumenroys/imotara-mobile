import fs from "fs";
import path from "path";
import { EN_FELT_HEAVY_RE, EN_FELT_A_LOT_RE, isSadText } from "../lib/emotion/keywordMaps";

/**
 * 25 Oct 2026: "Long day. I feel heavy…" and "Work has been a lot… not doing
 * enough" — both real — were saved to History as NEUTRAL, so Trends showed
 * nothing after a heavy day. History also feeds the emotional-history summary
 * that reaches the reply prompt; that effect was measured live before shipping
 * (owner chose A: 3 conversations × 3 samples, replies equal or better).
 */
const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", "..", p), "utf8");

describe("History reads a heavy day", () => {
    it.each([
        "Long day. I feel heavy and I can't really say why.",
        "Work has been a lot lately and I feel like I'm not doing enough.",
        "my heart feels heavy",
        "I've been so low this week",
    ])("%s → sad", (text) => {
        expect(isSadText(text)).toBe(true);
    });

    it.each(["it's all too much right now", "so much on my plate, I'm swamped", "work has been a lot"])(
        "%s → overload",
        (text) => {
            expect(EN_FELT_A_LOT_RE.test(text)).toBe(true);
        },
    );

    // ⛔ Precision: "heavy"/"low"/"enough" count only when FELT.
    it.each([
        "heavy rain today, stuck at home",
        "I lifted something heavy at the gym",
        "the price is low",
        "I'm low on cash till Friday",
        "there's not enough time to cook",
    ])("%s stays neutral", (text) => {
        expect(EN_FELT_HEAVY_RE.test(text)).toBe(false);
        expect(EN_FELT_A_LOT_RE.test(text)).toBe(false);
    });
});

describe("the overload phrases reach the mood line and History, never the reply hint", () => {
    it("both mood-line functions check EN_FELT_A_LOT_RE", () => {
        const src = read("src/screens/ChatScreen.tsx");
        const uses = src.match(/EN_FELT_A_LOT_RE\.test\(raw\)/g) ?? [];
        expect(uses.length).toBe(2);
    });

    it("⛔ aiClient's reply hint uses neither new pattern nor isSadText", () => {
        // deriveEmotionHintFromMessage feeds the reply PROMPT. Widening it would
        // change replies without the measurement this change was shipped under.
        const src = read("src/api/aiClient.ts");
        expect(src).not.toMatch(/EN_FELT_HEAVY_RE|EN_FELT_A_LOT_RE/);
        expect(src).not.toMatch(/\bisSadText\b/);
    });
});

// The web repo, if checked out beside this one — both apps must agree.
const WEB_KEYWORDS = path.resolve(__dirname, "../../../imotaraapp/src/lib/emotion/keywordMaps.ts");
const webAvailable = fs.existsSync(WEB_KEYWORDS);

(webAvailable ? describe : describe.skip)("web and mobile hold the same patterns", () => {
    it("EN_FELT_HEAVY_RE and EN_FELT_A_LOT_RE are byte-identical", () => {
        const pick = (src: string, name: string) =>
            (src.match(new RegExp(`export const ${name} =\\s*\\n?\\s*(\\/.*\\/i);`)) ?? [])[1];
        const web = fs.readFileSync(WEB_KEYWORDS, "utf8");
        const mob = read("src/lib/emotion/keywordMaps.ts");
        for (const name of ["EN_FELT_HEAVY_RE", "EN_FELT_A_LOT_RE"]) {
            expect(pick(mob, name)).toBeTruthy();
            expect(pick(web, name)).toBe(pick(mob, name));
        }
    });
});
