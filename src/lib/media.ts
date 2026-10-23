/**
 * Browser-side media preparation.
 *
 * Photos and video are converted to compact JPEGs before upload. That keeps the
 * Convex storage and NVIDIA vision requests small, and means the server only
 * has to handle one image type. The originals never leave the browser for video;
 * just six sampled frames do.
 */

const MAX_IMAGE_EDGE = 1600;
const MAX_FRAME_EDGE = 1280;

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process this image."))),
      "image/jpeg",
      quality,
    );
  });
}

function drawScaled(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxEdge: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not prepare this image.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Shrinks and re-encodes a photo so OCR still works but uploads stay light. */
export async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = await loadImage(file);
  }
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    const canvas = drawScaled(bitmap, width, height, MAX_IMAGE_EDGE);
    return await canvasToJpeg(canvas);
  } finally {
    if ("close" in bitmap) bitmap.close();
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          `Couldn't read ${file.name}. Try a JPG or PNG (some HEIC photos aren't supported by browsers).`,
        ),
      );
    };
    image.src = url;
  });
}

/**
 * Samples evenly spaced frames from a video for the vision model. This is the
 * version-1 approach to video notes and is called out in the README; no video
 * file is uploaded or stored.
 */
export async function extractVideoFrames(
  file: File,
  count = 6,
): Promise<Blob[]> {
  if (file.size > 200 * 1024 * 1024) {
    throw new Error("That video is over 200MB. Try a shorter clip or upload photos instead.");
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Timed out reading that video. Try a shorter clip.")),
        20_000,
      );
      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Your browser couldn't read that video format. Try MP4 or upload photos."));
      };
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0) {
      throw new Error("That video has no readable duration. Try MP4 or upload photos.");
    }

    const frames: Blob[] = [];
    for (let index = 0; index < count; index += 1) {
      // Sample from 5% to 95% of the clip to skip intro/outro blur.
      const time = duration * (0.05 + (0.9 * index) / Math.max(1, count - 1));
      await seekVideo(video, Math.min(time, Math.max(0, duration - 0.05)));
      const canvas = drawScaled(
        video,
        video.videoWidth || 1280,
        video.videoHeight || 720,
        MAX_FRAME_EDGE,
      );
      frames.push(await canvasToJpeg(canvas, 0.8));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Timed out sampling that video. Try a shorter clip.")),
      15_000,
    );
    const done = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", done);
      // A short beat lets the decoder paint the sought frame.
      window.setTimeout(resolve, 90);
    };
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = time;
  });
}
