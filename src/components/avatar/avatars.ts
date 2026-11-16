// The drawn avatars a person can pick from. Strokes are in a 120 x 120 space.
// Drawn rather than uploaded: it fits how the rest of the app looks, and needs no file storage.

export const AVATARS = {
  trout: [
    { d: "M18 62C36 40 72 38 94 54C100 58 104 60 110 60C104 62 100 64 94 68C72 84 36 82 18 62Z", w: 6 },
    { d: "M18 62L5 47M18 62L5 77", w: 6 },
    { d: "M76 46C71 56 71 68 76 76", w: 4 },
    { d: "M88 56h.01", w: 8 },
  ],
  cat: [
    { d: "M30 50C30 78 44 98 60 98C76 98 90 78 90 50L84 22L68 42C62 40 58 40 52 42L36 22Z", w: 6 },
    { d: "M48 62h.01M72 62h.01", w: 9 },
    { d: "M54 74C57 79 63 79 66 74", w: 4 },
    { d: "M40 76L22 72M80 76L98 72", w: 4 },
  ],
  ghost: [
    { d: "M30 102C28 60 30 22 60 20C90 22 92 60 90 102L80 91L70 102L60 91L50 102L40 91Z", w: 6 },
    { d: "M49 54h.01M71 54h.01", w: 10 },
    { d: "M52 70C56 76 64 76 68 70", w: 4 },
  ],
  coffee: [
    { d: "M44 34C38 26 50 22 44 12M62 34C56 26 68 22 62 12", w: 4 },
    { d: "M24 46C44 44 64 44 84 46C84 76 78 100 54 100C30 100 24 76 24 46Z", w: 6 },
    { d: "M84 54C104 52 104 80 80 80", w: 5 },
  ],
  plant: [
    { d: "M40 76C54 74 66 74 80 76L74 104C64 106 56 106 46 104Z", w: 6 },
    { d: "M60 76C60 62 60 50 60 40", w: 5 },
    { d: "M60 58C44 56 36 44 36 30C50 30 60 42 60 58Z", w: 5 },
    { d: "M60 46C76 44 84 32 84 18C70 18 60 30 60 46Z", w: 5 },
  ],
  bike: [
    { d: "M46 80a17 17 0 1 1-34 0a17 17 0 1 1 34 0", w: 5 },
    { d: "M108 80a17 17 0 1 1-34 0a17 17 0 1 1 34 0", w: 5 },
    { d: "M29 80L50 46L80 46L91 80M50 46L62 80L29 80", w: 5 },
    { d: "M80 46L76 32L90 32M42 40L58 40", w: 5 },
  ],
  guitar: [
    { d: "M72 84a24 24 0 1 1-48 0a24 24 0 1 1 48 0", w: 6 },
    { d: "M62 66L98 22", w: 6 },
    { d: "M92 16L106 28", w: 6 },
    { d: "M48 84h.01", w: 12 },
  ],
  mountain: [
    { d: "M8 100L44 38L62 70L76 50L112 100Z", w: 6 },
    { d: "M35 54L44 47L53 56", w: 4 },
    { d: "M100 28a9 9 0 1 1-18 0a9 9 0 1 1 18 0", w: 5 },
  ],
  sun: [
    { d: "M82 60a22 22 0 1 1-44 0a22 22 0 1 1 44 0", w: 6 },
    { d: "M60 12L60 26M60 94L60 108M12 60L26 60M94 60L108 60M26 26L36 36M84 84L94 94M26 94L36 84M84 36L94 26", w: 5 },
  ],
  mushroom: [
    { d: "M16 62C16 34 36 16 60 16C84 16 104 34 104 62C76 66 44 66 16 62Z", w: 6 },
    { d: "M46 64C44 80 44 92 48 104C56 106 64 106 72 104C76 92 76 80 74 64", w: 6 },
    { d: "M42 40h.01M68 32h.01M86 48h.01", w: 10 },
  ],
  sock: [
    { d: "M44 14C54 12 66 12 76 14L76 62C76 70 80 76 88 80C102 86 102 106 86 106L60 106C44 106 40 92 44 78Z", w: 6 },
    { d: "M44 30L76 30", w: 5 },
  ],
  pizza: [
    { d: "M60 14L100 94C74 108 46 108 20 94Z", w: 6 },
    { d: "M26 84C48 96 72 96 94 84", w: 4 },
    { d: "M58 48h.01M72 72h.01M48 74h.01", w: 10 },
  ],
} as const;

export type AvatarName = keyof typeof AVATARS;

export const AVATAR_NAMES = Object.keys(AVATARS) as AvatarName[];

export const DEFAULT_AVATAR: AvatarName = "trout";

export function isAvatar(value: unknown): value is AvatarName {
  return typeof value === "string" && value in AVATARS;
}

/** What each avatar is called, for screen readers and the picker. */
export const AVATAR_LABELS: Record<AvatarName, string> = {
  trout: "Trout",
  cat: "Cat",
  ghost: "Ghost",
  coffee: "Coffee",
  plant: "Plant",
  bike: "Bike",
  guitar: "Guitar",
  mountain: "Mountain",
  sun: "Sun",
  mushroom: "Mushroom",
  sock: "Sock",
  pizza: "Pizza",
};
