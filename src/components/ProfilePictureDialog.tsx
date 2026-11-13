import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AVATAR_GROUPS,
  randomAvatarId,
  resolveAvatar,
  type AvatarId,
} from "@/lib/avatars";
import { cn } from "@/lib/utils";
import { Check, Loader2, Shuffle } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * A small, self-contained profile-picture picker. Choices are applied only
 * when the user saves, so browsing the grid never writes a mutation per click.
 */
export function ProfilePictureDialog({
  open,
  onOpenChange,
  currentAvatar,
  seed,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatar?: string | null;
  seed?: string | null;
  saving?: boolean;
  onSave: (avatar: AvatarId) => void;
}) {
  const [selected, setSelected] = useState<AvatarId>(() =>
    resolveAvatar(currentAvatar, seed).id,
  );

  useEffect(() => {
    if (open) setSelected(resolveAvatar(currentAvatar, seed).id);
  }, [open, currentAvatar, seed]);

  const selectedOption = resolveAvatar(selected, seed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Choose your profile picture
          </DialogTitle>
          <DialogDescription>
            Pick a pre-made identity for your workspace. You can change it
            again whenever you like.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-brand-panel/35 p-3">
          <UserAvatar
            avatar={selected}
            seed={seed}
            size="lg"
            label={`${selectedOption.label} avatar`}
          />
          <div className="min-w-0">
            <p className="font-semibold text-brand-ink" aria-live="polite">
              {selectedOption.label}
            </p>
            <p className="text-[0.78rem] text-muted-foreground">
              {selectedOption.group}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => setSelected(randomAvatarId(selected))}
          >
            <Shuffle className="size-3.5" aria-hidden />
            Shuffle
          </Button>
        </div>

        <div className="space-y-4">
          {AVATAR_GROUPS.map((group) => {
            const headingId = `avatar-group-${group.label
              .toLowerCase()
              .replace(/\s+/g, "-")}`;
            return (
              <section key={group.label} aria-labelledby={headingId}>
                <h3
                  id={headingId}
                  className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground"
                >
                  {group.label}
                </h3>
                <div
                  role="radiogroup"
                  aria-labelledby={headingId}
                  className="grid grid-cols-5 gap-1.5 min-[360px]:grid-cols-6 sm:grid-cols-8 sm:gap-2"
                >
                  {group.options.map((option) => {
                    const isSelected = option.id === selected;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`${option.label} avatar`}
                        title={option.label}
                        onClick={() => setSelected(option.id)}
                        className={cn(
                          "group relative flex aspect-square items-center justify-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          isSelected
                            ? "border-[var(--signal)] bg-[var(--signal-wash)]"
                            : "border-transparent hover:border-border hover:bg-brand-panel/60",
                        )}
                      >
                        <UserAvatar
                          avatar={option.id}
                          seed={seed}
                          size="md"
                          className="transition-transform group-hover:scale-105"
                        />
                        {isSelected && (
                          <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-[var(--signal)] text-[var(--signal-ink)]">
                            <Check className="size-2.5" strokeWidth={3} aria-hidden />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => onSave(selected)} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save picture"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
