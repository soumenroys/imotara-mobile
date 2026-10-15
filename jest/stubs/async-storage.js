// Test stub for @react-native-async-storage/async-storage.
//
// ⚠️ WHY THIS EXISTS. The real package reaches for a NATIVE module at import
// time and throws "NativeModule: AsyncStorage is null" under Jest. That was
// harmless while nothing in a test's import graph touched it — and then
// src/lib/safety/resolveCrisisCountry.ts did, and ten unrelated suites
// (marathiIsNotHindi, ttsChunking, crisisCardSpeaksTheirLanguage, …) failed to
// RUN. They were not testing storage; they just imported something that
// imported it.
//
// Mapped in package.json alongside expo-av, expo-speech and expo-file-system,
// which are here for the same reason.
//
// It is a real in-memory store rather than a no-op: a no-op would make any
// save-then-load test silently pass while storing nothing.
const store = new Map();

module.exports = {
  __esModule: true,
  default: {
    getItem: (k) => Promise.resolve(store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); return Promise.resolve(); },
    removeItem: (k) => { store.delete(k); return Promise.resolve(); },
    clear: () => { store.clear(); return Promise.resolve(); },
    getAllKeys: () => Promise.resolve([...store.keys()]),
    multiGet: (ks) => Promise.resolve(ks.map((k) => [k, store.has(k) ? store.get(k) : null])),
    multiSet: (pairs) => { pairs.forEach(([k, v]) => store.set(k, String(v))); return Promise.resolve(); },
    multiRemove: (ks) => { ks.forEach((k) => store.delete(k)); return Promise.resolve(); },
  },
};
