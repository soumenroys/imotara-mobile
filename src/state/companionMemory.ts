// src/state/companionMemory.ts
// Lightweight companion memory: detects and persists up to MAX_ITEMS
// user-shared facts. Injected into AI context on every message.
//
// Design goals:
//  - Zero new packages (AsyncStorage only)
//  - Additive to existing AI calls — inject as a userMemories string
//  - Works with both local and cloud AI modes
//  - User can view and clear from Settings

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "imotara.companion.memories.v1";
const MAX_ITEMS = 12;

export type MemoryItem = {
    id: string;
    text: string;        // human-readable fact
    source: string;      // snippet of user message that triggered it
    createdAt: number;
};

// ── Persistence ──────────────────────────────────────────────────────────────

export async function loadMemories(): Promise<MemoryItem[]> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function saveMemories(items: MemoryItem[]): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export async function clearMemories(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
}

export async function addMemory(item: Omit<MemoryItem, "id" | "createdAt">): Promise<void> {
    const existing = await loadMemories();
    // Deduplicate: skip if very similar text already stored
    const norm = item.text.toLowerCase().trim();
    if (existing.some((m) => m.text.toLowerCase().trim() === norm)) return;
    const next: MemoryItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
    };
    await saveMemories([next, ...existing]);
}

// ── Detection ─────────────────────────────────────────────────────────────────
// Detects memory-worthy facts from a user message.
// Returns an array of plain-language fact strings (empty if nothing detected).

const NAME_RE = /\bmy name is ([A-Z][a-z]{1,20})\b/i;
const WORK_RE = /\b(?:i(?:'m| am) (?:a |an )?|i work as (?:a |an )?)([a-z][a-z ]{2,30})\b/i;
const LOCATION_RE = /\b(?:i(?:'m| am) from|i live in|i(?:'m| am) based in) ([A-Z][a-zA-Z ]{2,30})\b/i;
const FEELING_ABOUT_RE = /\b(?:my|i have a?) ([\w ]{2,20}) (?:is|are|has been|have been) ([\w ,]{2,40})\b/i;
const EVENT_RE = /\b(?:i have|i've got|i have a) ([\w ]{2,25}) (?:(?:coming )?up|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week))\b/i;
const RELATIONSHIP_RE = /\bmy (wife|husband|partner|boyfriend|girlfriend|mom|dad|mother|father|sister|brother|son|daughter|friend)\b(?:'s| is| are| has| have)? ?(\w[^.!?]{0,40})?/i;

export function detectMemories(userText: string): string[] {
    const facts: string[] = [];
    const t = userText.trim();

    const nameMatch = t.match(NAME_RE);
    if (nameMatch) facts.push(`User's name is ${nameMatch[1]}`);

    const workMatch = t.match(WORK_RE);
    if (workMatch) facts.push(`User is a/an ${workMatch[1]}`);

    const locationMatch = t.match(LOCATION_RE);
    if (locationMatch) facts.push(`User is from/lives in ${locationMatch[1].trim()}`);

    const eventMatch = t.match(EVENT_RE);
    if (eventMatch) facts.push(`User has an upcoming ${eventMatch[1].trim()}`);

    const relMatch = t.match(RELATIONSHIP_RE);
    if (relMatch) {
        const detail = relMatch[2]?.trim();
        facts.push(detail
            ? `User's ${relMatch[1]} ${detail}`
            : `User has a ${relMatch[1]}`);
    }

    return facts;
}

// ── Context injection ─────────────────────────────────────────────────────────
// Returns a compact string to prepend to the AI system/user context.
// Empty string if no memories.

export function buildMemoryContext(memories: MemoryItem[]): string {
    if (memories.length === 0) return "";
    const lines = memories.slice(0, 6).map((m) => `- ${m.text}`);
    return `[What I know about this person]\n${lines.join("\n")}\n`;
}
