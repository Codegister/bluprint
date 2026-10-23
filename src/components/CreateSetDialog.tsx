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
      const setId = await createSet({
        title: title.trim() || fallbackTitle || "New set",
        notes,
        sourceType,
        sourceLabel,
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
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-xl border-border bg-card p-0 shadow-none sm:max-w-2xl">
        <div className="border-b border-border bg-brand-panel px-5 py-5 sm:px-6">
          <DialogHeader>
            <p className="mono-label text-brand-pink">COMPILE / NEW SET</p>
            <DialogTitle className="mt-1.5 font-display text-xl font-semibold">
              Add source material
            </DialogTitle>
            <DialogDescription className="text-[12px] leading-relaxed text-muted-foreground">
              One upload. Bluprint extracts the text and generates a summary, cards, quiz
              and exam practice in a single run.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {ai?.configured === false && (
            <div className="mb-4 flex items-start gap-2.5 rounded-md border border-brand-lime/25 bg-brand-lime/[0.06] p-3">
              <KeyRound className="mt-0.5 size-3.5 shrink-0 text-brand-lime" />
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                NVIDIA_API_KEY isn't configured on this deployment. Ask the workspace owner
                to add it before compiling a set.
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="set-title"
              className="mono-label text-muted-foreground"
            >
              SET NAME / OPTIONAL
            </label>
            <Input
              id="set-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Cell biology — Unit 2"
              maxLength={80}
              className="mt-2 h-10 rounded-md border-border bg-brand-panel text-sm text-brand-ink placeholder:text-muted-foreground/60"
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
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-md border border-border bg-background p-1">
              {[
                { value: "photos", label: "PHOTOS", icon: <Camera className="size-3.5" /> },
                { value: "video", label: "VIDEO", icon: <Video className="size-3.5" /> },
                { value: "text", label: "TEXT", icon: <FileText className="size-3.5" /> },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  disabled={isLoading}
                  className="h-8 rounded font-mono text-[10px] tracking-wide text-muted-foreground data-[state=active]:border data-[state=active]:border-brand-pink/25 data-[state=active]:bg-brand-pink/10 data-[state=active]:text-brand-pink data-[state=active]:shadow-none"
                >
                  {tab.icon}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="photos" className="mt-0">
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-brand-panel/50 px-4 py-7 text-center transition-colors hover:border-brand-pink/40 hover:bg-brand-panel",
                  isLoading && "pointer-events-none opacity-60",
                )}
              >
                <span className="grid size-10 place-items-center rounded-md border border-brand-pink/25 bg-brand-pink/10 text-brand-pink">
                  <ImagePlus className="size-4" />
                </span>
                <span className="font-mono text-[10.5px] tracking-wide text-brand-ink">
                  SELECT PHOTOS
                </span>
                <span className="max-w-xs text-[10.5px] leading-relaxed text-muted-foreground">
                  Printed or handwritten pages, up to {MAX_PHOTOS}. Images are compressed in
                  the browser before upload.
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
                      className="group relative aspect-square overflow-hidden rounded-md border border-border bg-brand-panel"
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
                        className="absolute right-1 top-1 grid size-5 place-items-center rounded border border-border bg-background/90 text-muted-foreground transition hover:text-brand-peach"
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="video" className="mt-0">
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-brand-panel/50 px-4 py-7 text-center transition-colors hover:border-brand-pink/40 hover:bg-brand-panel",
                  isLoading && "pointer-events-none opacity-60",
                )}
              >
                <span className="grid size-10 place-items-center rounded-md border border-brand-sky/25 bg-brand-sky/10 text-brand-sky">
                  <Upload className="size-4" />
                </span>
                <span className="font-mono text-[10.5px] tracking-wide text-brand-ink">
                  SELECT VIDEO
                </span>
                <span className="max-w-sm text-[10.5px] leading-relaxed text-muted-foreground">
                  Six frames are sampled in the browser, so the video stays on your device.
                  Best for slides, whiteboards or pages you pan over.
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
                <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-brand-panel p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded border border-brand-sky/25 bg-brand-sky/10 text-brand-sky">
                    <Video className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-medium text-brand-ink">
                      {videoFile.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] tracking-wide text-muted-foreground">
                      {fileSize(videoFile.size)} / 6 FRAMES
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove video"
                    className="text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
                    onClick={() => setVideoFile(null)}
                    disabled={isLoading}
                  >
                    <Trash2 className="size-3.5" />
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
                className="min-h-[180px] resize-y rounded-md border-border bg-brand-panel text-[13px] leading-relaxed text-brand-ink placeholder:text-muted-foreground/60"
              />
              <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] tracking-wide text-muted-foreground">
                <span>AT LEAST A FEW SENTENCES WORKS BEST</span>
                <span>{text.length.toLocaleString()} / 20,000</span>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading && step && (
            <p className="mt-4 flex items-center gap-2 rounded-md border border-border bg-brand-panel px-3 py-2 font-mono text-[9.5px] tracking-wide text-muted-foreground">
              <Loader2 className="size-3 shrink-0 animate-spin" />
              {step.toUpperCase()}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[9px] leading-relaxed tracking-wide text-muted-foreground/70">
              {mode === "photos"
                ? "CLEAR, STRAIGHT-ON PHOTOS TRANSCRIBE BEST"
                : mode === "video"
                  ? "SLIDES AND PRINTED PAGES WORK BEST"
                  : "PASTED NOTES ARE STORED WITH THE SET"}
            </p>
            <div className="flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-9 flex-1 rounded-md border-border bg-transparent font-mono text-[10px] tracking-wide sm:flex-none"
                onClick={() => handleClose(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="h-9 flex-1 rounded-md bg-brand-pink font-mono text-[10.5px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep sm:flex-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Working…
                  </>
                ) : (
                  <>
                    Compile set
                    <ArrowRightIcon />
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

function ArrowRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
