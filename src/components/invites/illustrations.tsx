/** Small original spot illustrations for invites, gifts and rewards. Decorative; on-palette inline SVG. */

const INK = "#283548";

export function EnvelopeArt({ className = "w-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" className={className} aria-hidden="true">
      <ellipse cx="60" cy="88" rx="44" ry="6" fill={INK} opacity="0.08" />
      <rect x="12" y="24" width="96" height="60" rx="12" fill="#fffef9" stroke={INK} strokeWidth="4" />
      <path d="M14 30 L60 60 L106 30" fill="none" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M60 46 c-6 -8 -18 -2 -12 8 l12 10 l12 -10 c6 -10 -6 -16 -12 -8z" fill="#ff7967" />
      <circle cx="98" cy="18" r="10" fill="#ffce58" />
      <path d="M98 12 v12 M92 18 h12" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function GiftBoxArt({ className = "w-28", open = false }: { className?: string; open?: boolean }) {
  return (
    <svg viewBox="0 0 120 110" className={className} aria-hidden="true">
      <ellipse cx="60" cy="102" rx="44" ry="6" fill={INK} opacity="0.08" />
      {open && (
        <g fill="#ffce58">
          <circle cx="30" cy="14" r="4" />
          <circle cx="92" cy="10" r="3" />
          <path d="M60 2 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" />
        </g>
      )}
      <rect x="18" y="50" width="84" height="50" rx="10" fill="#9ce2bc" stroke={INK} strokeWidth="4" />
      <g transform={open ? "rotate(-14 20 40)" : undefined}>
        <rect x="12" y="34" width="96" height="20" rx="8" fill="#7bc7f3" stroke={INK} strokeWidth="4" />
        <path d="M60 34 c-14 -22 -34 -10 -20 0 M60 34 c14 -22 34 -10 20 0" fill="none" stroke="#c9402f" strokeWidth="5" strokeLinecap="round" />
      </g>
      <rect x="53" y="50" width="14" height="50" fill="#ff7967" />
      {!open && <rect x="53" y="34" width="14" height="20" fill="#ff7967" />}
    </svg>
  );
}

/** Two keys = two yeses: the voice owner's and a parent's, for each child. */
export function TwoYesesArt({ className = "w-full max-w-xs" }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 90" className={className} aria-hidden="true">
      <rect x="4" y="14" width="96" height="62" rx="20" fill="#cbb7f5" />
      <rect x="160" y="14" width="96" height="62" rx="20" fill="#9ce2bc" />
      <circle cx="130" cy="45" r="20" fill="#ffce58" stroke={INK} strokeWidth="4" />
      <path d="M121 45 l6 6 12 -12" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M100 45 h10 M150 45 h10" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="34" cy="45" r="13" fill="#fffef9" stroke={INK} strokeWidth="3" />
      <path d="M28 45 q6 8 12 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <rect x="54" y="36" width="34" height="6" rx="3" fill={INK} opacity="0.5" />
      <rect x="54" y="48" width="24" height="6" rx="3" fill={INK} opacity="0.3" />
      <circle cx="190" cy="45" r="13" fill="#fffef9" stroke={INK} strokeWidth="3" />
      <path d="M184 45 q6 8 12 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <rect x="210" y="36" width="34" height="6" rx="3" fill={INK} opacity="0.5" />
      <rect x="210" y="48" width="24" height="6" rx="3" fill={INK} opacity="0.3" />
    </svg>
  );
}

export function StarSticker({ done, className = "size-12" }: { done: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill={done ? "#ffce58" : "#fffef9"} stroke={INK} strokeWidth="3" strokeDasharray={done ? undefined : "5 5"} />
      {done ? (
        <path d="M24 11 l4 8.5 9.3 1.2 -6.8 6.4 1.7 9.2 -8.2 -4.5 -8.2 4.5 1.7 -9.2 -6.8 -6.4 9.3 -1.2z" fill="#ff7967" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      ) : (
        <path d="M24 15 l3 6.5 7 .9 -5.1 4.8 1.3 6.9 -6.2 -3.4 -6.2 3.4 1.3 -6.9 -5.1 -4.8 7 -.9z" fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" opacity="0.35" />
      )}
    </svg>
  );
}
