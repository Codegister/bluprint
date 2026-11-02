/**
 * The paper sources Bluprint is allowed to download into its own storage.
 *
 * This is deliberately an allow-list rather than "any URL": the cache action
 * runs on the server, so accepting arbitrary addresses would turn it into an
 * open proxy. Only the publishers that supply the listed board papers are
 * accepted, and only HTTPS PDF paths.
 */
const PAPER_HOSTS: Record<string, string | null> = {
  "pmt.physicsandmathstutor.com": null,
  "www.savemyexams.com": null,
  "files.cognitoedu.org": null,
  "filestore.aqa.org.uk": null,
  // AQA moved newer files from filestore to its main host.
  "www.aqa.org.uk": "/files/",
  // Save My Exams serves some board papers from its Sanity file store.
  "cdn.sanity.io": "/files/p28bar15/green/",
  "qualifications.pearson.com": null,
  "www.ocr.org.uk": null,
  "www.wjec.co.uk": null,
  "www.ccea.org.uk": null,
  "www.sqa.org.uk": null,
  "www.cambridgeinternational.org": null,
  "www.eduqas.co.uk": null,
};

/** Normalises a publisher PDF URL, or returns null when it is not supported. */
export function normalisePaperSourceUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const pathPrefix = PAPER_HOSTS[hostname];
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !(hostname in PAPER_HOSTS) ||
    (pathPrefix && !url.pathname.startsWith(pathPrefix)) ||
    !/\.pdf$/i.test(url.pathname)
  ) {
    return null;
  }

  // The fragment never reaches the server, so it is not part of the cache key.
  url.hash = "";
  return url.toString();
}
