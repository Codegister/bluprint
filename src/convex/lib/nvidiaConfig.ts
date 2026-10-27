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

/**
 * Models NVIDIA has already retired.
 *
 * A deployment can still have an old id in `NVIDIA_TEXT_MODEL` (or in a
 * tier-specific override) after NVIDIA withdraws it. The transport handles a
 * 404/410 by trying the next model, but that costs a failed request on every
 * prompt and leaves the first paint of the tutor exposed to a provider error.
 * Skipping these ids when the candidates are built means a stale environment
 * variable cannot reintroduce a dead model at all.
 *
 * Only ids confirmed dead are listed. A model that is merely slow belongs in
 * the fallback list, not here.
 */
export const RETIRED_MODEL_IDS: ReadonlySet<string> = new Set([
  "meta/llama-3.1-8b-instruct",
  "meta/llama-3.3-70b-instruct",
]);

/** Whether NVIDIA has withdrawn this model. */
export function isRetiredModel(model: string): boolean {
  return RETIRED_MODEL_IDS.has(model.trim().toLowerCase());
}

/**
 * Every model the text prompts may fall back to, best first.
 *
 * NVIDIA retires models without warning, so a single hard-coded id is a
 * single point of failure: when one reaches end of life the whole product
 * stops. Each installed model must be one that answered a real completion the
 * last time it was checked, and the transport walks this list when the
 * upstream replies 404 or 410.
 */
export const NVIDIA_TEXT_FALLBACK_MODELS = [
  "nvidia/nemotron-3.5-bolt-e4b",
  "nvidia/nemotron-3-ultra-550b-a55b",
];

export const NVIDIA_VISION_FALLBACK_MODELS = [
  "nvidia/nemotron-3.5-super-vl-120b-a12b",
  // A live multimodal model, used only when the primary vision model stops
  // answering. The previous fallback (meta/llama-3.2-90b-vision-instruct)
  // timed out on every probe, so it was not a real fallback.
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
];

/**
 * Picks a model, replacing a retired id with the first live alternative.
 * Used for every default and every environment override, so a stale value
 * cannot reach the transport. A retired list with nothing live left keeps the
 * preferred id rather than returning an empty model name.
 */
export function liveModel(preferred: string, fallbacks: string[]): string {
  const value = preferred.trim();
  if (value && !isRetiredModel(value)) return value;
  return fallbacks.find((model) => !isRetiredModel(model)) ?? value;
}

/**
 * The current default text model.
 *
 * Verified on 2026-10-27 against NVIDIA's live model catalogue and with a real
 * completion from this deployment. Override with NVIDIA_TEXT_MODEL; the
 * fallbacks take over if NVIDIA retires it later. `meta/llama-3.1-8b-instruct`
 * and `meta/llama-3.3-70b-instruct` reached end of life on 2026-08-26.
 */
export const NVIDIA_TEXT_MODEL = liveModel(
  process.env.NVIDIA_TEXT_MODEL?.trim() || "nvidia/nemotron-3.5-lightning-30b-a3b",
  NVIDIA_TEXT_FALLBACK_MODELS,
);

export const NVIDIA_VISION_MODEL = liveModel(
  process.env.NVIDIA_VISION_MODEL?.trim() || "nvidia/nemotron-3.5-super-vl-120b-a12b",
  NVIDIA_VISION_FALLBACK_MODELS,
);

/** Reads a comma- or newline-separated model list from the environment. */
function modelList(envName: string, fallback: string[]): string[] {
  const raw = process.env[envName];
  const values = (raw ? raw.split(/[\n,]+/) : fallback)
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && !isRetiredModel(value));
  return [...new Set(values)];
}

/**
 * The models to try for a text prompt: the configured one first, then the
 * checked fallbacks. The env var lets a deployment pin its own order without a
 * code change.
 */
export function textModelCandidates(): string[] {
  return [
    ...new Set([
      NVIDIA_TEXT_MODEL,
      ...modelList("NVIDIA_TEXT_FALLBACK_MODELS", NVIDIA_TEXT_FALLBACK_MODELS),
    ]),
  ];
}

/** The models to try for a prompt that includes an image. */
export function visionModelCandidates(): string[] {
  return [
    ...new Set([
      NVIDIA_VISION_MODEL,
      ...modelList("NVIDIA_VISION_FALLBACK_MODELS", NVIDIA_VISION_FALLBACK_MODELS),
    ]),
  ];
}

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

/**
 * Reads a per-tier model override, falling back to the checked default.
 *
 * The override goes through the same retired-model guard as the default: a
 * deployment that pinned a tutor level years ago cannot keep that level broken
 * after NVIDIA withdraws the model.
 */
function tierModel(envName: string, fallback: string): string {
  return liveModel(process.env[envName]?.trim() || fallback, NVIDIA_TEXT_FALLBACK_MODELS);
}

export const TUTOR_TIERS: TutorTier[] = [
  {
    id: "fast",
    label: "Fast",
    tagline: "Quick short answers",
    icon: "rabbit",
    // A small, fast, currently-live model. The retired
    // meta/llama-3.1-8b-instruct used to sit here and answered 410.
    model: tierModel("NVIDIA_TUTOR_FAST_MODEL", "nvidia/nemotron-3.5-bolt-e4b"),
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
    // The largest live model, for the deepest answers. The retired
    // meta/llama-3.3-70b-instruct used to sit here and answered 410.
    model: tierModel(
      "NVIDIA_TUTOR_DEEP_MODEL",
      tierModel("NVIDIA_TUTOR_POWERFUL_MODEL", "nvidia/nemotron-3-ultra-550b-a55b"),
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
