// src/lib/supabase/client.ts
// Supabase client for mobile — uses expo-secure-store for session persistence
// instead of localStorage (which is unavailable in React Native).

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// SecureStore adapter: Supabase uses this to persist the session token
// so the user stays logged in across app restarts.
const ExpoSecureStoreAdapter = {
    getItem: (key: string): string | null | Promise<string | null> => {
        return SecureStore.getItemAsync(key);
    },
    setItem: (key: string, value: string): void | Promise<void> => {
        return SecureStore.setItemAsync(key, value);
    },
    removeItem: (key: string): void | Promise<void> => {
        return SecureStore.deleteItemAsync(key);
    },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // must be false in React Native
    },
});
