import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { normalisePaperSourceUrl } from "./lib/paperSource";
import { requireUserId } from "./lib/requireUser";

/**
 * Board PDFs copied into Convex file storage.
 *
 * The viewer used to ask the publisher for the PDF directly, which depended on
 * that host's CORS policy and its response headers. A paper is now downloaded
 * once, stored under the source URL, and served by the app on later opens.
 *
 * The cache is shared across accounts because the same board paper is the same
 * file for everyone. Board papers remain the publisher's copyright; operating
 * this cache requires permission to redistribute the files it stores.
 */

/** A paper is a few megabytes; this is a runaway guard, not a normal limit. */
const MAX_PAPER_BYTES = 20 * 1024 * 1024;

type CachedPaper = { storageId: Id<"_storage">; cached: boolean };

export const findBySource = internalQuery({
  args: { sourceUrl: v.string() },
  handler: async (ctx, { sourceUrl }) => {
    return await ctx.db
      .query("paperFiles")
      .withIndex("by_source", (q) => q.eq("sourceUrl", sourceUrl))
      .first();
  },
});

/**
 * Records a downloaded file. If another request stored the same paper while
 * this one was downloading, the existing copy wins and the duplicate is
 * removed.
 */
export const recordFile = internalMutation({
  args: {
    sourceUrl: v.string(),
    storageId: v.id("_storage"),
    bytes: v.number(),
  },
  handler: async (ctx, { sourceUrl, storageId, bytes }) => {
    const existing = await ctx.db
      .query("paperFiles")
      .withIndex("by_source", (q) => q.eq("sourceUrl", sourceUrl))
      .first();

    if (existing) {
      const existingUrl = await ctx.storage.getUrl(existing.storageId);
      if (existingUrl) {
        await ctx.storage.delete(storageId);
        return { storageId: existing.storageId, cached: true };
      }
      // The row points at a file that no longer exists; replace it.
      await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("paperFiles", {
      sourceUrl,
      storageId,
      bytes,
      fetchedAt: Date.now(),
    });
    return { storageId, cached: false };
  },
});

/**
 * Returns the stored copy of a paper, downloading it on the first open.
 *
 * The client only receives a storage id. The file itself is served by the
 * same-origin `/paper-file` HTTP route in http.ts, which adds the PDF content
 * type and CORS headers the renderer needs.
 */
export const cachePaper = action({
  args: { url: v.string() },
  handler: async (ctx, { url }): Promise<CachedPaper> => {
    await requireUserId(ctx);

    const sourceUrl = normalisePaperSourceUrl(url);
    if (!sourceUrl) {
      throw new Error("This paper link is not one Bluprint can store.");
    }

    const existing: { storageId: Id<"_storage"> } | null = await ctx.runQuery(
      internal.paperFiles.findBySource,
      { sourceUrl },
    );
    if (existing) {
      const fileUrl = await ctx.storage.getUrl(existing.storageId);
      if (fileUrl) {
        return { storageId: existing.storageId, cached: true };
      }
    }

    let response: Response;
    try {
      response = await fetch(sourceUrl, {
        redirect: "follow",
        headers: {
          Accept: "application/pdf,*/*;q=0.8",
          "User-Agent": "Bluprint/1.0 (past-paper cache)",
        },
      });
    } catch {
      throw new Error(
        "This paper could not be downloaded from the exam board. Open the original instead.",
      );
    }

    // A redirect must not turn the cache into a request for an arbitrary host.
    if (!normalisePaperSourceUrl(response.url)) {
      throw new Error("This paper link is not one Bluprint can store.");
    }
    if (!response.ok) {
      throw new Error(
        "This paper could not be downloaded from the exam board. Open the original instead.",
      );
    }

    const declared = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_PAPER_BYTES) {
      throw new Error(
        "This paper could not be downloaded from the exam board. Open the original instead.",
      );
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_PAPER_BYTES) {
      throw new Error(
        "This paper could not be downloaded from the exam board. Open the original instead.",
      );
    }

    // Do not store an HTML error page or a login wall under a PDF's name.
    const magic = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
    const isPdf =
      magic.length === 5 &&
      magic[0] === 0x25 &&
      magic[1] === 0x50 &&
      magic[2] === 0x44 &&
      magic[3] === 0x46 &&
      magic[4] === 0x2d;
    if (!isPdf) {
      throw new Error(
        "This paper could not be downloaded from the exam board. Open the original instead.",
      );
    }

    const storageId = await ctx.storage.store(
      new Blob([buffer], { type: "application/pdf" }),
    );
    return await ctx.runMutation(internal.paperFiles.recordFile, {
      sourceUrl,
      storageId,
      bytes: buffer.byteLength,
    });
  },
});
