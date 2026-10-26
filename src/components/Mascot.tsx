import { cn } from "@/lib/utils";

/**
 * Bluprint's study buddy, "Blu": a brushed-steel blob with a graphite outline,
 * drawn in SVG so it stays crisp at any size and needs no image assets. The
 * cool highlights and hard edge are what make it read as machined metal at
 * 90px in a chat as well as 200px on a card. Purely decorative.
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
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#DCE6EF" />
          <stop offset="1" stopColor="#9FB0C1" />
        </linearGradient>
        <linearGradient id="blu-foot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#39434F" />
          <stop offset="1" stopColor="#0A0F15" />
        </linearGradient>
        <linearGradient id="blu-bookmark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#DCEBFF" />
          <stop offset="1" stopColor="#4B8FE0" />
        </linearGradient>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="120" cy="214" rx="52" ry="9" fill="#0A0F15" opacity="0.14" />

      {/* bookmark tuft: a quiet nod to a page marker */}
      <path
        d="M152 30h26a8 8 0 0 1 8 8v46l-21-14-21 14V38a8 8 0 0 1 8-8Z"
        fill="url(#blu-bookmark)"
        transform="rotate(12 168 58)"
      />

      {/* little feet, tucked under the body */}
      <ellipse cx="98" cy="208" rx="17" ry="10" fill="url(#blu-foot)" />
      <ellipse cx="142" cy="208" rx="17" ry="10" fill="url(#blu-foot)" />

      {/* body: a tall rounded blob, wider at the base, with the ink outline
          that makes it read as a sticker rather than a soft 3D character */}
      <path
        d="M120 32c40 0 68 26 68 66v50c0 38-30 62-68 62s-68-24-68-62V98c0-40 28-66 68-66Z"
        fill="url(#blu-body)"
        stroke="#0A0F15"
        strokeWidth="3.5"
      />

      {/* soft sheen across the top-left of the body */}
      <path
        d="M120 32c-40 0-68 26-68 66 0-4 6-46 50-52 12-2 18-8 18-14Z"
        fill="#FFFFFF"
        opacity="0.35"
      />

      {/* arms */}
      <path
        d="M54 138c-9 7-12 17-8 27"
        stroke="#8496A8"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M186 138c9 7 12 17 8 27"
        stroke="#8496A8"
        strokeWidth="13"
        strokeLinecap="round"
      />

      {/* eyes: big, bright and readable at small sizes */}
      <ellipse cx="98" cy="106" rx="19" ry="21" fill="#FFFFFF" stroke="#0A0F15" strokeWidth="2.5" />
      <ellipse cx="142" cy="106" rx="19" ry="21" fill="#FFFFFF" stroke="#0A0F15" strokeWidth="2.5" />
      <circle cx="101" cy="110" r="9.5" fill="#0A0F15" />
      <circle cx="145" cy="110" r="9.5" fill="#0A0F15" />
      <circle cx="105" cy="104" r="3.4" fill="#FFFFFF" />
      <circle cx="149" cy="104" r="3.4" fill="#FFFFFF" />

      {/* cheeks and smile */}
      <ellipse cx="70" cy="138" rx="11" ry="6.5" fill="#FFB0A0" opacity="0.8" />
      <ellipse cx="170" cy="138" rx="11" ry="6.5" fill="#FFB0A0" opacity="0.8" />
      <path
        d="M105 144c9 10 21 10 30 0"
        stroke="#0A0F15"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* sparkle: the little "got it" moment */}
      <path
        d="M196 84l4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z"
        fill="#BFE3FF"
        stroke="#0A0F15"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="188" cy="120" r="3.5" fill="#0A0F15" opacity="0.35" />
    </svg>
  );
}

/** Flat deck glyph: three stacked cards in one accent colour. */
export function DeckGlyph({
  className,
  color = "#0A0F15",
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
