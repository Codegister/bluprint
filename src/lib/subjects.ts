import {
  Atom,
  BarChart3,
  BookMarked,
  BookOpen,
  Brain,
  Briefcase,
  Calculator,
  Camera,
  Clapperboard,
  Code2,
  Cog,
  Cpu,
  Dna,
  Drama,
  Dumbbell,
  FlaskConical,
  Globe2,
  HeartPulse,
  Landmark,
  Languages,
  Leaf,
  Lightbulb,
  Microscope,
  Music,
  Palette,
  PenLine,
  Scale,
  ScrollText,
  Sigma,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Vote,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * The course picker's catalogue. Names match how exam boards label subjects so
 * the pathway prompt has unambiguous input. A free-text option covers anything
 * missing, including university modules.
 */
export type SubjectMeta = {
  name: string;
  group: string;
  icon: LucideIcon;
  /** Text colour for the icon. */
  color: string;
  /** Soft background behind the icon. */
  tint: string;
};

const SCIENCE = { color: "#128A4C", tint: "bg-[#E6F9F6]" };
const MATHS = { color: "#2563EB", tint: "bg-[#E9F0FF]" };
const HUMANITIES = { color: "#B45309", tint: "bg-[#FFF3E8]" };
const LANGUAGES = { color: "#D1367E", tint: "bg-[#FFF0F6]" };
const CREATIVE = { color: "#7C3AED", tint: "bg-[#F3ECFF]" };
const APPLIED = { color: "#0E7490", tint: "bg-[#E6F7FA]" };
const CORE = { color: "#5B3DF5", tint: "bg-[#EFEDFF]" };

const catalogue: Array<Omit<SubjectMeta, "group"> & { group: string }> = [
  // Sciences
  { name: "Biology", group: "Sciences", icon: Dna, ...SCIENCE },
  { name: "Chemistry", group: "Sciences", icon: FlaskConical, ...SCIENCE },
  { name: "Physics", group: "Sciences", icon: Atom, ...SCIENCE },
  { name: "Combined Science", group: "Sciences", icon: Microscope, ...SCIENCE },
  { name: "Environmental Science", group: "Sciences", icon: Leaf, ...SCIENCE },
  // Maths and computing
  { name: "Mathematics", group: "Maths & Computing", icon: Sigma, ...MATHS },
  { name: "Further Mathematics", group: "Maths & Computing", icon: Calculator, ...MATHS },
  { name: "Statistics", group: "Maths & Computing", icon: BarChart3, ...MATHS },
  { name: "Computer Science", group: "Maths & Computing", icon: Cpu, ...MATHS },
  { name: "Information Technology", group: "Maths & Computing", icon: Code2, ...MATHS },
  // Humanities and social sciences
  { name: "History", group: "Humanities", icon: Landmark, ...HUMANITIES },
  { name: "Geography", group: "Humanities", icon: Globe2, ...HUMANITIES },
  { name: "Economics", group: "Humanities", icon: TrendingUp, ...HUMANITIES },
  { name: "Business Studies", group: "Humanities", icon: Briefcase, ...HUMANITIES },
  { name: "Psychology", group: "Humanities", icon: Brain, ...HUMANITIES },
  { name: "Sociology", group: "Humanities", icon: Users, ...HUMANITIES },
  { name: "Politics", group: "Humanities", icon: Vote, ...HUMANITIES },
  { name: "Law", group: "Humanities", icon: Scale, ...HUMANITIES },
  { name: "Religious Studies", group: "Humanities", icon: BookMarked, ...HUMANITIES },
  { name: "Philosophy", group: "Humanities", icon: Lightbulb, ...HUMANITIES },
  // English and languages
  { name: "English Language", group: "English & Languages", icon: PenLine, ...LANGUAGES },
  { name: "English Literature", group: "English & Languages", icon: BookOpen, ...LANGUAGES },
  { name: "French", group: "English & Languages", icon: Languages, ...LANGUAGES },
  { name: "Spanish", group: "English & Languages", icon: Languages, ...LANGUAGES },
  { name: "German", group: "English & Languages", icon: Languages, ...LANGUAGES },
  { name: "Mandarin", group: "English & Languages", icon: Languages, ...LANGUAGES },
  { name: "Latin", group: "English & Languages", icon: ScrollText, ...LANGUAGES },
  // Creative and practical
  { name: "Art & Design", group: "Creative & Practical", icon: Palette, ...CREATIVE },
  { name: "Music", group: "Creative & Practical", icon: Music, ...CREATIVE },
  { name: "Drama", group: "Creative & Practical", icon: Drama, ...CREATIVE },
  { name: "Media Studies", group: "Creative & Practical", icon: Clapperboard, ...CREATIVE },
  { name: "Photography", group: "Creative & Practical", icon: Camera, ...CREATIVE },
  { name: "Design & Technology", group: "Creative & Practical", icon: Wrench, ...CREATIVE },
  {
    name: "Food Preparation & Nutrition",
    group: "Creative & Practical",
    icon: UtensilsCrossed,
    ...CREATIVE,
  },
  { name: "Physical Education", group: "Creative & Practical", icon: Dumbbell, ...CREATIVE },
  // Applied
  { name: "Health & Social Care", group: "Applied", icon: HeartPulse, ...APPLIED },
  { name: "Engineering", group: "Applied", icon: Cog, ...APPLIED },
  { name: "Accounting", group: "Applied", icon: Calculator, ...APPLIED },
  { name: "Theory of Knowledge", group: "Applied", icon: Sparkles, ...CORE },
];

export const SUBJECTS: SubjectMeta[] = catalogue.map((entry) => ({ ...entry }));

export const SUBJECT_GROUPS = [
  "Sciences",
  "Maths & Computing",
  "Humanities",
  "English & Languages",
  "Creative & Practical",
  "Applied",
] as const;

/** Looks up display metadata, including for custom subjects. */
export function subjectMeta(name: string): SubjectMeta {
  const match = SUBJECTS.find(
    (subject) => subject.name.toLowerCase() === name.trim().toLowerCase(),
  );
  return (
    match ?? {
      name,
      group: "Other",
      icon: BookOpen,
      ...CORE,
    }
  );
}

/** One line under a course name: "GCSE · AQA, Higher tier" or "IB · HL". */
export function courseSubtitle(course: {
  level: string;
  examBoard: string;
  tier?: string | null;
  variant?: string | null;
  poetryTheme?: string | null;
}): string {
  const qualification = [course.level, course.examBoard].filter(Boolean).join(" · ");
  // Older GCSE courses may still carry a Triple/Combined variant. It is no
  // longer a picker option, so do not surface it as if it were current.
  const route = course.level === "GCSE" ? null : course.variant;
  return [
    qualification,
    route,
    course.tier ? tierLabel(course.tier) : "",
    course.poetryTheme,
  ]
    .filter(Boolean)
    .join(", ");
}

/** GCSE English poetry anthologies offered by the major boards. */
export const POETRY_THEMES = ["Power and Conflict", "Love and Relationships"] as const;

export function poetryThemesFor(level: string, subject: string): string[] {
  if (level !== "GCSE") return [];
  const name = subject.trim().toLowerCase();
  if (name !== "english language" && name !== "english literature") return [];
  return [...POETRY_THEMES];
}

export type TierChoices = {
  /** HL/SL for IB. GCSE routes are separate catalogue subjects now. */
  variants: string[];
  /** Higher/Foundation tier. Shown for every GCSE course, because schools
   *  enter different subjects at different tiers. Higher is preselected. */
  tiers: string[];
};

/**
 * Tier choices depend on the qualification. Combined Science is already a
 * separate subject, so GCSE sciences do not need a Triple/Combined toggle.
 */
export function tierChoices(level: string, _subject: string): TierChoices {
  if (level === "GCSE") {
    return { variants: [], tiers: ["Higher", "Foundation"] };
  }
  if (level === "IB") return { variants: ["HL", "SL"], tiers: [] };
  return { variants: [], tiers: [] };
}

/** "Higher tier" reads better in the picker than a bare "Higher". */
export function tierLabel(value: string): string {
  return value === "Higher" || value === "Foundation" ? `${value} tier` : value;
}
