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
 * Tutor tiers.
 *
 * Students choose a speed/power trade-off by label only — Fast, Balanced,
 * Powerful, Max, Ultra. The NVIDIA model behind each label never leaves the
 * server, so the tutor can show plain words instead of model ids and the
 * deployment can re-point a tier through an environment variable without
 * touching the UI.
 *
 * Higher tiers are given a longer answer budget, because they are the ones a
 * student picks for a full worked answer rather than a quick check.
 */
export type TutorTierId = "fast" | "balanced" | "powerful" | "max" | "ultra";

export type TutorTier = {
  id: TutorTierId;
  /** The only part of a tier the browser ever sees. */
  label: string;
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
    id: "balanced",
    label: "Balanced",
    // The deployment's default text model, so the everyday tutor path stays
    // exactly what it was before tiers existed. Kept first so the picker opens
    // on the tier most students want.
    model: tierModel("NVIDIA_TUTOR_BALANCED_MODEL", NVIDIA_TEXT_MODEL),
    maxTokens: 1500,
    temperature: 0.3,
  },
  {
    id: "fast",
    label: "Fast",
    // Smallest model in the catalog: answers in a second or two, best for
    // quick definitions while revising.
    model: tierModel("NVIDIA_TUTOR_FAST_MODEL", "meta/llama-3.1-8b-instruct"),
    maxTokens: 1200,
    temperature: 0.35,
  },
  {
    id: "powerful",
    label: "Powerful",
    model: tierModel("NVIDIA_TUTOR_POWERFUL_MODEL", "meta/llama-3.3-70b-instruct"),
    maxTokens: 1800,
    temperature: 0.3,
  },
  {
    id: "max",
    label: "Max",
    // Nemotron Super reasons over long exam questions better than the plain
    // instruct models while still streaming quickly.
    model: tierModel(
      "NVIDIA_TUTOR_MAX_MODEL",
      "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    ),
    maxTokens: 2000,
    temperature: 0.25,
  },
  {
    id: "ultra",
    label: "Ultra",
    // The largest reasoning model on build.nvidia.com. Slowest, and reserved
    // for questions that need a full derivation or a marked essay plan.
    model: tierModel(
      "NVIDIA_TUTOR_ULTRA_MODEL",
      "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    ),
    maxTokens: 2400,
    temperature: 0.2,
  },
];

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
