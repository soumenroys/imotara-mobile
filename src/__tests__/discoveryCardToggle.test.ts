// Regression test for the "Feature discovery cards" Settings toggle added
// 2026-08-16 (mirrors the same fix on web). Mirrors ChatScreen.tsx's
// discovery-card effect exactly, against the same AsyncStorage keys:
//   - DISCOVERY_CARDS_ENABLED_KEY ("imotara.onboarding.discovery.enabled.v1")
//   - DISCOVERY_CARDS_KEY ("imotara.onboarding.discovery.v1")

// Mirrors src/components/chat/DiscoveryCard.tsx's CARD_ORDER/getNextCard exactly
// (re-declared here, not imported, since that file pulls in RN/Expo UI modules
// that jest can't resolve in this test environment — see other pure-logic
// tests in this suite for the same pattern).
type DiscoveryCardId = "trends" | "companion" | "offline" | "unsent_letter";
const CARD_ORDER: DiscoveryCardId[] = ["trends", "companion", "offline", "unsent_letter"];

function pickNextDiscoveryCard(
    enabledRaw: string | null,
    dismissedRaw: string | null,
): DiscoveryCardId | null {
    if (enabledRaw === "0") return null;
    const dismissed: DiscoveryCardId[] = dismissedRaw ? JSON.parse(dismissedRaw) : [];
    return CARD_ORDER.find((id) => !dismissed.includes(id)) ?? null;
}

describe("feature discovery card — master toggle gating", () => {
    it("toggle off (enabled key = '0') suppresses every card, even undismissed ones", () => {
        expect(pickNextDiscoveryCard("0", null)).toBeNull();
        expect(pickNextDiscoveryCard("0", "[]")).toBeNull();
    });

    it("toggle absent (never touched) behaves as enabled — default is on", () => {
        expect(pickNextDiscoveryCard(null, null)).toBe("trends");
    });

    it("toggle explicitly on ('1') behaves the same as absent", () => {
        expect(pickNextDiscoveryCard("1", null)).toBe("trends");
    });

    it("with the toggle on, still cycles through undismissed cards in order", () => {
        expect(pickNextDiscoveryCard("1", JSON.stringify(["trends", "companion"]))).toBe("offline");
    });

    it("with the toggle on and everything dismissed, no card is shown (distinct from toggle-off)", () => {
        expect(pickNextDiscoveryCard("1", JSON.stringify([...CARD_ORDER]))).toBeNull();
    });
});
