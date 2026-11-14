// #143 (owner, 14 Nov 2026): UK crisis card carries Childline (under-19s),
// mirroring the web. ⛔ No opening hours claimed — childline.org.uk states none.
import { UK_CRISIS_RESOURCES } from "../lib/safety/crisisResources";

describe("UK crisis card — Childline (#143)", () => {
    it("lists Childline 0800 1111 for under-19s, after Samaritans", () => {
        const contacts = UK_CRISIS_RESOURCES.primary.map((r) => r.contact);
        expect(contacts[0]).toBe("116 123");
        const c = UK_CRISIS_RESOURCES.primary.find((r) => r.contact === "0800 1111");
        expect(c?.label).toMatch(/Childline/);
        expect(c?.note).toMatch(/under 19/);
        expect(c?.note ?? "").not.toMatch(/24\/7|24 hours|any time|midnight/i);
        expect(UK_CRISIS_RESOURCES.emergency?.contact).toBe("999");
    });
});
