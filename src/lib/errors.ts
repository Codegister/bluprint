/**
 * Convex surfaces uncaught server errors with a request id and stack trace.
 * The underlying message is the useful part, so trim the wrapper before it
 * reaches a toast or an inline alert.
 */
export function readableError(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;

  const uncaught = error.message.match(/Uncaught Error:\s*([^\n]+)/);
  const message = (uncaught?.[1] ?? error.message)
    .replace(/^\[[^\]]*Request ID[^\]]*\]\s*/i, "")
    .replace(/^Server Error\s*/i, "")
    .replace(/\s+at handler[\s\S]*$/, "")
    .trim();

  return message || fallback;
}
