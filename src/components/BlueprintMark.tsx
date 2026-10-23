import { cn } from "@/lib/utils";

/**
 * Bluprint's mark: a wireframe isometric block on a drafting grid. It is
 * deliberately geometric — no mascot, no rounded character shapes.
 */
export function BlueprintMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path
        d="M32 5.5 55.5 19v26L32 58.5 8.5 45V19L32 5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M32 5.5v26m0 0L55.5 19M32 31.5 8.5 19M32 31.5v27"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <path
        d="M20 12.5 43.5 26v13.5L20 26V12.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <circle cx="32" cy="31.5" r="2.4" fill="currentColor" />
      <circle cx="55.5" cy="19" r="1.8" fill="#facc15" />
      <path
        d="M8.5 45 20 51.5M32 58.5v-9"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.35"
      />
    </svg>
  );
}

/** Larger drafting schematic for hero and empty states. */
export function BlueprintGlyph({
  size = 240,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <g stroke="#22d3ee" strokeWidth="0.8" opacity="0.22">
        {Array.from({ length: 9 }).map((_, index) => (
          <path key={`v-${index}`} d={`M${30 + index * 23} 18v204`} />
        ))}
        {Array.from({ length: 9 }).map((_, index) => (
          <path key={`h-${index}`} d={`M18 ${30 + index * 23}h204`} />
        ))}
      </g>

      <g stroke="#22d3ee" strokeWidth="1.1" opacity="0.3">
        <circle cx="120" cy="120" r="72" strokeDasharray="3 7" />
        <circle cx="120" cy="120" r="92" strokeDasharray="1 10" />
      </g>

      <g stroke="#e6edf3" strokeWidth="1.3" strokeLinejoin="round">
        <path d="M120 55 181 90v70l-61 35-61-35V90l61-35Z" opacity="0.65" />
        <path d="M120 55v70m0 0 61-35m-61 35-61-35m61 35v70" opacity="0.4" />
        <path d="M89 72 150 107v40l-61-35V72Z" opacity="0.2" />
      </g>

      <g fill="#22d3ee">
        <circle cx="120" cy="55" r="2.6" />
        <circle cx="181" cy="90" r="2.6" />
        <circle cx="181" cy="160" r="2.6" />
        <circle cx="120" cy="195" r="2.6" />
        <circle cx="59" cy="160" r="2.6" />
        <circle cx="59" cy="90" r="2.6" />
      </g>
      <circle cx="120" cy="125" r="3.4" fill="#facc15" />

      <g stroke="#22d3ee" strokeWidth="1" opacity="0.55">
        <path d="M32 44h24M44 32v24M184 196h24M196 184v24" />
      </g>

      <g fill="#8b9aa8" fontFamily="JetBrains Mono, monospace" fontSize="7">
        <text x="27" y="76">A1</text>
        <text x="196" y="76">B1</text>
        <text x="196" y="228">B4</text>
        <text x="27" y="228">A4</text>
      </g>
    </svg>
  );
}
