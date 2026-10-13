import fs from "fs";
import path from "path";

const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const APP = strip(fs.readFileSync(path.join(__dirname, "..", "..", "App.tsx"), "utf8"));
const MOUNT = strip(fs.readFileSync(
    path.join(__dirname, "..", "components", "legal", "ConsentGateMount.tsx"), "utf8"));
const GATE = strip(fs.readFileSync(
    path.join(__dirname, "..", "components", "legal", "ConsentGate.tsx"), "utf8"));

/**
 * 🔴 FOUND ON A WIPED ANDROID EMULATOR, 2026-10-13.
 *
 * The gate used to be a sibling <Modal> rendered after <RootNavigator />, on the
 * assumption that later in the React tree meant on top. It does not: Android
 * stacks modals by RUNTIME PRESENTATION ORDER. SignInPrompt's own modal covered
 * the gate, so a person on a fresh install could reach sign-in — and create an
 * account — without ever passing it.
 *
 * ⛔ Every existing test asserted the gate was MOUNTED and that it RENDERED.
 * None asserted it was the ONLY thing mounted. That gap is what this file closes.
 */
describe("🔴 the consent gate actually gates", () => {
    it("WRAPS the app rather than sitting beside it", () => {
        expect(APP).toMatch(/<ConsentGateMount>/);
        expect(APP).toMatch(/<\/ConsentGateMount>/);
        // ⛔ The self-closing form is the bug: it means sibling, not wrapper.
        expect(APP).not.toMatch(/<ConsentGateMount\s*\/>/);
    });

    it("⛔ RootNavigator is INSIDE the gate, so the app cannot mount first", () => {
        const open = APP.indexOf("<ConsentGateMount>");
        const nav = APP.indexOf("<RootNavigator");
        const close = APP.indexOf("</ConsentGateMount>");
        expect(open).toBeGreaterThan(-1);
        expect(nav).toBeGreaterThan(open);
        expect(nav).toBeLessThan(close);
    });

    it("renders children ONLY once accepted", () => {
        expect(MOUNT).toMatch(/if \(accepted\) return <>\{children\}<\/>;/);
    });

    it("⛔ renders NOTHING while the decision is unknown", () => {
        // Rendering the app first would flash it for a frame before the gate.
        expect(MOUNT).toMatch(/accepted === null\) return null/);
    });

    it("⛔ a storage failure does not fail OPEN", () => {
        // If reading the acceptance throws, the gate must still show. Failing
        // open would skip consent entirely for anyone with blocked storage.
        expect(MOUNT).toMatch(/setAccepted\(\(a\) => \(a === null \? false : a\)\)/);
    });

    it("⛔ the gate is NOT a Modal — a Modal can be raced by another Modal", () => {
        // This is the actual mechanism of the bug, not a style preference.
        expect(GATE).not.toMatch(/<Modal[\s>]/);
        expect(GATE).not.toMatch(/^\s*Modal,$/m);
    });
});
