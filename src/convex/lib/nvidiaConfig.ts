/**
 * NVIDIA API configuration.
 *
 * Keys are NEVER defined in source. They are read from the `NVIDIA_API_KEY`
 * environment variable, which may hold one key or several keys separated by
 * commas, semicolons, or newlines. The AI action rotates across them so a
 * single key's rate limit does not stop a study set from compiling.
 *
 * Model IDs can be overridden with NVIDIA_TEXT_MODEL / NVIDIA_VISION_MODEL if
 * NVIDIA retires the defaults, and each tutor tier has its own override
 * (NVIDIA_TUTOR_FAST_MODEL, NVIDIA_TUTOR_BALANCED_MODEL, and so on). See the
 * README.
 */
export const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

// These are the defaults checked against NVIDIA's live model catalog. NVIDIA
// retires models periodically — override with the env vars below (or edit
// here) if one reaches end of life, as shown by a 410 response.
export const NVIDIA_TEXT_MODEL =
  process.env.NVIDIA_TEXT_MODEL?.trim() ||
  "nvidia/nemotron-3.5-lightning-30b-a3b";

export const NVIDIA_VISION_MODEL =
  process.env.NVIDIA_VISION_MODEL?.trim() ||
  "meta/llama-3.2-90b-vision-instruct";

/** Name used everywhere the key pool is referenced. */
export const NVIDIA_KEY_NAME = "NVIDIA_API_KEY";

/**
 * Tutor levels.
 *
 * There are exactly three, in order: Fast, Balanced, Deep. They used to be
 * five tiers crossed with a separate effort dial, which meant fifteen ways to
 * ask the same question and no clear default. Speed against depth is one
 * decision, so it is one control.
 *
 * The NVIDIA model behind each label never leaves the server, so the tutor
 * shows plain words and the deployment can re-point a level through an
 * environment variable without touching the UI.
 */
export type TutorTierId = "fast" | "balanced" | "deep";

/** Icons are named here and drawn by the browser, so no URLs are involved. */
export type TutorTierIcon = "rabbit" | "scale" | "flame";

export type TutorTier = {
  id: TutorTierId;
  /** The only part of a tier the browser ever sees. */
  label: string;
  /** One line under the label in the picker, so speed vs strength is obvious. */
  tagline: string;
  icon: TutorTierIcon;
  model: string;
  maxTokens: number;
  temperature: number;
};

/** Reads a per-tier model override, falling back to the checked default. */
function tierModel(envName: string, fallback: string): string {
  return process.env[envName]?.trim() || fallback;
}

export const TUTOR_TIERS: TutorTier[] = [
  {
    id: "fast",
    label: "Fast",
    tagline: "Quick short answers",
    icon: "rabbit",
    model: tierModel("NVIDIA_TUTOR_FAST_MODEL", "meta/llama-3.1-8b-instruct"),
    maxTokens: 1100,
    temperature: 0.35,
  },
  {
    id: "balanced",
    label: "Balanced",
    // The deployment's default text model: the everyday answer, and the one the
    // picker opens on.
    tagline: "Everyday default · steady detail",
    icon: "scale",
    model: tierModel("NVIDIA_TUTOR_BALANCED_MODEL", NVIDIA_TEXT_MODEL),
    maxTokens: 1600,
    temperature: 0.3,
  },
  {
    id: "deep",
    label: "Deep",
    tagline: "Longest answers · worked reasoning",
    icon: "flame",
    model: tierModel(
      "NVIDIA_TUTOR_DEEP_MODEL",
      tierModel("NVIDIA_TUTOR_POWERFUL_MODEL", "meta/llama-3.3-70b-instruct"),
    ),
    maxTokens: 2600,
    temperature: 0.25,
  },
];

/** What the picker shows: a label, one line of explanation, and an icon name. */
export const TUTOR_TIER_DETAILS = TUTOR_TIERS.map(({ label, tagline, icon }) => ({
  label,
  tagline,
  icon,
}));

export const DEFAULT_TUTOR_TIER: TutorTierId = "balanced";

/** Picker order: the default tier first, then ascending power. */
export const TUTOR_TIER_LABELS = TUTOR_TIERS.map((tier) => tier.label);

export const DEFAULT_TUTOR_TIER_LABEL =
  TUTOR_TIERS.find((tier) => tier.id === DEFAULT_TUTOR_TIER)?.label ?? "Balanced";

/**
 * Turns a tier label or id from the client into a real tier. Anything unknown
 * (an old client, a stale tab) falls back to the default rather than failing a
 * question the student has already typed.
 */
export function readTutorTier(value?: string | null): TutorTier {
  const key = (value ?? "").trim().toLowerCase();
  const fallback = TUTOR_TIERS.find((tier) => tier.id === DEFAULT_TUTOR_TIER)!;
  if (!key) return fallback;
  return (
    TUTOR_TIERS.find(
      (tier) => tier.id === key || tier.label.toLowerCase() === key,
    ) ?? fallback
  );
}

/**
 * Splits NVIDIA_API_KEY into a de-duplicated key pool. Accepts comma-,
 * semicolon-, whitespace-, or newline-separated values so a few keys can be
 * supplied without inventing additional environment variable names.
 */
export function readNvidiaKeys(): string[] {
  const raw = process.env.NVIDIA_API_KEY ?? "";
  const keys = raw
    .split(/[\s,;]+/)
    .map((key) => key.trim())
    .filter(Boolean);
  return [...new Set(keys)];
}

/** Keep prompts bounded so a giant PDF paste does not blow the context window. */
export const MAX_NOTES_CHARS = 12_000;
