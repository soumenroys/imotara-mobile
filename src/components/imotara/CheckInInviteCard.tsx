// src/components/imotara/CheckInInviteCard.tsx
// The one-time "Shall I check in with you tomorrow?" card ⇒ notifications/checkInInvite.
//
// ⛔ The OS permission prompt appears ONLY when a time is tapped — never by
//    itself. "Not now" and "Choose a time" both retire the card for good.

import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { isRtlLang } from "../../lib/lang/rtlLangs";
import { acceptInvite, formatHour, getInviteStrings, INVITE_HOURS, setInviteState } from "../../notifications/checkInInvite";

type Colors = { surface: string; textPrimary: string; textSecondary: string };

export default function CheckInInviteCard(props: {
    lang?: string;
    colors: Colors;
    onDone: (toast: { text: string; kind: "info" | "error" }) => void;
    onChooseTime: () => void;
}) {
    const s = getInviteStrings(props.lang);
    const rtl = isRtlLang(props.lang ?? "");
    const [busy, setBusy] = useState(false);

    const pick = async (hour: number) => {
        if (busy) return;
        setBusy(true);
        try {
            const r = await acceptInvite(hour);
            if (r.ok) props.onDone({ text: s.done(formatHour(hour, props.lang)), kind: "info" });
            else {
                // ⛔ Declined or unavailable: retire the card rather than ask again.
                await setInviteState("declined");
                props.onDone({ text: s.blocked, kind: "error" });
            }
        } finally {
            setBusy(false);
        }
    };

    const chip = (label: string, onPress: () => void, primary = false) => (
        <TouchableOpacity
            key={label}
            disabled={busy}
            onPress={onPress}
            accessibilityRole="button"
            style={{
                borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8,
                marginEnd: 8, backgroundColor: primary ? "#7c3aed" : "transparent",
                borderWidth: primary ? 0 : 1, borderColor: "rgba(139,92,246,0.35)", opacity: busy ? 0.5 : 1,
            }}
        >
            <Text style={{ fontSize: 12, fontWeight: "600", color: primary ? "#ffffff" : props.colors.textPrimary }}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={{ marginHorizontal: 16, marginVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(139,92,246,0.30)", backgroundColor: props.colors.surface, padding: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: props.colors.textPrimary, writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}>
                🌙 {s.q}
            </Text>
            <Text style={{ fontSize: 12, color: props.colors.textSecondary, lineHeight: 18, marginTop: 6, writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}>
                {s.sub}
            </Text>
            <View style={{ flexDirection: rtl ? "row-reverse" : "row", flexWrap: "wrap" }}>
                {chip(`🌙 ${formatHour(INVITE_HOURS.evening, props.lang)}`, () => void pick(INVITE_HOURS.evening), true)}
                {chip(`☀️ ${formatHour(INVITE_HOURS.morning, props.lang)}`, () => void pick(INVITE_HOURS.morning))}
                {chip(s.choose, () => { void setInviteState("declined"); props.onChooseTime(); })}
                {chip(s.later, () => { void setInviteState("declined"); props.onDone({ text: "", kind: "info" }); })}
            </View>
        </View>
    );
}
