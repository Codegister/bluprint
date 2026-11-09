/**
 * URL helpers for links built from AI output, web search results or scraped
 * publisher pages.
 *
 * A link is only safe when its scheme is http or https. `new URL` accepts
 * `javascript:` and `data:` values, so checking that parsing succeeds is not
 * enough: those schemes must never reach an anchor's href.
 */
export function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** A display host for a link, or the original text when it cannot be parsed. */
export function hostOf(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}
