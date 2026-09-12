// Intern item 6 (Yash): "too many icons per message; move the rare ones into
// a 3-dot menu; what is the cloud icon?"
//
// The cloud badge was dealt with in 674fcd7 (hidden by default). This is the
// other half.
//
// What was actually there: every bot message carried FOUR controls — react,
// copy, read-aloud, bookmark — plus an optional sync badge. Meanwhile a full
// "Message actions" sheet already existed with copy, bookmark, timestamp,
// back-up, export and delete, reachable only by LONG-PRESS, which nothing on
// screen advertises. So the actions were not missing, they were invisible,
// and the row was crowded with the ones that are not.
//
// ── The bug found while scoping it ────────────────────────────────────────
//
// The two surfaces wrote DIFFERENT VALUE TYPES into the same reactions Map
// and the same storage key:
//
//     inline picker  ->  addReaction(id, "heart")   // an Ionicons name
//     action sheet   ->  addReaction(id, "\u{1F44D}")       // an emoji character
//
// The inline row resolves the active reaction with
// REACTION_OPTIONS.find(r => r.icon === activeReaction), which can never match
// an emoji. The companion badge that renders a raw value is isUser-only, and
// the inline row is bot-only — so reacting to a bot message from the sheet
// produced NO visible feedback anywhere. Putting a visible 3-dot button in
// front of that sheet would have made a broken path easier to reach, so the
// two vocabularies are unified here rather than left to drift further.

import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "screens", "ChatScreen.tsx"),
    "utf8"
);

/** Code with comments stripped — assertions must not match prose. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** The inline action row lives inside the `!isUser && !message.isPending` block. */
function inlineRow(): string {
    const i = CODE.indexOf("{!isUser && !message.isPending && (() => {");
    expect(i).toBeGreaterThan(-1);
    return CODE.slice(i, CODE.indexOf("Companion reaction badge", i) > -1
        ? CODE.indexOf("{isUser && reactions.get(message.id)", i)
        : i + 6000);
}

function actionSheet(): string {
    const i = CODE.indexOf("const renderActionSheet = () => {");
    expect(i).toBeGreaterThan(-1);
    return CODE.slice(i, CODE.indexOf("\n  };", CODE.indexOf("closeActionSheet", i + 200)));
}

describe("one reaction vocabulary, not two", () => {
    it("the option list lives at module scope, where both surfaces can see it", () => {
        // It used to be declared INSIDE MessageBubble's render, which is why
        // the sheet could not use it and grew its own hardcoded emoji row.
        // No leading whitespace = module scope.
        expect(CODE).toMatch(/^function reactionOptionsFor/m);
        expect(inlineRow()).not.toMatch(/const ALL_REACTION_OPTIONS/);
    });

    it("the sheet no longer hardcodes its own emoji row", () => {
        // The exact literal that caused the split.
        expect(actionSheet()).not.toMatch(/\["\u{1F44D}"/u);
        expect(actionSheet()).not.toMatch(/\u{1F64F}/u);
    });

    it("both surfaces resolve their options from the same helper", () => {
        expect(CODE).toMatch(/function reactionOptionsFor\(/);
        const uses = CODE.match(/reactionOptionsFor\(/g) ?? [];
        expect(uses.length).toBeGreaterThanOrEqual(3); // 1 definition + 2 call sites
    });

    it("the sheet honours the reaction-set setting, as the inline row always did", () => {
        // minimal / default / extended. Hardcoding six emoji ignored it.
        expect(actionSheet()).toMatch(/reactionOptionsFor\((chat)?[Rr]eactionsSet,/);
    });

    it("what the sheet WRITES is what the row READS", () => {
        // The whole bug in one assertion. The sheet is now the only place a
        // reaction is set, and it stores an Ionicons name; the row resolves
        // the active reaction by matching on exactly that. Storing an emoji
        // here again would make reactions invisible, silently.
        expect(actionSheet()).toMatch(/addReaction\(actionMessage\.id, opt\.icon\)/);
        expect(inlineRow()).toMatch(/\.find\(\(r\) => r\.icon === activeReaction\)/);
    });
});

describe("the row carries controls for common things only", () => {
    const row = () => inlineRow();

    it("copy and read-aloud stay inline — they are the everyday two", () => {
        expect(row()).toMatch(/onCopy\(message\.text\)/);
        expect(row()).toMatch(/onSpeak\(message\.id, message\.text\)/);
    });

    it("a 3-dot button opens the same sheet long-press already opened", () => {
        // Same destination on purpose: nothing new to learn, and long-press
        // keeps working for anyone who knows it.
        expect(row()).toMatch(/onOpenActions\(message\)/);
        expect(row()).toMatch(/ellipsis-horizontal/);
    });

    it("the expanding inline reaction picker is gone", () => {
        // It was the second way to react, and the source of the split above.
        expect(CODE).not.toMatch(/reactionPickerOpen/);
    });

    it("bookmark is no longer a permanent control", () => {
        // Yash's "rare ones". It is in the sheet, one tap further away.
        expect(row()).not.toMatch(/onBookmark\(message\.id\)/);
    });
});

describe("but state still shows, or the move would be a loss", () => {
    it("a bookmarked message still shows its star", () => {
        // Moving the CONTROL into the menu must not hide the STATE.
        expect(inlineRow()).toMatch(/isBookmarked && \(/);
    });

    it("a reacted message still shows its reaction", () => {
        expect(inlineRow()).toMatch(/activeOption && \(/);
    });

    it("both indicators open the sheet, so they are not dead ends", () => {
        const row = inlineRow();
        const star = row.slice(row.indexOf("isBookmarked && ("));
        expect(star.slice(0, 600)).toMatch(/onOpenActions\(message\)/);
    });
});

describe("the sheet keeps everything it had", () => {
    it.each([
        "Copy text",
        "Show timestamp",
        "Export chat",
        "Cancel",
    ])("still offers: %s", (label) => {
        expect(actionSheet()).toContain(label);
    });

    it("still offers bookmark and delete", () => {
        expect(actionSheet()).toMatch(/handleToggleBookmark\(actionMessage\.id\)/);
        expect(actionSheet()).toMatch(/handleDeleteMessage\(actionMessage\.id\)/);
    });

    it("long-press still opens it", () => {
        expect(CODE).toMatch(/onLongPress=\{message\.isPending \? undefined : \(\) => onLongPress\(message\)\}/);
    });
});
