import { cn } from "@/lib/utils";

/**
 * Bluprint's study buddy: a small violet axolotl drawn in SVG so it stays
 * crisp at any size and needs no image assets. Purely decorative.
 */
export function Mascot({
  size = 200,
  className,
  float = true,
}: {
  size?: number;
  className?: string;
  float?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", float && "mascot-float", className)}
      role="img"
      aria-label="Bluprint's axolotl study buddy"
    >
      <defs>
        <linearGradient id="blu-body" x1="74" y1="60" x2="176" y2="188">
          <stop offset="0" stopColor="#A78BFA" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6D5AF0" />
        </linearGradient>
        <linearGradient id="blu-fin" x1="20" y1="120" x2="96" y2="176">
          <stop offset="0" stopColor="#C4B5FD" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="blu-gill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C4B5FD" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="122" cy="212" rx="52" ry="9" fill="#16181F" opacity="0.07" />

      {/* tail fin sweeping out behind the body */}
      <path
        d="M96 150c-22 12-48 6-62 26 18 12 40 16 56 8 10-5 12-24 6-34Z"
        fill="url(#blu-fin)"
        opacity="0.92"
      />

      {/* gills: three fronds each side, behind the head */}
      <g
        stroke="url(#blu-gill)"
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.95"
      >
        <path d="M74 78 46 58" />
        <path d="M72 92 40 86" />
        <path d="M76 104 48 112" />
        <path d="M166 78 194 58" />
        <path d="M168 92 200 86" />
        <path d="M164 104 192 112" />
      </g>

      {/* body */}
      <path
        d="M120 46c33 0 58 23 58 55 0 38-26 66-58 66s-58-28-58-66c0-32 25-55 58-55Z"
        fill="url(#blu-body)"
      />

      {/* belly highlight */}
      <path
        d="M120 148c-18 0-32-12-35-26 12 9 25 12 35 12s23-3 35-12c-3 14-17 26-35 26Z"
        fill="#C4B5FD"
        opacity="0.45"
      />

      {/* closed, content eyes */}
      <path
        d="M96 104c4-6 12-6 16 0"
        stroke="#241650"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M130 104c4-6 12-6 16 0"
        stroke="#241650"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* smile + cheeks */}
      <path
        d="M112 122c4 5 12 5 16 0"
        stroke="#241650"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <ellipse cx="84" cy="118" rx="8" ry="5" fill="#C4B5FD" opacity="0.7" />
      <ellipse cx="156" cy="118" rx="8" ry="5" fill="#C4B5FD" opacity="0.7" />

      {/* little arms */}
      <path
        d="M66 138c-8 6-10 14-6 20"
        stroke="#8B5CF6"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M174 138c8 6 10 14 6 20"
        stroke="#7C5CFF"
        strokeWidth="10"
        strokeLinecap="round"
      />

      {/* highlight */}
      <ellipse
        cx="100"
        cy="70"
        rx="12"
        ry="8"
        fill="#FFFFFF"
        opacity="0.28"
        transform="rotate(-18 100 70)"
      />
    </svg>
  );
}

/** Flat deck glyph: three stacked cards in one accent colour. */
export function DeckGlyph({
  className,
  color = "#7C5CFF",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect
        x="6"
        y="18"
        width="26"
        height="18"
        rx="4"
        fill={color}
        opacity="0.28"
        transform="rotate(-10 6 18)"
      />
      <rect
        x="12"
        y="13"
        width="28"
        height="19"
        rx="4"
        fill={color}
        opacity="0.55"
        transform="rotate(-4 12 13)"
      />
      <rect x="14" y="16" width="28" height="19" rx="5" fill={color} />
      <path
        d="M21 21h14M21 26h9"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}
