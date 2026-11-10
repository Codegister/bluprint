/**
 * Hosts that run Bluprint inside a preview shell. The Vly integration is
 * preview tooling: it loads a screenshot library from a third-party CDN, which
 * the production Content-Security-Policy deliberately blocks.
 */
export function isPreviewHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".vly.sh") ||
    hostname.endsWith(".style.dev")
  );
}
