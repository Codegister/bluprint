/**
 * Respan Gateway configuration.
 *
 * The gateway is an optional, local OpenAI-compatible front door for the
 * app's model calls. Running it (see `gateway.toml` in the repository root)
 * and setting `RESPAN_GATEWAY_URL` on the deployment sends every NVIDIA chat
 * request through it, which is where routing, retries and the request log
 * live. With the variable unset — the default, including production — the
 * app talks to NVIDIA directly and nothing about its behaviour changes.
 *
 * The gateway is open source and uses the developer's own provider key. No
 * Respan account, hosted credit or trace export is involved, and no secret is
 * written here: the provider key stays in `NVIDIA_API_KEY`.
 */

/**
 * Turns a gateway base URL into the chat completions endpoint the transport
 * posts to.
 *
 * Accepts what people actually paste: `http://127.0.0.1:8080`, the same with
 * `/v1`, or the full `/v1/chat/completions` URL. A bare `host:port` gets
 * `http://` because the gateway refuses to serve plaintext credentials on a
 * public address and is documented on loopback. An empty or whitespace-only
 * value means "no gateway", so an unset variable, an empty Convex env value
 * and a cleared `.env` line all fall back to the direct URL rather than
 * posting to nowhere.
 */
export function chatCompletionsUrl(
  gatewayUrl: string | null | undefined,
  directUrl: string,
): string {
  const raw = (gatewayUrl ?? "").trim();
  if (raw.length === 0) return directUrl;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `http://${raw}`;
  const base = withScheme.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}
