// Shared static require map — bundler needs literal paths at build time.
// Used by both SettingsScreen and ChatScreen.
export const AVATAR_IMAGES: Record<string, Record<number, any>> = {
  male: {
    6:  require("./avatars/male/6.png"),
    16: require("./avatars/male/16.png"),
    26: require("./avatars/male/26.png"),
    36: require("./avatars/male/36.png"),
    46: require("./avatars/male/46.png"),
    56: require("./avatars/male/56.png"),
    66: require("./avatars/male/66.png"),
    76: require("./avatars/male/76.png"),
    86: require("./avatars/male/86.png"),
    96: require("./avatars/male/96.png"),
  },
  female: {
    6:  require("./avatars/female/6.png"),
    16: require("./avatars/female/16.png"),
    26: require("./avatars/female/26.png"),
    36: require("./avatars/female/36.png"),
    46: require("./avatars/female/46.png"),
    56: require("./avatars/female/56.png"),
    66: require("./avatars/female/66.png"),
    76: require("./avatars/female/76.png"),
    86: require("./avatars/female/86.png"),
    96: require("./avatars/female/96.png"),
  },
  prefer_not: {
    26: require("./avatars/male/26.png"),
  },
};

export function resolveAvatarImage(
  gender: string | undefined,
  age: number | undefined,
): any | null {
  const g = gender ?? "male";
  const a = age ?? 26;
  return AVATAR_IMAGES[g]?.[a] ?? AVATAR_IMAGES.male?.[26] ?? null;
}
