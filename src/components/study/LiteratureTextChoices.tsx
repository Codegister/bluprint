import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { literatureChoicesFor } from "@/convex/lib/literatureChoices";
import { notifyError } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Lets an existing GCSE English Literature course change its set texts.
 *
 * New courses choose these in the setup picker. This card exists so a course
 * built before the picker existed can be corrected in place; saving rebuilds the
 * pathway around the chosen texts instead of making the student delete it.
 */
export function LiteratureTextChoices({ course }: { course: Doc<"courses"> }) {
  const choices = literatureChoicesFor(course.examBoard);
  const save = useMutation(api.courses.setLiteratureChoices);
  const [open, setOpen] = useState(
    !course.litShakespeare || !course.litNovel || !course.litModern,
  );
  const [shakespeare, setShakespeare] = useState(course.litShakespeare ?? "");
  const [novel, setNovel] = useState(course.litNovel ?? "");
  const [modern, setModern] = useState(course.litModern ?? "");
  const [poetry, setPoetry] = useState(course.poetryTheme ?? "");
  const [saving, setSaving] = useState(false);

  if (
    !choices ||
    course.subject.trim().toLowerCase() !== "english literature" ||
    !/gcse/i.test(course.level)
  ) {
    return null;
  }

  const complete =
    Boolean(shakespeare && novel && modern) &&
    (choices.poetry.length === 0 || Boolean(poetry));
  const changed =
    shakespeare !== (course.litShakespeare ?? "") ||
    novel !== (course.litNovel ?? "") ||
    modern !== (course.litModern ?? "") ||
    poetry !== (course.poetryTheme ?? "");
  const summary = [shakespeare, novel, modern, poetry].filter(Boolean).join(" · ");

  const submit = async () => {
    setSaving(true);
    try {
      await save({
        courseId: course._id,
        shakespeare,
        novel,
        modern,
        ...(poetry ? { poetry } : {}),
      });
      toast.success("Texts saved. Rebuilding this pathway around them.");
      setOpen(false);
    } catch (error) {
      notifyError(error, "Could not save those texts.");
    } finally {
      setSaving(false);
    }
  };

  const groups = [
    {
      label: choices.shakespeareLabel,
      value: shakespeare,
      setValue: setShakespeare,
      options: choices.shakespeare,
    },
    {
      label: choices.novelLabel,
      value: novel,
      setValue: setNovel,
      options: choices.novel,
    },
    {
      label: choices.modernLabel,
      value: modern,
      setValue: setModern,
      options: choices.modern,
    },
    ...(choices.poetry.length > 0
      ? [
          {
            label: choices.poetryLabel,
            value: poetry,
            setValue: setPoetry,
            options: choices.poetry,
          },
        ]
      : []),
  ];

  return (
    <section className="mt-4 rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-chrome-7">
            Your texts
          </p>
          <h2 className="mt-1 font-display text-[1.1rem] font-bold text-brand-ink">
            {complete ? summary : "Choose the texts you study"}
          </h2>
          <p className="mt-1 max-w-2xl text-[0.82rem] leading-relaxed text-muted-foreground">
            The pathway uses only your {course.examBoard} set texts, not every
            text the board offers.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen((current) => !current)}
          className="h-9 rounded-full border-border bg-card px-4 text-[0.8rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
        >
          {open ? "Close" : "Change texts"}
        </Button>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <label key={group.label} className="block">
              <span className="mb-1 block text-[0.7rem] font-semibold text-brand-ink/70">
                {group.label}
              </span>
              <select
                value={group.value}
                onChange={(event) => group.setValue(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-[0.82rem] font-medium text-brand-ink outline-none transition-colors focus:border-chrome-6"
              >
                <option value="">Choose a text</option>
                {group.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="sm:col-span-2">
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={saving || !complete || !changed}
              className="h-9 rounded-full bg-[#191B27] px-4 text-[0.8rem] font-semibold text-white hover:bg-[#2A2D3E] disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save and rebuild"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
