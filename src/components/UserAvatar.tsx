import { resolveAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";
import {
  Bird,
  Bot,
  Brain,
  Cat,
  Crown,
  Dog,
  Fish,
  Flame,
  Gamepad2,
  Ghost,
  Headphones,
  Joystick,
  Leaf,
  Moon,
  Rabbit,
  Rainbow,
  Rocket,
  Snail,
  Sparkles,
  Squirrel,
  Star,
  Sword,
  Turtle,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

const AVATAR_ICONS: Record<string, LucideIcon> = {
  Bird,
  Bot,
  Brain,
  Cat,
  Crown,
  Dog,
  Fish,
  Flame,
  Gamepad2,
  Ghost,
  Headphones,
  Joystick,
  Leaf,
  Moon,
  Rabbit,
  Rainbow,
  Rocket,
  Snail,
  Squirrel,
  Star,
  Sword,
  Turtle,
  Wand2,
  Zap,
};

const sizeClasses = {
  sm: "size-8",
  md: "size-10",
  lg: "size-16",
} as const;

const iconSizeClasses = {
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
} as const;

export function UserAvatar({
  avatar,
  seed,
  name,
  size = "md",
  className,
  label,
}: {
  avatar?: string | null;
  seed?: string | null;
  name?: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
  /** Omit inside a labelled button; provide it when the picture stands alone. */
  label?: string;
}) {
  const option = resolveAvatar(avatar, seed ?? name);
  const Icon = AVATAR_ICONS[option.icon] ?? Sparkles;

  return (
    <span
      className={cn(
        "user-avatar grid shrink-0 place-items-center overflow-hidden rounded-full",
        sizeClasses[size],
        className,
      )}
      style={{ background: option.gradient, color: option.ink }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label ? option.label : undefined}
    >
      <Icon
        className={iconSizeClasses[size]}
        strokeWidth={1.8}
        aria-hidden
      />
    </span>
  );
}
