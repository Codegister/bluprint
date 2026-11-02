/**
 * The paper sources Bluprint is allowed to download into its own storage.
 *
 * This is deliberately an allow-list rather than "any URL": the cache action
 * runs on the server, so accepting arbitrary addresses would turn it into an
 * open proxy. Only the publishers that supply the listed board papers are
 * accepted, and only HTTPS PDF paths.
 */
const PAPER_HOSTS = new Set([
  "pmt.physicsandmathstutor.com",
  "www.savemyexams.com",
  "files.cognitoedu.org",
  "filestore.aqa.org.uk",
  "qualifications.pearson.com",
  "www.ocr.org.uk",
  "www.wjec.co.uk",
  "www.ccea.org.uk",
  "www.sqa.org.uk",
  "www.cambridgeinternational.org",
  "www.eduqas.co.uk",
]);

/** Normalises a publisher PDF URL, or returns null when it is not supported. */
export function normalisePaperSourceUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !PAPER_HOSTS.has(url.hostname.toLowerCase()) ||
    !/\.pdf$/i.test(url.pathname)
  ) {
    return null;
  }

  // The fragment never reaches the server, so it is not part of the cache key.
  url.hash = "";
  return url.toString();
}
