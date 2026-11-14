// #94 (owner, 14 Nov 2026): app cloud backup is OPT-IN, matching the website.
// Off by default; free for real (non-anonymous) accounts; off on sign-out.
// ⚠️ Gates are pinned as FIRST statements / exact conditions — a text test that
// only finds the word somewhere cannot see a gate that is never reached.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readFileSync } from "fs";
import { __resetCloudBackupCache, CLOUD_BACKUP_KEY, isCloudBackupOn, setCloudBackupOn } from "../lib/cloudBackup";

jest.mock("@react-native-async-storage/async-storage", () => {
    let store: Record<string, string> = {};
    return {
        __esModule: true,
        default: {
            getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
            setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
            removeItem: jest.fn(async (k: string) => { delete store[k]; }),
            __clear: () => { store = {}; },
        },
    };
});

const read = (p: string) => readFileSync(p, "utf8");
beforeEach(() => { (AsyncStorage as any).__clear(); __resetCloudBackupCache(); });

describe("the switch", () => {
    it("is OFF when never chosen — including for people updating from an older version", async () => {
        expect(await isCloudBackupOn()).toBe(false);
    });
    it("on, then off removes the key", async () => {
        await setCloudBackupOn(true);
        expect(await isCloudBackupOn()).toBe(true);
        expect(await AsyncStorage.getItem(CLOUD_BACKUP_KEY)).toBe("on");
        await setCloudBackupOn(false);
        __resetCloudBackupCache();
        expect(await isCloudBackupOn()).toBe(false);
        expect(await AsyncStorage.getItem(CLOUD_BACKUP_KEY)).toBeNull();
    });
});

describe("every cloud path asks it", () => {
    const history = read("src/state/HistoryContext.tsx");
    const client = read("src/api/historyClient.ts");
    const settings = read("src/screens/SettingsScreen.tsx");
    const auth = read("src/auth/AuthContext.tsx");

    it("HistoryContext: active only when switched on AND a real account", () => {
        expect(history).toMatch(/const cloudBackupActive = cloudBackupOn && status === "authenticated";/);
        expect(history.match(/if \(!cloudBackupActive\)/g)?.length).toBe(3);
    });
    it("⛔ nothing reads the old sync-everyone override any more", () => {
        expect(history).not.toMatch(/process\.env\.EXPO_PUBLIC_LAUNCH_CLOUD_SYNC_FREE_FOR_ALL/);
        expect(history).not.toMatch(/!cloudSyncAllowed && !LAUNCH_CLOUD_SYNC_FREE_FOR_ALL/);
    });
    it("api client: pull and push refuse FIRST while backup is off", () => {
        expect(client).toMatch(/Promise<FetchRemoteHistoryResult> \{\s*\/\/[^\n]*\n\s*if \(!\(await isCloudBackupOn\(\)\)\) \{/);
        expect(client).toMatch(/Promise<PushRemoteHistoryResult> \{\s*\/\/[^\n]*\n\s*if \(!\(await isCloudBackupOn\(\)\)\) \{/);
    });
    it("Settings: the switch needs a real account; 'Back up now' needs the switch", () => {
        expect(settings).toMatch(/value=\{cloudBackupOn && !!accessToken\}/);
        expect(settings).toMatch(/disabled=\{!accessToken\}/);
        expect(settings).toMatch(/const canCloudSync = \(cloudBackupOn && !!accessToken\) \|\| DEBUG_UI_ENABLED;/);
        expect(settings).not.toMatch(/Account backup included with Premium/);
    });
    it("signing out switches backup off", () => {
        expect(auth).toMatch(/await supabase\.auth\.signOut\(\);\s*\/\/[^\n]*\n\s*await setCloudBackupOn\(false\);/);
    });
});
