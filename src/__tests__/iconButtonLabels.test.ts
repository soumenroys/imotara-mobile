// UX-14/15/16. The review counted 747 TouchableOpacity against 23
// accessibilityLabel and read that as 724 unlabelled controls. It is not: a
// touchable containing a <Text> child already gets its name from that text, so
// most of those are fine and adding labels to them would only make a screen
// reader repeat itself.
//
// The controls that genuinely have no name are the ICON-ONLY ones — a back
// arrow, a close cross, the send button, and in ConnectScreen an emergency
// call button sitting inside a live session. Those announce as "button" and
// nothing else.
//
// This test finds them the same way the fix did, so a new icon-only button
// added without a label fails here rather than shipping silent.

import fs from "fs";
import path from "path";

const FILES = [
  "src/screens/connect/ConnectScreen.tsx",
  "src/screens/HistoryScreen.tsx",
  "src/screens/TrendsScreen.tsx",
  "src/screens/SettingsScreen.tsx",
  "src/screens/ChatScreen.tsx",
  "src/components/imotara/UpgradeSheet.tsx",
];

/** Every <TouchableOpacity> element in a file, as (line, source) pairs. */
function touchables(src: string): Array<{ line: number; body: string }> {
  const out: Array<{ line: number; body: string }> = [];
  const re = /<TouchableOpacity\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const start = m.index;
    const tagEnd = src.indexOf(">", start);
    if (tagEnd === -1) continue;
    if (src[tagEnd - 1] === "/") {
      out.push({ line: src.slice(0, start).split("\n").length, body: src.slice(start, tagEnd + 1) });
      continue;
    }
    let depth = 1;
    let j = tagEnd + 1;
    while (j < src.length && depth > 0) {
      const open = src.indexOf("<TouchableOpacity", j);
      const close = src.indexOf("</TouchableOpacity>", j);
      if (close === -1) break;
      if (open !== -1 && open < close) { depth++; j = open + 10; }
      else { depth--; j = close + 19; }
    }
    out.push({ line: src.slice(0, start).split("\n").length, body: src.slice(start, j) });
  }
  return out;
}

describe("icon-only buttons announce something", () => {
  for (const rel of FILES) {
    it(rel.split("/").pop()!, () => {
      const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      const unnamed = touchables(src)
        .filter((t) => {
          const hasIcon = /Ionicons|MaterialIcons/.test(t.body);
          const hasText = /<Text\b/.test(t.body);
          const hasLabel = /accessibilityLabel/.test(t.body);
          return hasIcon && !hasText && !hasLabel;
        })
        .map((t) => `${rel}:${t.line}`);
      expect(unnamed).toEqual([]);
    });
  }

  it("the sweep actually finds touchables — it is not passing on an empty scan", () => {
    // A check that cannot tell "all labelled" from "found nothing" is worse
    // than no check, and this session has already been fooled by one.
    const src = fs.readFileSync(path.join(process.cwd(), FILES[0]), "utf8");
    expect(touchables(src).length).toBeGreaterThan(50);
  });

  it("an unlabelled icon button would be caught", () => {
    const sample = `<TouchableOpacity onPress={x}><Ionicons name="close" /></TouchableOpacity>`;
    const found = touchables(sample).filter(
      (t) => /Ionicons/.test(t.body) && !/<Text\b/.test(t.body) && !/accessibilityLabel/.test(t.body),
    );
    expect(found).toHaveLength(1);
  });
});

// ── The mic button's third state ───────────────────────────────────────────

describe("the mic button announces ALL THREE of its states", () => {
    const bar = fs.readFileSync(
        path.join(__dirname, "..", "components", "chat", "ChatInputBar.tsx"), "utf8");

    it("says it is transcribing, rather than offering to start recording", () => {
        // Raised by the owner 2026-09-16. The button is already disabled and
        // already shows a spinner while transcribing, so a SIGHTED user can
        // see it is busy. A screen-reader user was told "Start voice input,
        // tap to record your message" about a control that does nothing.
        expect(bar).toMatch(/voiceState === "transcribing"\s*\?\s*"Transcribing your recording"/);
    });

    it("the hint says wait, not tap", () => {
        expect(bar).toMatch(/"Please wait — your recording is being turned into text"/);
    });

    it("exposes disabled AND busy, so assistive tech can say why", () => {
        // Without accessibilityState there is no programmatic signal at all —
        // the label alone leaves a screen reader announcing it as an ordinary
        // enabled button.
        expect(bar).toMatch(
            /accessibilityState=\{\{\s*disabled: voiceState === "transcribing",\s*busy: voiceState === "transcribing",\s*\}\}/);
    });

    it("the other two states are untouched", () => {
        // This was a labelling fix, not a behaviour change.
        expect(bar).toMatch(/"Stop recording"/);
        expect(bar).toMatch(/"Start voice input"/);
        expect(bar).toMatch(/"Tap to stop and transcribe"/);
        expect(bar).toMatch(/"Tap to record your message"/);
    });

    it("the button really is inert while transcribing", () => {
        // The label must not start claiming 'busy' while the control is in
        // fact still tappable — that would be the same lie in reverse.
        expect(bar).toMatch(/disabled=\{voiceState === "transcribing"\}/);
    });
});
