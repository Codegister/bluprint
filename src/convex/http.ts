import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

/**
 * Convex Auth's endpoints, plus the cached-paper file route.
 *
 * `/paper-file` serves a board PDF that `/paperFiles.cachePaper` copied into
 * Convex storage. It exists because the PDF renderer needs a stable same-
 * origin-style response with a PDF content type and CORS headers; asking the
 * publisher directly made the viewer depend on that host's CORS policy.
 *
 * Board papers remain the publisher's copyright. Running this route means the
 * operator is responsible for having permission to redistribute the files it
 * stores.
 */
const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/paper-file",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return new Response("Not found", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const storageId = id as Id<"_storage">;
    // Storage ids are capability-like, but they are not a public API: an
    // uploaded note photo must never be fetchable just because its id leaked.
    // Serve only blobs recorded by the paper cache.
    let paper: { storageId: Id<"_storage"> } | null = null;
    try {
      paper = await ctx.runQuery(internal.paperFiles.findByStorage, { storageId });
    } catch {
      paper = null;
    }
    if (!paper) {
      return new Response("Not found", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    let blob: Blob | null = null;
    try {
      blob = await ctx.storage.get(paper.storageId);
    } catch {
      blob = null;
    }
    if (!blob) {
      return new Response("Not found", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(blob, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": 'inline; filename="paper.pdf"',
        "Content-Type": "application/pdf",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }),
});

export default http;
