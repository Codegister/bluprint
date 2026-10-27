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
import {
  BUILD_DEFAULTS,
  BUILD_MAX,
  BUILD_MIN,
} from "@/convex/lib/buildDefaults";
import { Input } from "@/components/ui/input";
import { shortTitle, titleFromSource } from "@/convex/lib/titles";
import { compressImage, extractVideoFrames } from "@/lib/media";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type ImageDraft = { file: File; preview: string };
type Mode = "photos" | "video" | "text" | "course";

const MAX_PHOTOS = 8;

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A name from an uploaded file, cut on a word boundary. The extension goes,
 * underscores become spaces, and a long file name is shortened with the same
 * whole-word rule the generator uses, so a title is never cut mid-word.
 */
function titleFromFile(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return shortTitle(base.replace(/[_-]+/g, " "), 8, 60) || base.trim().slice(0, 60);
}

const dropzoneClass =
  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-background px-5 py-9 text-center transition-colors hover:border-brand-pink/50 hover:bg-white";

export function CreateSetDialog({
  open,
  onOpenChange,
  initialText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Notes carried over from the landing hero, used as the pasted source. */
  initialText?: string;
}) {
  const navigate = useNavigate();
  const ai = useQuery(api.settings.aiStatus);
  const generateUploadUrl = useMutation(api.studySets.generateUploadUrl);
  const createSet = useMutation(api.studySets.create);
  // A set can also come straight from a course topic, using the specification
  // notes Bluprint already mapped instead of a fresh upload.
  const courseRows = useQuery(api.courses.listMine);
  const createTopicSet = useMutation(api.courses.createTopicSet);

  const [mode, setMode] = useState<Mode>("photos");
  // Optional, and named inline: leaving it empty lets the generator title the
  // set with a short topic name after the first build.
  const [name, setName] = useState("");
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  // The one build config the product quotes everywhere (hero copy, pathway
  // sets, the edit dialog and this one), so the numbers never disagree.
  const [cardCount, setCardCount] = useState<number>(BUILD_DEFAULTS.cards);
  const [quizCount, setQuizCount] = useState<number>(BUILD_DEFAULTS.quiz);
  const [examCount, setExamCount] = useState<number>(BUILD_DEFAULTS.exam);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState("");
  const [topicId, setTopicId] = useState("");
  const previewsRef = useRef<string[]>([]);
  const openedRef = useRef(false);

  const readyCourses = (courseRows ?? []).filter(
    (course) => course.status === "ready",
  );
  const selectedCourseId = courseId || readyCourses[0]?._id || "";
  const courseDetails = useQuery(
    api.courses.getDetails,
    selectedCourseId ? { courseId: selectedCourseId as Id<"courses"> } : "skip",
  );
  const units = courseDetails?.course.pathway?.units ?? [];
  const topics = units.flatMap((unit) =>
    unit.topics.map((topic) => ({ ...topic, unit: unit.title })),
  );
  const completedTopics = new Set(courseDetails?.course.completedTopics ?? []);
  // Default to the next unfinished topic, so the common case is one click.
  const suggestedTopic =
    topics.find((topic) => !completedTopics.has(topic.id)) ?? topics[0];
  const selectedTopic =
    topics.find((topic) => topic.id === topicId) ?? suggestedTopic;
  const courseReady =
    selectedCourseId !== "" && selectedTopic !== undefined && !isLoading;

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
      previewsRef.current = [];
    };
  }, []);

  // With courses already set up, a course topic is the fastest route to a set:
  // open there, with photos and paste one tab away. This runs once per opening,
  // so it never pulls the student back off a tab they picked.
  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    // Notes typed on the landing hero arrive here: they are the pasted source,
    // so the dialog opens on the paste tab with the text already in place.
    if (initialText && initialText.trim().length >= 40) {
      openedRef.current = true;
      setMode("text");
      setText(initialText);
      return;
    }
    if (openedRef.current || courseRows === undefined) return;
    openedRef.current = true;
    if (courseRows.some((course) => course.status === "ready")) {
      setMode("course");
    }
  }, [open, courseRows, initialText]);

  const clearMedia = () => {
    previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    previewsRef.current = [];
    setImages([]);
    setVideoFile(null);
  };

  const reset = () => {
    clearMedia();
    setText("");
    setName("");
    setCardCount(BUILD_DEFAULTS.cards);
    setQuizCount(BUILD_DEFAULTS.quiz);
    setExamCount(BUILD_DEFAULTS.exam);
    setMode("photos");
    setStep("");
    setError(null);
    setCourseId("");
    setTopicId("");
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

    if (mode === "course" && (selectedCourseId === "" || !selectedTopic)) {
      setError(
        readyCourses.length === 0
          ? "Set up a course first, then build a set from one of its topics."
          : "Choose a course and a topic to build from.",
      );
      return;
    }

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

    if (mode === "course" && selectedTopic) {
      try {
        const result = await createTopicSet({
          courseId: selectedCourseId as Id<"courses">,
          topicId: selectedTopic.id,
          sections: 1,
        });
        toast.success(
          result.created
            ? "Set created from your course. Bluprint is compiling it now."
            : "Opening the set you already have for that topic.",
        );
        reset();
        onOpenChange(false);
        navigate(`/sets/${result.setId}`);
      } catch (submitError) {
        const message = readableError(
          submitError,
          "Could not build a set from that topic. Try again.",
        );
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      let sourceImageIds: Id<"_storage">[] = [];
      let sourceLabel = "";
      let notes = "";
      // The course path returns earlier, so only upload types reach here.
      const sourceType = mode as Exclude<Mode, "course">;

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

      // A short, whole-word name derived from the upload, used until the
      // generator replaces it with a topic title after the first build.
      const fallbackTitle =
        mode === "video" && videoFile
          ? titleFromFile(videoFile.name)
          : mode === "photos" && images[0]
            ? titleFromFile(images[0].file.name)
            : titleFromSource(notes) || "Study set";
      const typedName = name.trim();

      setStep("Saving set…");
      // The course and exam context are still tagged afterwards; the name can be
      // typed here or changed from the set header at any time.
      const setId = await createSet({
        title: typedName || fallbackTitle || "New set",
        titleSource: typedName ? "user" : "auto",
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
              Build from a course topic, or upload photos and notes. Bluprint reads
              the material, then writes a summary, flashcards, a quiz and exam
              practice.
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

          {/* Optional inline name. Empty means Bluprint titles the set itself
              with a short topic name once the first build finishes. */}
          {mode !== "course" && (
            <label className="mb-4 block">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-chrome-7">
                Name (optional)
              </span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isLoading}
                maxLength={60}
                placeholder="Photosynthesis"
                className="mt-1 h-10 rounded-xl border-border bg-card text-sm font-medium text-brand-ink shadow-none focus-visible:border-chrome-6 focus-visible:ring-chrome-6/15"
              />
              <span className="mt-1 block text-[0.7rem] text-muted-foreground">
                Leave it empty and Bluprint names the set from the material.
              </span>
            </label>
          )}

          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value as Mode);
              setError(null);
            }}
            className="mt-5 gap-4"
          >
            <TabsList className="rise-stagger grid h-auto w-full grid-cols-4 gap-1 rounded-full bg-brand-panel p-1">
              {[
                {
                  value: "course",
                  label: "Course",
                  icon: GraduationCap,
                  tone: "text-brand-violet",
                },
                {
                  value: "photos",
                  label: "Photos",
                  icon: ImageIcon,
                  tone: "text-brand-sky",
                },
                {
                  value: "video",
                  label: "Video",
                  icon: Video,
                  tone: "text-brand-peach",
                },
                {
                  value: "text",
                  label: "Paste",
                  icon: FileText,
                  tone: "text-brand-mint",
                },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    disabled={isLoading}
                    className="h-9 gap-1 rounded-full px-1 text-[0.8rem] font-semibold text-muted-foreground data-[state=active]:bg-white data-[state=active]:text-brand-ink data-[state=active]:shadow-sm sm:gap-1.5 sm:text-sm"
                  >
                    <Icon className={cn("size-3.5 shrink-0", tab.tone)} aria-hidden />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="course" className="mt-0">
              {courseRows === undefined ? (
                <div className="flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-background px-5 py-9 text-xs font-medium text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Loading your courses…
                </div>
              ) : readyCourses.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-border bg-background px-5 py-7 text-center">
                  <GraduationCap
                    className="mx-auto size-6 text-chrome-7"
                    aria-hidden
                  />
                  <p className="mt-2 font-display text-base font-bold text-brand-ink">
                    No courses ready yet
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    A course turns your specification into topics, and every topic
                    becomes a set here. Choose your subjects first.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      handleClose(false);
                      navigate("/courses/new");
                    }}
                    className="mt-3 h-9 rounded-full border-border bg-card px-4 text-xs font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                  >
                    Choose courses
                  </Button>
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-chrome-7">
                      Course
                    </span>
                    <select
                      value={selectedCourseId}
                      onChange={(event) => {
                        setCourseId(event.target.value);
                        setTopicId("");
                        setError(null);
                      }}
                      disabled={isLoading}
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-medium text-brand-ink outline-none focus-visible:border-chrome-6 focus-visible:ring-2 focus-visible:ring-chrome-6/15"
                    >
                      {readyCourses.map((course) => (
                        <option key={course._id} value={course._id}>
                          {course.subject} · {course.examBoard} {course.level}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-3 block">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-chrome-7">
                      Topic
                    </span>
                    <select
                      value={selectedTopic?.id ?? ""}
                      onChange={(event) => {
                        setTopicId(event.target.value);
                        setError(null);
                      }}
                      disabled={isLoading || topics.length === 0}
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-medium text-brand-ink outline-none focus-visible:border-chrome-6 focus-visible:ring-2 focus-visible:ring-chrome-6/15 disabled:opacity-60"
                    >
                      {topics.length === 0 ? (
                        <option value="">
                          {courseDetails === undefined
                            ? "Loading topics…"
                            : "No topics mapped yet"}
                        </option>
                      ) : (
                        units.map((unit) => (
                          <optgroup key={unit.title} label={unit.title}>
                            {unit.topics.map((topic) => (
                              <option key={topic.id} value={topic.id}>
                                {topic.title}
                                {completedTopics.has(topic.id) ? " (done)" : ""}
                              </option>
                            ))}
                          </optgroup>
                        ))
                      )}
                    </select>
                  </label>

                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Bluprint writes the set from this topic's place in the
                    specification. Need a longer set? Build across several topics
                    from the course page.
                  </p>
                </>
              )}
            </TabsContent>

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

          {/* Sensible defaults build a full set; only tune them on request.
              Course sets take their size from the pathway, so the sliders do
              not apply there. */}
          {mode !== "course" && (
          <details className="mt-5 rounded-3xl border border-border bg-[#FCFCFD] p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
              <span className="text-xs font-semibold text-brand-ink">
                Build options
              </span>
              <span className="text-[0.7rem] text-muted-foreground">
                {cardCount} cards · {quizCount} quiz · {examCount} exam
              </span>
            </summary>
            <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
              {`Choose anything from ${BUILD_MIN} to ${BUILD_MAX} of each. If your notes cannot support the number, Bluprint says so on the set page in one sentence: “Built 6 of 10 because the notes only support 6.”`}
            </p>

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
                    min={BUILD_MIN}
                    max={BUILD_MAX}
                    step={1}
                    value={control.value}
                    disabled={isLoading}
                    onChange={(event) => control.onChange(Number(event.target.value))}
                    aria-label={control.aria}
                    className="mt-2 w-full cursor-pointer accent-chrome-6"
                  />
                  <span className="flex justify-between text-[0.62rem] font-medium text-muted-foreground">
                    <span>{BUILD_MIN}</span>
                    <span>{BUILD_MAX}</span>
                  </span>
                </label>
              ))}
            </div>

            <p className="mt-3 text-[0.66rem] leading-relaxed text-muted-foreground">
              Longer sets are generated in batches and take more time to compile.
              Exam-style questions are written at 5–10 marks each.
            </p>
          </details>
          )}

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
              {mode === "course"
                ? "Covered by your course pathway"
                : mode === "photos"
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
                disabled={
                  isLoading || (mode === "course" && !courseReady)
                }
                className="h-11 flex-1 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white hover:bg-[#2A2D3E] sm:flex-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Working…
                  </>
                ) : mode === "course" ? (
                  "Build from course"
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
