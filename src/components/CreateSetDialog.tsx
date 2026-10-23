import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { compressImage, extractVideoFrames } from "@/lib/media";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  Camera,
  FileText,
  ImagePlus,
  KeyRound,
  Loader2,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

type ImageDraft = { file: File; preview: string };
type Mode = "photos" | "video" | "text";

const MAX_PHOTOS = 8;

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function titleFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 60).trim();
}

export function CreateSetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const ai = useQuery(api.settings.aiStatus);
  const generateUploadUrl = useMutation(api.studySets.generateUploadUrl);
  const createSet = useMutation(api.studySets.create);

  const [mode, setMode] = useState<Mode>("photos");
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const previewsRef = useRef<string[]>([]);

  // Object URLs must be released when the dialog goes away.
  useEffect(() => {
    return () => {
      previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
      previewsRef.current = [];
    };
  }, []);

  const clearMedia = () => {
    previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    previewsRef.current = [];
    setImages([]);
    setVideoFile(null);
  };

  const reset = () => {
    clearMedia();
    setTitle("");
    setText("");
    setMode("photos");
    setStep("");
    setError(null);
  };

  const handleClose = (next: boolean) => {
    if (isLoading) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const incoming = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (incoming.length === 0) {
      setError("Those files don't look like images. Try JPG or PNG photos.");
      return;
    }
    setImages((current) => {
      const room = MAX_PHOTOS - current.length;
      if (room <= 0) {
        toast.error(`You can add up to ${MAX_PHOTOS} photos per set.`);
        return current;
      }
      const accepted = incoming.slice(0, room).map((file) => {
        const preview = URL.createObjectURL(file);
        previewsRef.current.push(preview);
        return { file, preview };
      });
      if (incoming.length > room) {
        toast.error(`Only the first ${room} photos were added (max ${MAX_PHOTOS}).`);
      }
      return [...current, ...accepted];
    });
  };

  const removePhoto = (preview: string) => {
    URL.revokeObjectURL(preview);
    previewsRef.current = previewsRef.current.filter((item) => item !== preview);
    setImages((current) => current.filter((image) => image.preview !== preview));
  };

  const uploadBlob = async (blob: Blob): Promise<Id<"_storage">> => {
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": blob.type || "image/jpeg" },
      body: blob,
    });
    if (!response.ok) {
      throw new Error("That upload didn't go through. Check your connection and try again.");
    }
    const payload = (await response.json()) as { storageId: string };
    return payload.storageId as Id<"_storage">;
  };

  const uploadFrames = async (frames: Blob[]) => {
    const ids: Id<"_storage">[] = [];
    for (const [index, frame] of frames.entries()) {
      setStep(`Uploading frame ${index + 1} of ${frames.length}…`);
      ids.push(await uploadBlob(frame));
    }
    return ids;
  };

  const handleSubmit = async () => {
    setError(null);

    if (ai?.configured === false) {
      setError("Pip needs an NVIDIA key before it can generate a set. Open AI setup to add one.");
      return;
    }
    if (mode === "photos" && images.length === 0) {
      setError("Add at least one photo of your notes.");
      return;
    }
    if (mode === "video" && !videoFile) {
      setError("Choose a video to sample frames from.");
      return;
    }
    if (mode === "text" && text.trim().length < 40) {
      setError("Paste at least a few sentences so Pip has something to work with.");
      return;
    }

    setIsLoading(true);
    try {
      let sourceImageIds: Id<"_storage">[] = [];
      let sourceLabel = "";
      let notes = "";
      const sourceType: Mode = mode;

      if (mode === "photos") {
        const ids: Id<"_storage">[] = [];
        for (const [index, image] of images.entries()) {
          setStep(`Preparing photo ${index + 1} of ${images.length}…`);
          const compressed = await compressImage(image.file);
          setStep(`Uploading photo ${index + 1} of ${images.length}…`);
          ids.push(await uploadBlob(compressed));
        }
        sourceImageIds = ids;
        sourceLabel = `${images.length} photo${images.length === 1 ? "" : "s"}`;
      }

      if (mode === "video" && videoFile) {
        setStep("Sampling six frames from your video…");
        const frames = await extractVideoFrames(videoFile, 6);
        sourceImageIds = await uploadFrames(frames);
        sourceLabel = videoFile.name.slice(0, 100);
      }

      if (mode === "text") {
        notes = text.trim();
        sourceLabel = "Pasted notes";
      }

      const fallbackTitle =
        mode === "video" && videoFile
          ? titleFromFile(videoFile.name)
          : mode === "photos" && images[0]
            ? titleFromFile(images[0].file.name)
            : text.trim().split("\n")[0]?.slice(0, 60) ?? "Study set";

      setStep("Saving your set…");
      const setId = await createSet({
        title: title.trim() || fallbackTitle || "New study set",
        notes,
        sourceType,
        sourceLabel,
        sourceImageIds,
      });

      toast.success("Set created — Pip is reading it now.");
      reset();
      onOpenChange(false);
      navigate(`/sets/${setId}`);
    } catch (submitError) {
      const message = readableError(
        submitError,
        "Could not create that set. Please try again.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
      setStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[26px] border-brand-ink/15 p-0 shadow-none sm:max-w-2xl">
        <div className="border-b border-brand-ink/10 bg-brand-cream/60 px-5 py-5 sm:px-6">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold">
              New study set
            </DialogTitle>
            <DialogDescription className="text-[13px] text-brand-ink/55">
              Give Pip something to read. It builds the summary, cards, quiz and exam
              practice for you.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {ai?.configured === false && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-brand-lime bg-brand-lime/40 p-3">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-brand-ink" />
              <p className="text-[12px] leading-relaxed text-brand-ink/70">
                NVIDIA_API_KEY isn't set yet.{" "}
                <Link to="/setup" className="font-bold underline underline-offset-2">
                  Open AI setup
                </Link>{" "}
                first — you can still draft a set now.
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="set-title"
              className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-ink/45"
            >
              Set name <span className="font-medium normal-case tracking-normal">(optional)</span>
            </label>
            <Input
              id="set-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Cell biology — Unit 2"
              maxLength={80}
              className="mt-2 h-10 rounded-xl border-brand-ink/15 bg-white text-sm"
              disabled={isLoading}
            />
          </div>

          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value as Mode);
              setError(null);
            }}
            className="mt-5 gap-4"
          >
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-brand-cream p-1">
              {[
                { value: "photos", label: "Photos", icon: <Camera className="size-3.5" /> },
                { value: "video", label: "Video", icon: <Video className="size-3.5" /> },
                { value: "text", label: "Paste text", icon: <FileText className="size-3.5" /> },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  disabled={isLoading}
                  className="h-9 rounded-lg px-2 text-[12px] font-semibold data-[state=active]:bg-white data-[state=active]:text-brand-ink data-[state=active]:shadow-none"
                >
                  {tab.icon}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="photos" className="mt-0">
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-ink/20 bg-brand-cream/40 px-4 py-7 text-center transition-colors hover:border-brand-ink/40 hover:bg-brand-cream/70",
                  isLoading && "pointer-events-none opacity-60",
                )}
              >
                <span className="grid size-11 place-items-center rounded-2xl border border-brand-ink/10 bg-white">
                  <ImagePlus className="size-5 text-brand-ink" />
                </span>
                <span className="text-sm font-bold text-brand-ink">
                  Choose photos of your notes
                </span>
                <span className="max-w-xs text-[11px] leading-relaxed text-brand-ink/45">
                  Printed or handwritten pages, up to {MAX_PHOTOS}. Photos are compressed in
                  your browser before upload.
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={isLoading}
                  onChange={(event) => {
                    addPhotos(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>

              {images.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {images.map((image) => (
                    <div
                      key={image.preview}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-brand-ink/10 bg-white"
                    >
                      <img
                        src={image.preview}
                        alt={image.file.name}
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${image.file.name}`}
                        onClick={() => removePhoto(image.preview)}
                        className="absolute right-1 top-1 grid size-6 place-items-center rounded-full border border-brand-ink/15 bg-white/95 text-brand-ink transition hover:bg-brand-pink"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="video" className="mt-0">
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-ink/20 bg-brand-cream/40 px-4 py-7 text-center transition-colors hover:border-brand-ink/40 hover:bg-brand-cream/70",
                  isLoading && "pointer-events-none opacity-60",
                )}
              >
                <span className="grid size-11 place-items-center rounded-2xl border border-brand-ink/10 bg-white">
                  <Upload className="size-5 text-brand-ink" />
                </span>
                <span className="text-sm font-bold text-brand-ink">
                  Choose a video of your notes
                </span>
                <span className="max-w-sm text-[11px] leading-relaxed text-brand-ink/45">
                  We sample six frames in your browser, so the video itself stays on your
                  device. Best for lecture slides, whiteboards or pages you're panning over.
                </span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  disabled={isLoading}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setVideoFile(file);
                    setError(null);
                    event.target.value = "";
                  }}
                />
              </label>

              {videoFile && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-brand-ink/10 bg-white p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-sky">
                    <Video className="size-4 text-brand-ink" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-brand-ink">
                      {videoFile.name}
                    </p>
                    <p className="text-[11px] text-brand-ink/45">
                      {fileSize(videoFile.size)} · 6 frames will be sampled
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove video"
                    className="text-brand-ink/40 hover:text-brand-ink"
                    onClick={() => setVideoFile(null)}
                    disabled={isLoading}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="text" className="mt-0">
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste lecture notes, a textbook section or your own writing here…"
                maxLength={20_000}
                rows={8}
                disabled={isLoading}
                className="min-h-[180px] resize-y rounded-xl border-brand-ink/15 bg-white text-sm leading-relaxed"
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-brand-ink/40">
                <span>At least a few sentences works best.</span>
                <span>{text.length.toLocaleString()} / 20,000</span>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-[12px] font-medium text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                {error}{" "}
                {error.includes("NVIDIA") && (
                  <Link to="/setup" className="font-bold underline underline-offset-2">
                    Open AI setup
                  </Link>
                )}
              </span>
            </div>
          )}

          {isLoading && step && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-brand-cream/70 px-3 py-2 text-[11px] font-semibold text-brand-ink/55">
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
              {step}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-brand-ink/40">
              {mode === "photos"
                ? "Pip reads the text it can see. Clear, straight-on photos work best."
                : mode === "video"
                  ? "Slides and printed pages transcribe best. Handwriting must be legible."
                  : "Your pasted notes are saved with the set."}
            </p>
            <div className="flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 rounded-xl border-brand-ink/15 font-semibold sm:flex-none"
                onClick={() => handleClose(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="h-10 flex-1 rounded-xl border-2 border-brand-ink bg-brand-pink font-bold text-brand-ink hover:bg-brand-pink-deep hover:text-brand-cream sm:flex-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  <>
                    Build my set
                    <span aria-hidden>→</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
