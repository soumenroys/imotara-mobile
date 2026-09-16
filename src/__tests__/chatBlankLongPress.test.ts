/**
 * Long-pressing the empty space around the messages opens the ⋯ menu.
 *
 * Requested by the owner 2026-09-16, with an explicit boundary: "i am not
 * talking to implement this feature for long press on chat bubbles. i am
 * requesting to create this where long press feature is not implemented, that
 * is blank space around chat bubbles".
 *
 * That boundary is the whole design. A bubble already handles its own long
 * press — it opens the message action sheet — and in React Native a child that
 * claims a touch stops it reaching the parent. So a handler on the container
 * fires ONLY where nothing else wanted the gesture.
 */
import fs from "fs";
import path from "path";

const CHAT = fs.readFileSync(
    path.join(__dirname, "..", "screens", "ChatScreen.tsx"), "utf8");
const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const CODE = strip(CHAT);

describe("the blank space opens the menu", () => {
    it("a long press on the container opens the same ⋯ menu as the header", () => {
        // Same setter the header button uses — one menu, not a second copy
        // that could drift from it.
        expect(CODE).toMatch(/onLongPress=\{\(\) => \{ haptic\.tap\(\); setShowHeaderMenu\(true\); \}\}/);
        expect(CODE).toMatch(/onPress=\{\(\) => setShowHeaderMenu\(true\)\}/);
    });

    it("it wraps the message list, so it covers the margins and the space below", () => {
        const press = CODE.indexOf("onLongPress={() => { haptic.tap(); setShowHeaderMenu(true); }}");
        const list = CODE.indexOf("<FlatList", press);
        expect(press).toBeGreaterThan(-1);
        expect(list).toBeGreaterThan(press);
    });

    it("gives haptic feedback, since nothing visible moved under the finger", () => {
        expect(CODE).toMatch(/haptic\.tap\(\); setShowHeaderMenu\(true\)/);
    });
});

describe("⚠️ it must NOT touch what a long press on a BUBBLE does", () => {
    it("the bubble still owns its own long press", () => {
        // The owner was explicit that bubbles are out of scope. This is what
        // keeps the container handler from ever seeing those gestures: the
        // child claims them first.
        expect(CODE).toMatch(/onLongPress=\{message\.isPending \? undefined : \(\) => onLongPress\(message\)\}/);
        expect(CODE).toMatch(/onLongPress=\{setActionMessage\}/);
    });

    it("a pending message still refuses the long press", () => {
        // Unchanged behaviour worth pinning: you cannot act on a message that
        // has not been sent yet.
        expect(CODE).toMatch(/message\.isPending \? undefined :/);
    });
});

describe("it does not break the two gestures the list already has", () => {
    it("scrolling still owns a moving finger", () => {
        // Once a finger moves the ScrollView takes the responder and the press
        // is cancelled before the delay elapses — which is why the long press
        // needs no scroll-guard of its own. Pinned because a future
        // onStartShouldSetResponder here would silently break scrolling.
        expect(CODE).not.toMatch(/onStartShouldSetResponder/);
        expect(CODE).toMatch(/onScrollBeginDrag=\{\(\) => \{/);
    });

    it("the side-panel swipe is untouched", () => {
        // The capture-phase PanResponder claims horizontal MOVES only —
        // onStartShouldSetPanResponderCapture returns false — so a stationary
        // long press was never going to collide with it.
        expect(CODE).toMatch(/onStartShouldSetPanResponderCapture: \(\) => false/);
    });

    it("the delay is long enough not to fire on a tap-and-drag", () => {
        expect(CODE).toMatch(/delayLongPress=\{400\}/);
    });
});

describe("it stays out of the accessibility tree", () => {
    it("is not announced as a control", () => {
        // The ⋯ button in the header is the discoverable path. A focusable
        // wrapper here would sit ahead of every message for a screen-reader
        // user, which is a far worse trade than a hidden shortcut.
        const i = CODE.indexOf("onLongPress={() => { haptic.tap(); setShowHeaderMenu(true); }}");
        const block = CODE.slice(i, i + 400);
        expect(block).toMatch(/accessible=\{false\}/);
        expect(block).toMatch(/importantForAccessibility="no"/);
    });
});
