import { cn } from "@/lib/utils";

/**
 * Bluprint's study buddy, "Blu": a calm, rounded character drawn in SVG so it
 * stays crisp at any size and needs no image assets. Built from a handful of
 * clean shapes (blob, big friendly eyes, tiny arms) rather than a detailed
 * creature, which reads better at 90px in a chat as well as 200px on a card.
 * Purely decorative.
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
      aria-label="Blu, Bluprint's study buddy"
    >
      <defs>
        <linearGradient id="blu-body" x1="56" y1="36" x2="186" y2="206">
          <stop offset="0" stopColor="#A78BFA" />
          <stop offset="0.5" stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#5B3DF5" />
        </linearGradient>
        <linearGradient id="blu-foot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5B3DF5" />
          <stop offset="1" stopColor="#4526C9" />
        </linearGradient>
        <linearGradient id="blu-bookmark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD37A" />
          <stop offset="1" stopColor="#F5A524" />
        </linearGradient>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="120" cy="214" rx="52" ry="9" fill="#16181F" opacity="0.08" />

      {/* bookmark tuft: a quiet nod to a page marker */}
      <path
        d="M152 30h26a8 8 0 0 1 8 8v46l-21-14-21 14V38a8 8 0 0 1 8-8Z"
        fill="url(#blu-bookmark)"
        transform="rotate(12 168 58)"
      />

      {/* little feet, tucked under the body */}
      <ellipse cx="98" cy="208" rx="17" ry="10" fill="url(#blu-foot)" />
      <ellipse cx="142" cy="208" rx="17" ry="10" fill="url(#blu-foot)" />

      {/* body: a tall rounded blob, wider at the base */}
      <path
        d="M120 32c40 0 68 26 68 66v50c0 38-30 62-68 62s-68-24-68-62V98c0-40 28-66 68-66Z"
        fill="url(#blu-body)"
      />

      {/* soft sheen across the top-left of the body */}
      <path
        d="M120 32c-40 0-68 26-68 66 0-4 6-46 50-52 12-2 18-8 18-14Z"
        fill="#FFFFFF"
        opacity="0.18"
      />

      {/* arms */}
      <path
        d="M54 138c-9 7-12 17-8 27"
        stroke="#6B4BFF"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M186 138c9 7 12 17 8 27"
        stroke="#6B4BFF"
        strokeWidth="13"
        strokeLinecap="round"
      />

      {/* eyes: big, bright and readable at small sizes */}
      <ellipse cx="98" cy="106" rx="19" ry="21" fill="#FFFFFF" />
      <ellipse cx="142" cy="106" rx="19" ry="21" fill="#FFFFFF" />
      <circle cx="101" cy="110" r="9.5" fill="#1B1440" />
      <circle cx="145" cy="110" r="9.5" fill="#1B1440" />
      <circle cx="105" cy="104" r="3.4" fill="#FFFFFF" />
      <circle cx="149" cy="104" r="3.4" fill="#FFFFFF" />

      {/* cheeks and smile */}
      <ellipse cx="70" cy="138" rx="11" ry="6.5" fill="#FFA9C4" opacity="0.6" />
      <ellipse cx="170" cy="138" rx="11" ry="6.5" fill="#FFA9C4" opacity="0.6" />
      <path
        d="M105 144c9 10 21 10 30 0"
        stroke="#1B1440"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* sparkle: the little "got it" moment */}
      <path
        d="M196 84l4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z"
        fill="#FFE6A3"
      />
      <circle cx="188" cy="120" r="3.5" fill="#FFE6A3" opacity="0.8" />
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
