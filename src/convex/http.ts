import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Cognito serves its past-paper PDFs with `X-Frame-Options: SAMEORIGIN`, so a
 * paper cannot be shown inside Bluprint by pointing an iframe at the file.
 * This route reads the paper once and returns the same bytes from our own
 * origin, which lets the app's viewer show the real paper without sending the
 * student to another site.
 *
 * Only Cognito's own paper files are proxied: the host and path are checked, so
 * this cannot be used to fetch anything else.
 */
const COGNITO_PAPER_HOST = "files.cognitoedu.org";
/** A real paper with diagrams is a few MB; anything far larger is not a paper. */
const MAX_PAPER_BYTES = 25 * 1024 * 1024;

const cognitoPaper = httpAction(async (_ctx, request) => {
  const address = new URL(request.url).searchParams.get("url");
  if (!address) {
    return new Response("Missing paper address.", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(address);
  } catch {
    return new Response("That paper address is not valid.", { status: 400 });
  }
  if (
    target.protocol !== "https:" ||
    target.hostname !== COGNITO_PAPER_HOST ||
    !target.pathname.startsWith("/files/")
  ) {
    return new Response("That file is not a Cognito past paper.", {
      status: 403,
    });
  }

  const upstream = await fetch(target.toString(), {
    headers: {
      "User-Agent": "BluprintStudyBot/1.0 (+past paper viewer)",
      Accept: "application/pdf,*/*",
    },
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("That paper could not be read from Cognito.", {
      status: 502,
    });
  }
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("pdf")) {
    return new Response("That file is not a PDF.", { status: 415 });
  }
  const length = Number(upstream.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_PAPER_BYTES) {
    return new Response("That paper is too large to open here.", {
      status: 413,
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      // Read-only copy of one paper, so it is safe to reuse for a day.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

http.route({ path: "/cognito-paper", method: "GET", handler: cognitoPaper });

export default http;
