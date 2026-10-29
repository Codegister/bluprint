/**
 * Infisical secrets for the Convex Node actions.
 *
 * The AI actions read their keys from `process.env` (`NVIDIA_API_KEY`,
 * `OPENROUTER_API_KEY`, the web-search keys, and the model overrides). Instead
 * of keeping those values in a committed `.env` or hand-setting each one on the
 * deployment, a machine identity loads the project's secrets from Infisical
 * once at startup and copies them into `process.env`, so every existing reader
 * resolves them unchanged.
 *
 * Required on the Convex deployment:
 *
 *   INFISICAL_CLIENT_ID      universal-auth machine identity client id
 *   INFISICAL_CLIENT_SECRET  its client secret, never written to source
 *   INFISICAL_PROJECT_ID     the project that holds the secrets
 *
 * Optional:
 *
 *   INFISICAL_ENVIRONMENT    defaults to "prod"
 *   INFISICAL_SECRET_PATH    defaults to "/"
 *   INFISICAL_SITE_URL       defaults to https://app.infisical.com (self-hosted)
 *
 * A variable that is already set on the deployment wins, so a key can still be
 * overridden without editing Infisical, and a deployment with no identity
 * configured keeps working exactly as before. Secret values are never printed,
 * returned to the browser, or included in an error message.
 *
 * The Node SDK needs a Node runtime, so only import this module from a
 * `"use node"` Convex file.
 */
import { InfisicalSDK } from "@infisical/sdk";

export const DEFAULT_INFISICAL_SITE_URL = "https://app.infisical.com";
export const DEFAULT_INFISICAL_ENVIRONMENT = "prod";
export const DEFAULT_INFISICAL_SECRET_PATH = "/";

export type InfisicalSettings = {
  siteUrl: string;
  environment: string;
  secretPath: string;
  clientId: string;
  clientSecret: string;
  projectId: string;
};

/** What the startup load did, safe to log or return: never the values. */
export type InfisicalStatus = {
  configured: boolean;
  loaded: boolean;
  /** How many variables the load added to `process.env`. */
  secretCount: number;
  error: string | null;
};

/**
 * Reads the machine identity settings. Returns null when the deployment has no
 * identity, which is the normal case for a deployment that still supplies its
 * keys through the environment.
 */
export function readInfisicalSettings(
  env: NodeJS.ProcessEnv = process.env,
): InfisicalSettings | null {
  const clientId = env.INFISICAL_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.INFISICAL_CLIENT_SECRET?.trim() ?? "";
  const projectId = env.INFISICAL_PROJECT_ID?.trim() ?? "";
  if (!clientId || !clientSecret || !projectId) return null;

  return {
    clientId,
    clientSecret,
    projectId,
    siteUrl: env.INFISICAL_SITE_URL?.trim() || DEFAULT_INFISICAL_SITE_URL,
    environment: env.INFISICAL_ENVIRONMENT?.trim() || DEFAULT_INFISICAL_ENVIRONMENT,
    secretPath: env.INFISICAL_SECRET_PATH?.trim() || DEFAULT_INFISICAL_SECRET_PATH,
  };
}

/** Whether the deployment has enough settings to talk to Infisical. */
export function isInfisicalConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return readInfisicalSettings(env) !== null;
}

/** Creates the SDK client for the configured site. */
export function createInfisicalClient(settings: Pick<InfisicalSettings, "siteUrl">): InfisicalSDK {
  return new InfisicalSDK({ siteUrl: settings.siteUrl });
}

/**
 * Authenticates with the machine identity and fetches every secret in the
 * configured environment and path. Imported secrets are expanded, so a value
 * that references another secret arrives resolved.
 */
export async function fetchInfisicalSecrets(
  settings: InfisicalSettings,
): Promise<Record<string, string>> {
  const client = createInfisicalClient(settings);
  await client.auth().universalAuth.login({
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
  });

  const { secrets } = await client.secrets().listSecrets({
    projectId: settings.projectId,
    environment: settings.environment,
    secretPath: settings.secretPath,
    expandSecretReferences: true,
    viewSecretValue: true,
  });

  const values: Record<string, string> = {};
  for (const secret of secrets) {
    const key = secret.secretKey?.trim();
    if (key && typeof secret.secretValue === "string") values[key] = secret.secretValue;
  }
  return values;
}

/**
 * Copies fetched secrets into the environment, skipping any variable the
 * deployment already set. An empty variable (a `.env` placeholder) is filled.
 * Returns how many variables were added.
 */
export function applyInfisicalSecrets(
  values: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env,
): number {
  let applied = 0;
  for (const [key, value] of Object.entries(values)) {
    if (env[key]) continue;
    env[key] = value;
    applied += 1;
  }
  return applied;
}

/** Describes a failure without ever echoing the client secret. */
function describeError(error: unknown, settings: InfisicalSettings): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(settings.clientSecret).join("[redacted]");
}

async function loadOnce(): Promise<InfisicalStatus> {
  const settings = readInfisicalSettings();
  if (!settings) {
    return { configured: false, loaded: false, secretCount: 0, error: null };
  }

  try {
    const values = await fetchInfisicalSecrets(settings);
    const secretCount = applyInfisicalSecrets(values);
    return { configured: true, loaded: true, secretCount, error: null };
  } catch (error) {
    return {
      configured: true,
      loaded: false,
      secretCount: 0,
      error: describeError(error, settings),
    };
  }
}

let startupLoad: Promise<InfisicalStatus> | null = null;

/**
 * Loads the secrets once per process and caches the promise, so concurrent
 * first calls share one login. It never rejects: a failure is reported in the
 * status and the deployment falls back to its own environment variables.
 */
export function loadInfisicalSecrets(): Promise<InfisicalStatus> {
  startupLoad ??= loadOnce();
  return startupLoad;
}

/**
 * Starts the load without waiting for it. Called when the AI action module
 * boots; the status is available from {@link loadInfisicalSecrets} afterwards.
 */
export function primeInfisicalSecrets(): void {
  void loadInfisicalSecrets();
}
