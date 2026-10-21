/**
 * Hero artwork: a parent and child sitting up in bed, heads together, listening to a story
 * (homepage hero direction B, Kevin 2026-10-12). Inline SVG so it stays crisp and on-palette.
 * The family sits on the left so the player preview can overlap the window on desktop.
 */

const INK = "#283548";
const SPARK = "M0 -10 C1 -3 3 -1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3 -1 -1 -3 0 -10Z";

function Spark({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return <path d={SPARK} transform={`translate(${x} ${y}) scale(${s})`} fill={fill} />;
}

export function HeroBedtimeScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 440" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="hero-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34445f" />
          <stop offset="1" stopColor={INK} />
        </linearGradient>
        <radialGradient id="hero-lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffce58" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffce58" stopOpacity="0" />
        </radialGradient>
        <pattern id="hero-quilt" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#7bc7f3" />
          <rect width="20" height="20" fill="#8fd0f5" />
          <rect x="20" y="20" width="20" height="20" fill="#8fd0f5" />
        </pattern>
      </defs>
      <rect width="400" height="440" fill="url(#hero-wall)" />
      <circle cx="40" cy="120" r="170" fill="url(#hero-lamp)" />

      {/* Night window */}
      <path d="M268 210 V110 A50 50 0 0 1 368 110 V210 Z" fill="#1f2a3e" />
      <circle cx="338" cy="100" r="13" fill="#ffe08f" />
      <circle cx="345" cy="95" r="11" fill="#1f2a3e" />
      <Spark x={287} y={97} s={0.5} fill="#ffe7a8" />
      <Spark x={303} y={163} s={0.35} fill="#ffe7a8" />
      <Spark x={350} y={182} s={0.4} fill="#ffe7a8" />
      <path d="M268 210 V110 A50 50 0 0 1 368 110 V210 Z M318 60 V210 M268 152 H368" fill="none" stroke="#e8b479" strokeWidth="6" />

      <g transform="translate(-34 0)">
        {/* Headboard and pillows */}
        <path d="M14 330 V196 C14 160 50 146 160 146 C270 146 306 160 306 196 V330 Z" fill="#e8b479" />
        <path d="M30 320 V202 C30 176 60 164 160 164 C260 164 290 176 290 202" fill="none" stroke="#d29d61" strokeWidth="3" />
        <rect x="44" y="218" width="120" height="70" rx="30" fill="#fffef9" />
        <rect x="150" y="210" width="128" height="76" rx="32" fill="#f6efe2" />

        {/* Parent: matches the child's colouring, head resting toward her */}
        <path d="M168 360 C164 302 186 274 220 272 C254 274 276 302 272 360 Z" fill="#ff7967" />
        <path d="M206 274 Q220 288 234 274" fill="none" stroke="#ef6a55" strokeWidth="3" />
        <g transform="rotate(-10 220 262)">
          <rect x="211" y="250" width="18" height="26" rx="8" fill="#ecc09a" />
          <circle cx="220" cy="196" r="15" fill="#7a4a2a" />
          <circle cx="220" cy="234" r="31" fill="#f6cfa8" />
          <path d="M189 232 A31 31 0 0 1 251 232 Q238 212 220 214 Q202 212 189 232 Z" fill="#7a4a2a" />
          <path d="M205 238 q5 4 10 0 M225 238 q5 4 10 0" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="202" cy="249" r="4.5" fill="#ff9b8c" opacity="0.7" />
          <circle cx="238" cy="249" r="4.5" fill="#ff9b8c" opacity="0.7" />
          <path d="M214 252 Q220 257 226 252" stroke={INK} strokeWidth="2.3" fill="none" strokeLinecap="round" />
        </g>

        {/* Child */}
        <path d="M70 360 C66 306 82 280 110 278 C138 280 152 306 150 360 Z" fill="#cbb7f5" />
        <g fill="#fffef9" opacity="0.7">
          <circle cx="92" cy="304" r="2" />
          <circle cx="124" cy="296" r="2" />
          <circle cx="108" cy="322" r="2" />
          <circle cx="134" cy="318" r="2" />
        </g>
        <g transform="rotate(12 112 248)">
          <circle cx="112" cy="214" r="13" fill="#7a4a2a" />
          <path d="M103 213 l-11 -6 l2 13 Z M121 213 l11 -6 l-2 13 Z" fill="#ff7967" />
          <circle cx="112" cy="213" r="4" fill="#c9402f" />
          <circle cx="112" cy="248" r="28" fill="#f6cfa8" />
          <path d="M84 246 A28 28 0 0 1 140 246 Q128 228 112 230 Q96 228 84 246 Z" fill="#7a4a2a" />
          <path d="M100 251 q4 3 8 0 M118 251 q4 3 8 0" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="96" cy="261" r="4" fill="#ff9b8c" opacity="0.7" />
          <circle cx="128" cy="261" r="4" fill="#ff9b8c" opacity="0.7" />
          <path d="M107 264 Q112 269 117 264" stroke={INK} strokeWidth="2.3" fill="none" strokeLinecap="round" />
        </g>

        {/* Quilt, with Readi tucked in the child's lap */}
        <path d="M0 336 Q180 318 440 334 V440 H0 Z" fill="url(#hero-quilt)" />
        <path d="M0 336 Q180 318 440 334" fill="none" stroke="#fffef9" strokeWidth="12" strokeLinecap="round" />
        <image href="/brand/readi-rest.webp" x="84" y="296" width="54" height="45" />
      </g>

      {/* The story arriving */}
      <g stroke="#ffce58" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.9">
        <path d="M286 236 q-10 12 0 24" />
        <path d="M300 226 q-18 22 0 44" />
      </g>
      <Spark x={276} y={276} s={0.6} fill="#ffce58" />
    </svg>
  );
}
