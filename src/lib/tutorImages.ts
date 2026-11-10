/**
 * Uploads the images attached to one tutor question.
 *
 * The browser shrinks each image before it leaves the device, exactly as the
 * notes upload does, so a phone screenshot is not sent at full size. The
 * returned storage ids are capability-like: only the signed-in tutor action
 * receives them, and the image is read once by the vision model.
 */

import type { Id } from "@/convex/_generated/dataModel";
import { compressImage } from "@/lib/media";

export const MAX_TUTOR_IMAGE_ATTACHMENTS = 2;

export async function uploadTutorImages(
  files: File[],
  generateUploadUrl: () => Promise<string>,
): Promise<Id<"_storage">[]> {
  const ids: Id<"_storage">[] = [];

  for (const file of files.slice(0, MAX_TUTOR_IMAGE_ATTACHMENTS)) {
    const image = await compressImage(file);
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": image.type || "image/jpeg" },
      body: image,
    });
    if (!response.ok) {
      throw new Error(
        "That image could not be uploaded. Check your connection and try again.",
      );
    }
    const payload = (await response.json().catch(() => null)) as {
      storageId?: unknown;
    } | null;
    if (typeof payload?.storageId !== "string" || payload.storageId.length === 0) {
      throw new Error("The image upload did not complete. Try sending it again.");
    }
    ids.push(payload.storageId as Id<"_storage">);
  }

  return ids;
}
