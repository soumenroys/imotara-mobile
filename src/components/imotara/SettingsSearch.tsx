// src/components/imotara/SettingsSearch.tsx
// AI-powered settings search — local match first, AI fallback for sentences.

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../theme/ThemeContext";
import {
  searchSettingsLocally,
  AI_FALLBACK_THRESHOLD,
  SETTINGS_CATALOG,
  type SearchResult,
} from "../../data/settingsCatalog";
import { buildApiUrl } from "../../config/api";
import { fetchWithTimeout } from "../../lib/fetchWithTimeout";

type Props = {
  onResultSelect: (sectionKey: string, settingId: string) => void;
};

export default function SettingsSearch({ onResultSelect }: Props) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setAiUsed(false); return; }

    // Local search first — instant
    const local = searchSettingsLocally(q, 5);
    const topScore = local[0]?.score ?? 0;
    const looksLikeSentence = q.trim().split(/\s+/).length >= 3;

    if (local.length > 0 && topScore >= AI_FALLBACK_THRESHOLD && !looksLikeSentence) {
      setResults(local);
      setAiUsed(false);
      return;
    }

    // AI fallback
    setResults(local); // show partial local results while AI loads
    setLoading(true);
    setAiUsed(true);
    try {
      const res = await fetchWithTimeout(
        buildApiUrl("/api/settings-search"),
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) },
        6_000,
      );
      if (res.ok) {
        const data = await res.json();
        const ids: string[] = Array.isArray(data.ids) ? data.ids : [];
        if (ids.length > 0) {
          const aiResults = ids
            .map((id) => SETTINGS_CATALOG.find((s) => s.id === id))
            .filter(Boolean)
            .map((s) => ({ ...s!, score: 99 }));
          setResults(aiResults.slice(0, 5));
        }
      }
    } catch {
      // Keep local results on AI failure
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 350);
  }, [runSearch]);

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setAiUsed(false);
    setLoading(false);
  }, []);

  const handleSelect = useCallback((item: SearchResult) => {
    Keyboard.dismiss();
    onResultSelect(item.sectionKey, item.id);
    handleClear();
  }, [onResultSelect, handleClear]);

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
      {/* Search bar */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        borderWidth: 1, borderColor: query ? colors.primary : colors.border,
        borderRadius: 14, backgroundColor: colors.surfaceSoft,
        paddingHorizontal: 12, paddingVertical: 8, gap: 8,
      }}>
        <Ionicons name="search-outline" size={16} color={query ? colors.primary : colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={handleChange}
          placeholder="Search settings or describe what you need..."
          placeholderTextColor={colors.textSecondary}
          style={{ flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 0 }}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
        {!loading && aiUsed && query.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Text style={{ fontSize: 9, color: colors.primary, fontWeight: "700", letterSpacing: 0.3 }}>AI</Text>
            <Ionicons name="sparkles" size={10} color={colors.primary} />
          </View>
        )}
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results */}
      {results.length > 0 && (
        <View style={{
          marginTop: 6, borderRadius: 12,
          borderWidth: 1, borderColor: colors.border,
          backgroundColor: colors.background,
          overflow: "hidden",
        }}>
          {results.map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleSelect(item)}
              style={{
                flexDirection: "row", alignItems: "center",
                paddingHorizontal: 14, paddingVertical: 12, gap: 10,
                borderBottomWidth: idx < results.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <Ionicons name="settings-outline" size={15} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>
                  {item.title}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                  {item.section}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* No results */}
      {query.length > 1 && results.length === 0 && !loading && (
        <View style={{ paddingVertical: 10, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            No settings found for "{query}"
          </Text>
        </View>
      )}
    </View>
  );
}
