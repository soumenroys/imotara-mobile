// Tests for deriveToneForChatReply — must stay in lockstep with the server's
// deriveFormatterTone() in imotaraapp's /api/chat-reply route. If the mapping
// here changes, the server mapping must change too (and vice versa).

import { deriveToneForChatReply, detectExplicitLangRequest } from "../api/aiClient";

describe("deriveToneForChatReply", () => {
    describe("companion disabled → responseStyle mapping", () => {
        const cases: Array<[string, string]> = [
            ["comfort", "close_friend"],
            ["reflect", "calm_companion"],
            ["motivate", "coach"],
            ["advise", "mentor"],
        ];
        test.each(cases)("responseStyle=%s → %s", (style, expected) => {
            expect(
                deriveToneForChatReply({
                    companion: { enabled: false },
                    user: { responseStyle: style },
                } as any)
            ).toBe(expected);
        });

        test("unknown/missing responseStyle defaults to close_friend", () => {
            expect(deriveToneForChatReply({ companion: { enabled: false }, user: {} } as any)).toBe(
                "close_friend"
            );
            expect(deriveToneForChatReply(undefined)).toBe("close_friend");
        });

        test("responseStyle is case-insensitive", () => {
            expect(
                deriveToneForChatReply({
                    companion: { enabled: false },
                    user: { responseStyle: "MOTIVATE" },
                } as any)
            ).toBe("coach");
        });
    });

    describe("companion enabled → relationship mapping", () => {
        test("coach relationship → coach", () => {
            expect(
                deriveToneForChatReply({
                    companion: { enabled: true, relationship: "coach" },
                } as any)
            ).toBe("coach");
        });

        test.each(["mentor", "elder", "parent_like"])("%s relationship → mentor", (rel) => {
            expect(
                deriveToneForChatReply({
                    companion: { enabled: true, relationship: rel },
                } as any)
            ).toBe("mentor");
        });

        test.each(["friend", "sibling", "junior_buddy", "partner_like", "prefer_not", ""])(
            "%s relationship → close_friend",
            (rel) => {
                expect(
                    deriveToneForChatReply({
                        companion: { enabled: true, relationship: rel },
                    } as any)
                ).toBe("close_friend");
            }
        );

        test("falls back to settings.relationshipTone when toneContext has none", () => {
            expect(
                deriveToneForChatReply(
                    { companion: { enabled: true } } as any,
                    { relationshipTone: "mentor" }
                )
            ).toBe("mentor");
        });
    });
});

describe("detectExplicitLangRequest", () => {
    test("clear switch requests return the ISO code", () => {
        expect(detectExplicitLangRequest("please talk in Hindi from now on")).toBe("hi");
        expect(detectExplicitLangRequest("can you reply in bangla?")).toBe("bn");
        expect(detectExplicitLangRequest("switch to Spanish")).toBe("es");
    });

    test("bare language mentions without intent verbs do NOT match", () => {
        expect(detectExplicitLangRequest("I love Arabic poetry")).toBeNull();
        expect(detectExplicitLangRequest("my Tamil homework was hard")).toBeNull();
    });

    test("no language name → null even with intent verbs", () => {
        expect(detectExplicitLangRequest("please talk to me")).toBeNull();
        expect(detectExplicitLangRequest("")).toBeNull();
    });
});
