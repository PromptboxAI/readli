/**
 * Placeholder for "Readi, the R-book buddy" (Design Brief §3, concept A).
 * An open book whose left page curls into a lowercase r. Final art is still
 * to be designed; this keeps proportions and placement honest meanwhile.
 */
export function ReadiMascot({ size = 120, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Readi, the Readli book buddy"
      className={className}
    >
      <ellipse cx="60" cy="108" rx="34" ry="6" fill="#283548" opacity="0.12" />
      {/* Left page, curling into an r */}
      <path
        d="M58 30 C44 22 26 22 16 28 L16 92 C28 86 44 86 58 94 Z"
        fill="#FFFEF9"
        stroke="#283548"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Right page */}
      <path
        d="M62 30 C76 22 94 22 104 28 L104 92 C92 86 76 86 62 94 Z"
        fill="#FF7967"
        stroke="#283548"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* r stem and shoulder in the fold */}
      <path d="M36 50 L36 76 M36 58 C40 50 48 48 52 52" stroke="#283548" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Face on the right page */}
      <circle cx="76" cy="54" r="4.5" fill="#283548" />
      <circle cx="92" cy="54" r="4.5" fill="#283548" />
      <path d="M77 66 C81 72 88 72 91 66" stroke="#283548" strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* Listening page corners */}
      <path d="M104 28 L112 22 L108 36 Z" fill="#FFCE58" stroke="#283548" strokeWidth="3" strokeLinejoin="round" />
      <path d="M16 28 L8 22 L12 36 Z" fill="#FFCE58" stroke="#283548" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
