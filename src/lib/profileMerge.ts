// src/lib/profileMerge.ts
// The profile (who the person is + their companion) lives on the server
// (api/profile/sync) for signed-in people. Merge rule, unchanged from the Settings
// screen where it began: a non-empty LOCAL value wins; the server fills empty fields.
// #94 (14 Nov 2026): also run at sign-in by SettingsContext, so the name comes back
// without opening Settings (sign-out clears name/age/gender/reply style locally).

export function mergeServerProfile(local: any, srv: any) {
    const l = local ?? {};
    return {
        user: {
            ...(l.user ?? {}),
            name:          l?.user?.name?.trim()          || srv?.user?.name          || undefined,
            preferredLang: l?.user?.preferredLang         || srv?.user?.preferredLang || undefined,
            ageTone:       l?.user?.ageTone               || srv?.user?.ageTone       || undefined,
            gender:        l?.user?.gender                || srv?.user?.gender        || undefined,
            responseStyle: l?.user?.responseStyle         || srv?.user?.responseStyle || undefined,
        },
        companion: {
            ...(l.companion ?? {}),
            enabled:      l?.companion?.enabled !== undefined ? l.companion.enabled : srv?.companion?.enabled,
            name:         l?.companion?.name?.trim()      || srv?.companion?.name      || undefined,
            relationship: l?.companion?.relationship      || srv?.companion?.relationship || undefined,
            ageTone:      l?.companion?.ageTone           || srv?.companion?.ageTone   || undefined,
            gender:       l?.companion?.gender            || srv?.companion?.gender    || undefined,
        },
    };
}
