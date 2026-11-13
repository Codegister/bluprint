/**
 * The built-in profile pictures.
 *
 * Each option is a bundled vector symbol on a tinted gradient. No upload or
 * third-party image host is involved, and no emoji font is required, so the
 * same picture renders on every platform. Only the id is stored on the user row.
 */

export type AvatarGroup = "Animals" | "Icons" | "Games";

export type AvatarOption = {
  id: string;
  label: string;
  icon: string;
  ink: string;
  group: AvatarGroup;
  gradient: string;
};

export const AVATAR_OPTIONS = [
  { id: "cat", label: "Cat", icon: "Cat", ink: "#5c4434", group: "Animals", gradient: "linear-gradient(145deg, #f4e1d1, #dbb198)" },
  { id: "dog", label: "Dog", icon: "Dog", ink: "#55432f", group: "Animals", gradient: "linear-gradient(145deg, #ecd9c0, #caa47e)" },
  { id: "bird", label: "Bird", icon: "Bird", ink: "#3d5047", group: "Animals", gradient: "linear-gradient(145deg, #dce7ee, #9cb7c6)" },
  { id: "fish", label: "Fish", icon: "Fish", ink: "#385363", group: "Animals", gradient: "linear-gradient(145deg, #d8e8df, #93b8a4)" },
  { id: "rabbit", label: "Rabbit", icon: "Rabbit", ink: "#5b4033", group: "Animals", gradient: "linear-gradient(145deg, #f6e1d8, #dfb5a6)" },
  { id: "squirrel", label: "Squirrel", icon: "Squirrel", ink: "#5b422d", group: "Animals", gradient: "linear-gradient(145deg, #f6d8c5, #e7a47f)" },
  { id: "turtle", label: "Turtle", icon: "Turtle", ink: "#3d5348", group: "Animals", gradient: "linear-gradient(145deg, #dcebd6, #a6c89e)" },
  { id: "snail", label: "Snail", icon: "Snail", ink: "#4b4a3a", group: "Animals", gradient: "linear-gradient(145deg, #e8e0cb, #c9b78e)" },
  { id: "moon", label: "Moon", icon: "Moon", ink: "#444d63", group: "Icons", gradient: "linear-gradient(145deg, #e2e6f0, #b5bfd3)" },
  { id: "star", label: "Star", icon: "Star", ink: "#6b5424", group: "Icons", gradient: "linear-gradient(145deg, #f7e8c7, #dec382)" },
  { id: "flame", label: "Flame", icon: "Flame", ink: "#6a3f2d", group: "Icons", gradient: "linear-gradient(145deg, #f8d7c3, #e7a17e)" },
  { id: "leaf", label: "Leaf", icon: "Leaf", ink: "#3d5438", group: "Icons", gradient: "linear-gradient(145deg, #dfead8, #abc9a2)" },
  { id: "brain", label: "Brain", icon: "Brain", ink: "#5b3c4c", group: "Icons", gradient: "linear-gradient(145deg, #efdfe8, #d3b7c8)" },
  { id: "headphones", label: "Headphones", icon: "Headphones", ink: "#3f4d57", group: "Icons", gradient: "linear-gradient(145deg, #dfe5e8, #a8b9c3)" },
  { id: "bolt", label: "Bolt", icon: "Zap", ink: "#5f4b1c", group: "Icons", gradient: "linear-gradient(145deg, #f6edcf, #e1c97f)" },
  { id: "rainbow", label: "Rainbow", icon: "Rainbow", ink: "#4c4160", group: "Icons", gradient: "linear-gradient(145deg, #ebe3f5, #c9bee5)" },
  { id: "ghost", label: "Ghost", icon: "Ghost", ink: "#4a425b", group: "Games", gradient: "linear-gradient(145deg, #eae6f0, #c5bdd8)" },
  { id: "robot", label: "Robot", icon: "Bot", ink: "#3f4a4e", group: "Games", gradient: "linear-gradient(145deg, #e1e5e6, #b5c0c4)" },
  { id: "gamepad", label: "Gamepad", icon: "Gamepad2", ink: "#4c403b", group: "Games", gradient: "linear-gradient(145deg, #eadbd5, #c6a29a)" },
  { id: "joystick", label: "Joystick", icon: "Joystick", ink: "#4d3f3a", group: "Games", gradient: "linear-gradient(145deg, #e9d9d4, #c7a39b)" },
  { id: "knight", label: "Knight", icon: "Sword", ink: "#4f4433", group: "Games", gradient: "linear-gradient(145deg, #f7e5c7, #ddb36e)" },
  { id: "mage", label: "Mage", icon: "Wand2", ink: "#4c3a62", group: "Games", gradient: "linear-gradient(145deg, #e9e0f2, #c1a9d8)" },
  { id: "hero", label: "Hero", icon: "Crown", ink: "#5e4721", group: "Games", gradient: "linear-gradient(145deg, #f7e5c7, #ddb36e)" },
  { id: "rocket", label: "Rocket", icon: "Rocket", ink: "#4e3c33", group: "Games", gradient: "linear-gradient(145deg, #f2d9d0, #d6a99c)" },
] as const satisfies readonly AvatarOption[];

export type AvatarId = (typeof AVATAR_OPTIONS)[number]["id"];

const AVATAR_GROUPS_ORDER: AvatarGroup[] = ["Animals", "Icons", "Games"];

export const AVATAR_GROUPS = AVATAR_GROUPS_ORDER.map((label) => ({
  label,
  options: AVATAR_OPTIONS.filter((option) => option.group === label),
}));

const AVATAR_IDS = new Set<string>(AVATAR_OPTIONS.map((option) => option.id));

export function isAvatarId(value: string | null | undefined): value is AvatarId {
  return Boolean(value && AVATAR_IDS.has(value));
}

/**
 * Turn a user id or email into a stable, evenly spread default. The same user
 * keeps the same picture on every device even before they choose one.
 */
export function defaultAvatarId(seed?: string | null): AvatarId {
  const value = seed?.trim() || "bluprint";
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return AVATAR_OPTIONS[Math.abs(hash) % AVATAR_OPTIONS.length].id;
}

export function resolveAvatar(
  avatarId?: string | null,
  seed?: string | null,
): AvatarOption {
  const chosen = AVATAR_OPTIONS.find((option) => option.id === avatarId);
  if (chosen) return chosen;
  return AVATAR_OPTIONS.find((option) => option.id === defaultAvatarId(seed)) ?? AVATAR_OPTIONS[0];
}

export function randomAvatarId(exclude?: string | null): AvatarId {
  const choices = exclude
    ? AVATAR_OPTIONS.filter((option) => option.id !== exclude)
    : AVATAR_OPTIONS;
  return choices[Math.floor(Math.random() * choices.length)]?.id ?? AVATAR_OPTIONS[0].id;
}
