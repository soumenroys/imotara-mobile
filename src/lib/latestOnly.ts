// src/lib/latestOnly.ts
// "Latest request wins" — for search-as-you-type.
//
// 🔴 Found in the Dec release check (26 Nov 2026): Settings search asked the server about a
// HALF-typed word ("show c…"), the person kept typing, the full word was answered locally at
// once — and THEN the slow server answer for the old word arrived and replaced the right list.
// "Show connect" showed five unrelated settings. Every async answer must check it is still
// the latest before it touches the screen.

export type LatestOnly = {
  /** Call at the start of each search; keep the token it returns. */
  begin: () => number;
  /** True only while no newer search has begun since `token`. */
  isCurrent: (token: number) => boolean;
  /** Makes every earlier token stale (e.g. when the box is cleared). */
  cancel: () => void;
};

export function createLatestOnly(): LatestOnly {
  let latest = 0;
  return {
    begin: () => ++latest,
    isCurrent: (token) => token === latest,
    cancel: () => { latest++; },
  };
}
