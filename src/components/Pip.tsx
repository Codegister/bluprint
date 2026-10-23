import { cn } from "@/lib/utils";

type PipProps = {
  size?: number;
  className?: string;
  mood?: "happy" | "wink" | "sleepy";
  cap?: boolean;
};

/**
 * Pip, the Pipnote axolotl. Drawn as flat low-poly shapes so the mascot stays
 * crisp at every size and works on cream, ink and pastel backgrounds.
 */
export function Pip({ size = 120, className, mood = "happy", cap = false }: PipProps) {
  const ink = "#211d35";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Pip, the Pipnote axolotl"
    >
      <g stroke={ink} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        {/* Gills — three fronds each side, low-poly wedges */}
        <path d="M74 74 L42 48 L60 86 Z" fill="#ff7b9c" />
        <path d="M70 94 L30 86 L64 110 Z" fill="#f4507a" />
        <path d="M76 114 L46 138 L82 132 Z" fill="#ff7b9c" />
        <path d="M126 74 L158 48 L140 86 Z" fill="#ff7b9c" />
        <path d="M130 94 L170 86 L136 110 Z" fill="#f4507a" />
        <path d="M124 114 L154 138 L118 132 Z" fill="#ff7b9c" />

        {/* Head */}
        <path d="M64 98 L72 66 L88 54 L112 54 L128 66 L136 98 L128 140 L112 152 L88 152 L72 140 Z" fill="#ff9db4" />
        {/* Muzzle */}
        <path d="M78 114 L100 105 L122 114 L116 142 L100 150 L84 142 Z" fill="#ffd3dd" />

        {/* Cheeks */}
        <circle cx="76" cy="118" r="6.5" fill="#f4507a" opacity="0.35" stroke="none" />
        <circle cx="124" cy="118" r="6.5" fill="#f4507a" opacity="0.35" stroke="none" />

        {/* Eyes */}
        {mood === "sleepy" ? (
          <>
            <path d="M80 94 Q86 99 92 94" fill="none" strokeWidth="5" />
            <path d="M108 94 Q114 99 120 94" fill="none" strokeWidth="5" />
          </>
        ) : (
          <>
            <ellipse cx="86" cy="94" rx="7" ry="9.5" fill={ink} stroke="none" />
            <ellipse cx="114" cy="94" rx="7" ry="9.5" fill={ink} stroke="none" />
            <circle cx="88.5" cy="90.5" r="2.4" fill="#faf6ec" stroke="none" />
            <circle cx="116.5" cy="90.5" r="2.4" fill="#faf6ec" stroke="none" />
            {mood === "wink" && (
              <path d="M107 93 Q114 99 121 93" fill="none" strokeWidth="4.5" />
            )}
          </>
        )}

        {/* Smile + tiny tongue */}
        <path d="M94 124 Q100 131 106 124" fill="none" strokeWidth="3.6" />
        <path d="M98 127 Q100 132 102 127" fill="#f4507a" strokeWidth="2" />

        {/* Optional grad cap */}
        {cap && (
          <g>
            <path d="M64 52 L100 34 L136 52 L100 68 Z" fill={ink} />
            <path d="M136 52 L136 72" stroke={ink} strokeWidth="4" />
            <circle cx="136" cy="75" r="4" fill="#eff39c" />
          </g>
        )}
      </g>
    </svg>
  );
}
