// Shared static require map — bundler needs literal paths at build time.
// Used by both SettingsScreen and ChatScreen.
export const AVATAR_IMAGES: Record<string, Record<number, any>> = {
  male: {
    6:  require("./avatars/male/6.jpg"),
    16: require("./avatars/male/16.jpg"),
    26: require("./avatars/male/26.jpg"),
    36: require("./avatars/male/36.jpg"),
    46: require("./avatars/male/46.jpg"),
    56: require("./avatars/male/56.jpg"),
    66: require("./avatars/male/66.jpg"),
    76: require("./avatars/male/76.jpg"),
    86: require("./avatars/male/86.jpg"),
    96: require("./avatars/male/96.jpg"),
  },
  female: {
    6:  require("./avatars/female/6.jpg"),
    16: require("./avatars/female/16.jpg"),
    26: require("./avatars/female/26.jpg"),
    36: require("./avatars/female/36.jpg"),
    46: require("./avatars/female/46.jpg"),
    56: require("./avatars/female/56.jpg"),
    66: require("./avatars/female/66.jpg"),
    76: require("./avatars/female/76.jpg"),
    86: require("./avatars/female/86.jpg"),
    96: require("./avatars/female/96.jpg"),
  },
  prefer_not: {
    26: require("./avatars/male/26.jpg"),
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
