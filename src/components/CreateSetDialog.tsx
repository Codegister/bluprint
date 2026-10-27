import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EASE, EASE_EXIT } from "@/components/motion/Motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { compressImage, extractVideoFrames } from "@/lib/media";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
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

const dropzoneClass =
  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-background px-5 py-9 text-center transition-colors hover:border-brand-pink/50 hover:bg-white";

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
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [cardCount, setCardCount] = useState(20);
  const [quizCount, setQuizCount] = useState(10);
  const [examCount, setExamCount] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const previewsRef = useRef<string[]>([]);

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
    setText("");
    setCardCount(20);
    setQuizCount(10);
    setExamCount(4);
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
      setError("Those files aren't images. Use JPG or PNG photos.");
      return;
    }
    setImages((current) => {
      const room = MAX_PHOTOS - current.length;
      if (room <= 0) {
        toast.error(`Maximum ${MAX_PHOTOS} photos per set.`);
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
      throw new Error("Upload failed. Check your connection and try again.");
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
      setError("NVIDIA_API_KEY isn't configured on this deployment. Ask the workspace owner to add it before compiling a set.");
      return;
    }
    if (ai === undefined) {
      setError("Checking AI status…");
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
      setError("Paste at least a few sentences so Bluprint has source material.");
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
        setStep("Sampling six frames from the video…");
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

      setStep("Saving set…");
      // The name, course and exam context are no longer asked for here: the set
      // is named after its source file or first line, and the whole set can be
      // renamed or re-tagged later from the set page.
      const setId = await createSet({
        title: fallbackTitle || "New set",
        notes,
        sourceType,
        sourceLabel,
        targetCardCount: cardCount,
        targetQuizCount: quizCount,
        targetExamCount: examCount,
        sourceImageIds,
      });

      toast.success("Set created. Bluprint is compiling it now.");
      reset();
      onOpenChange(false);
      navigate(`/sets/${setId}`);
    } catch (submitError) {
      const message = readableError(
        submitError,
        "Could not create that set. Try again.",
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
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto rounded-3xl border-border bg-card p-0 shadow-none sm:max-w-2xl">
        <div className="px-6 pb-4 pt-6 sm:px-7">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-brand-ink">
              Add study material
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              One upload. Bluprint reads it, then builds a summary, flashcards, a quiz
              and exam practice.
            </DialogDescription>
          </DialogHeader>
          </motion.div>
        </div>

        <div className="px-6 pb-6 sm:px-7">
          {ai?.configured === false && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="mb-4 rounded-2xl bg-[#FFF6E5] px-3.5 py-3"
            >
              <p className="text-xs leading-relaxed text-[#8A5D00]">
                NVIDIA_API_KEY isn't configured on this deployment. Ask the workspace
                owner to add it before compiling a set.
              </p>
            </motion.div>
          )}

          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value as Mode);
              setError(null);
            }}
            className="mt-5 gap-4"
          >
            <TabsList className="rise-stagger grid h-auto w-full grid-cols-3 gap-1 rounded-full bg-brand-panel p-1">
              {[
                { value: "photos", label: "Photos" },
                { value: "video", label: "Video" },
                { value: "text", label: "Paste" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  disabled={isLoading}
                  className="h-9 gap-2 rounded-full text-sm font-semibold text-muted-foreground data-[state=active]:bg-white data-[state=active]:text-brand-ink data-[state=active]:shadow-sm"
                >
                {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="photos" className="mt-0">
              <label className={cn(dropzoneClass, isLoading && "pointer-events-none opacity-60")}>
                <span className="font-display text-base font-bold text-brand-ink">
                  Drop photos here
                </span>
                <span className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Printed or handwritten pages, up to {MAX_PHOTOS}. Images are compressed
                  in the browser before upload.
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
                <div className="mt-3 grid grid-cols-4 gap-2.5">
                  {images.map((image) => (
                    <div
                      key={image.preview}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-brand-panel"
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
                        className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white text-muted-foreground transition-colors hover:text-[#C93C49]"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="video" className="mt-0">
              <label className={cn(dropzoneClass, isLoading && "pointer-events-none opacity-60")}>
                <span className="font-display text-base font-bold text-brand-ink">
                  Upload a video
                </span>
                <span className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Six frames are sampled in the browser, so the video stays on your
                  device. Best for slides, whiteboards or pages you pan over.
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
                <div className="mt-3 flex items-center gap-3 rounded-2xl bg-brand-panel p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-ink">
                      {videoFile.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {fileSize(videoFile.size)} · 6 frames sampled
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Remove video"
                    className="h-8 shrink-0 rounded-full px-3 text-xs font-semibold text-muted-foreground hover:bg-white hover:text-brand-ink"
                    onClick={() => setVideoFile(null)}
                    disabled={isLoading}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="text" className="mt-0">
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste lecture notes, a textbook section or your own writing…"
                maxLength={20_000}
                rows={8}
                disabled={isLoading}
                className="min-h-[190px] resize-y rounded-2xl border-border bg-white text-sm leading-relaxed text-brand-ink shadow-none placeholder:text-muted-foreground/60 focus-visible:border-chrome-6 focus-visible:ring-chrome-6/15"
              />
              <div className="mt-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>A few sentences is enough to start</span>
                <span>{text.length.toLocaleString()} / 20,000</span>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-5 rounded-3xl border border-border bg-[#FCFCFD] p-4">
            <div>
              <p className="text-xs font-semibold text-brand-ink">
                How much to build
              </p>
              <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted-foreground">
                Choose anything from 1 to 100 of each. If your notes cannot support
                the number, Bluprint builds the maximum it can and explains why on
                the set page.
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Flashcards",
                  value: cardCount,
                  onChange: setCardCount,
                  aria: "Number of flashcards",
                },
                {
                  label: "Quiz questions",
                  value: quizCount,
                  onChange: setQuizCount,
                  aria: "Number of quiz questions",
                },
                {
                  label: "Exam-style questions",
                  value: examCount,
                  onChange: setExamCount,
                  aria: "Number of exam-style questions",
                },
              ].map((control) => (
                <label key={control.label} className="block">
                  <span className="flex items-center justify-between gap-2 text-[0.76rem] font-semibold text-brand-ink">
                    {control.label}
                    <span className="rounded-full bg-brand-panel px-2 py-0.5 text-[0.7rem] tabular-nums text-chrome-7">
                      {control.value}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={control.value}
                    disabled={isLoading}
                    onChange={(event) => control.onChange(Number(event.target.value))}
                    aria-label={control.aria}
                    className="mt-2 w-full cursor-pointer accent-chrome-6"
                  />
                  <span className="flex justify-between text-[0.62rem] font-medium text-muted-foreground">
                    <span>1</span>
                    <span>100</span>
                  </span>
                </label>
              ))}
            </div>

            <p className="mt-3 text-[0.66rem] leading-relaxed text-muted-foreground">
              Longer sets are generated in batches and take more time to compile.
              Exam-style questions are written at 5–10 marks each.
            </p>
          </div>

          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                key={error}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: -4,
                  transition: { duration: 0.22, ease: EASE_EXIT },
                }}
                transition={{ duration: 0.25, ease: EASE }}
                className="mt-4 rounded-2xl bg-[#FFEEF0] px-3.5 py-3 text-xs leading-relaxed text-[#C93C49]"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false} mode="wait">
            {isLoading && step && (
              <motion.p
                key={step}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.2, ease: EASE_EXIT } }}
                transition={{ duration: 0.2, ease: EASE }}
                className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-panel px-3.5 py-2.5 text-xs font-medium text-muted-foreground"
              >
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
                {step}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {mode === "photos"
                ? "Clear, straight-on photos transcribe best"
                : mode === "video"
                  ? "Slides and printed pages work best"
                  : "Pasted notes are saved with the set"}
            </p>
            <div className="flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-full border-border bg-white px-5 text-sm font-semibold text-brand-ink shadow-none hover:bg-brand-panel sm:flex-none"
                onClick={() => handleClose(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="h-11 flex-1 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white hover:bg-[#2A2D3E] sm:flex-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  "Build study set"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
