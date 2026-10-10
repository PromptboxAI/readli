/**
 * Original flat illustrations for "Every family has a story" (Design Revision 001 §1).
 * Inline SVG so they stay crisp, light and on-palette; swap for illustrator artwork later.
 */

const INK = "#283548";
const SKIN = ["#f6cfa8", "#d9a47a", "#a8714f", "#f1bd93"] as const;

type HairStyle = "short" | "long" | "bun" | "bald" | "curly";

function Face({
  cx,
  cy,
  r,
  skin,
  hair,
  style,
  glasses = false,
  eyesClosed = false,
}: {
  cx: number;
  cy: number;
  r: number;
  skin: string;
  hair: string;
  style: HairStyle;
  glasses?: boolean;
  eyesClosed?: boolean;
}) {
  const e = r * 0.36;
  const eyeY = cy - r * 0.05;
  return (
    <g>
      {style === "long" && <rect x={cx - r * 1.1} y={cy - r * 0.6} width={r * 2.2} height={r * 1.7} rx={r} fill={hair} />}
      {style === "bun" && <circle cx={cx} cy={cy - r * 1.05} r={r * 0.42} fill={hair} />}
      {style === "curly" &&
        [-0.75, -0.25, 0.25, 0.75].map((dx) => <circle key={dx} cx={cx + dx * r} cy={cy - r * 0.78} r={r * 0.42} fill={hair} />)}
      <circle cx={cx} cy={cy} r={r} fill={skin} />
      {style !== "bald" && style !== "curly" && (
        <path d={`M${cx - r} ${cy - r * 0.05} A${r} ${r} 0 0 1 ${cx + r} ${cy - r * 0.05} Q${cx} ${cy - r * 0.62} ${cx - r} ${cy - r * 0.05}Z`} fill={hair} />
      )}
      {style === "bald" && <path d={`M${cx - r * 0.98} ${cy} Q${cx - r * 1.05} ${cy - r * 0.45} ${cx - r * 0.7} ${cy - r * 0.55}`} stroke={hair} strokeWidth={r * 0.22} fill="none" strokeLinecap="round" />}
      {eyesClosed ? (
        <>
          <path d={`M${cx - e - r * 0.12} ${eyeY} q${r * 0.12} ${r * 0.1} ${r * 0.24} 0`} stroke={INK} strokeWidth={r * 0.08} fill="none" strokeLinecap="round" />
          <path d={`M${cx + e - r * 0.12} ${eyeY} q${r * 0.12} ${r * 0.1} ${r * 0.24} 0`} stroke={INK} strokeWidth={r * 0.08} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={cx - e} cy={eyeY} r={r * 0.1} fill={INK} />
          <circle cx={cx + e} cy={eyeY} r={r * 0.1} fill={INK} />
        </>
      )}
      {glasses && (
        <g stroke={INK} strokeWidth={r * 0.06} fill="none">
          <circle cx={cx - e} cy={eyeY} r={r * 0.24} />
          <circle cx={cx + e} cy={eyeY} r={r * 0.24} />
          <path d={`M${cx - e + r * 0.24} ${eyeY} H${cx + e - r * 0.24}`} />
        </g>
      )}
      <circle cx={cx - r * 0.55} cy={cy + r * 0.28} r={r * 0.14} fill="#ff9b8c" opacity="0.7" />
      <circle cx={cx + r * 0.55} cy={cy + r * 0.28} r={r * 0.14} fill="#ff9b8c" opacity="0.7" />
      <path d={`M${cx - r * 0.25} ${cy + r * 0.3} Q${cx} ${cy + r * 0.55} ${cx + r * 0.25} ${cy + r * 0.3}`} stroke={INK} strokeWidth={r * 0.09} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Heart({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 4 C0 -2 8 -3 8 3 C8 -3 16 -2 16 4 C16 10 8 14 8 16 C8 14 0 10 0 4Z"
      fill={fill}
    />
  );
}

/** Card 1: a child snuggled up, hearing Grandma read from a tablet. */
export function HearLovedOnes() {
  return (
    <svg viewBox="0 0 400 300" className="size-full" role="img" aria-label="A child in a cozy blanket smiling at Grandma reading on a tablet">
      <rect width="400" height="300" fill="#ffce58" />
      <circle cx="330" cy="60" r="90" fill="#ffe08f" />
      <circle cx="60" cy="270" r="70" fill="#ffd970" />
      {/* Child */}
      <rect x="40" y="200" width="200" height="120" rx="60" fill="#7bc7f3" />
      <path d="M60 230 q40 -14 80 0 t80 0" stroke="#fffef9" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.7" />
      <Face cx={130} cy={160} r={44} skin={SKIN[1]} hair="#3d2a22" style="curly" />
      <path d="M180 225 Q215 215 238 192" stroke={SKIN[1]} strokeWidth="18" fill="none" strokeLinecap="round" />
      {/* Tablet showing Grandma */}
      <g transform="rotate(-6 290 165)">
        <rect x="230" y="95" width="120" height="150" rx="18" fill={INK} />
        <rect x="240" y="105" width="100" height="130" rx="10" fill="#fffef9" />
        <rect x="240" y="105" width="100" height="78" rx="10" fill="#cbb7f5" />
        <Face cx={290} cy={150} r={28} skin={SKIN[0]} hair="#e8e4ea" style="bun" glasses />
        <rect x="252" y="194" width="58" height="9" rx="4.5" fill={INK} />
        <rect x="252" y="210" width="40" height="7" rx="3.5" fill="#5b6676" opacity="0.5" />
        <circle cx="322" cy="211" r="10" fill="#ff7967" />
        <path d="M319 206 L327 211 L319 216Z" fill="#fffef9" />
      </g>
      {/* Sound and love */}
      <g stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.6">
        <path d="M206 112 q-10 14 0 28" />
        <path d="M192 102 q-16 24 0 48" />
      </g>
      <g className="animate-bob" style={{ transformBox: "fill-box" }}>
        <Heart x={70} y={60} s={1.6} fill="#ff7967" />
        <Heart x={180} y={40} s={1.1} fill="#c9402f" />
      </g>
    </svg>
  );
}

const TREE_PEOPLE: { cx: number; cy: number; bg: string; skin: string; hair: string; style: HairStyle; glasses?: boolean; invite?: boolean }[] = [
  { cx: 130, cy: 66, bg: "#cbb7f5", skin: SKIN[0], hair: "#e8e4ea", style: "bun", glasses: true },
  { cx: 270, cy: 66, bg: "#7bc7f3", skin: SKIN[2], hair: "#cfc8c2", style: "bald", glasses: true },
  { cx: 70, cy: 160, bg: "#ffce58", skin: SKIN[3], hair: "#7a4a2a", style: "long" },
  { cx: 200, cy: 160, bg: "#ff7967", skin: SKIN[1], hair: "#2b1d18", style: "short" },
  { cx: 330, cy: 160, bg: "#fffef9", skin: SKIN[2], hair: "#2b1d18", style: "curly", invite: true },
  { cx: 145, cy: 246, bg: "#ffce58", skin: SKIN[1], hair: "#2b1d18", style: "curly" },
  { cx: 255, cy: 246, bg: "#cbb7f5", skin: SKIN[3], hair: "#b5651d", style: "long" },
];

/** Card 2: a connected family tree of selfie avatars, with one invite waiting. */
export function FamilyOfStorytellers() {
  return (
    <svg viewBox="0 0 400 300" className="size-full" role="img" aria-label="A family tree of smiling faces connected together, with one more relative invited to join">
      <rect width="400" height="300" fill="#9ce2bc" />
      <circle cx="40" cy="40" r="70" fill="#b4ead0" />
      <circle cx="380" cy="290" r="80" fill="#b4ead0" />
      <g stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.4">
        <path d="M130 66 H270 M200 66 V115 M70 115 H330 M70 115 V160 M200 115 V160 M330 115 V160" />
        <path d="M200 160 V205 H145 V246 M200 205 H255 V246" />
      </g>
      <Heart x={192} y={57} s={1} fill="#c9402f" />
      {TREE_PEOPLE.map((p) => (
        <g key={`${p.cx}-${p.cy}`}>
          <circle cx={p.cx} cy={p.cy} r="36" fill={p.bg} stroke={p.invite ? INK : "#fffef9"} strokeWidth="5" strokeDasharray={p.invite ? "8 7" : undefined} opacity={p.invite ? 0.9 : 1} />
          <g opacity={p.invite ? 0.55 : 1}>
            <Face cx={p.cx} cy={p.cy + 4} r={22} skin={p.skin} hair={p.hair} style={p.style} glasses={p.glasses} />
          </g>
          {p.invite ? (
            <g>
              <circle cx={p.cx + 26} cy={p.cy - 26} r="13" fill="#ffce58" stroke={INK} strokeWidth="3" />
              <path d={`M${p.cx + 26} ${p.cy - 33} V${p.cy - 19} M${p.cx + 19} ${p.cy - 26} H${p.cx + 33}`} stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <circle cx={p.cx + 26} cy={p.cy + 26} r="11" fill="#fffef9" stroke={INK} strokeWidth="3" />
              <path d={`M${p.cx + 21} ${p.cy + 26} l4 4 l7 -8`} stroke="#2f8f5b" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Card 3: an open book with the current sentence lit up and narrator portraits to choose from. */
export function MakeStorytimeYourOwn() {
  const narrators = [
    { cx: 140, skin: SKIN[3], hair: "#7a4a2a", style: "long" as const, bg: "#ffce58" },
    { cx: 200, skin: SKIN[2], hair: "#cfc8c2", style: "bald" as const, bg: "#cbb7f5", glasses: true, active: true },
    { cx: 260, skin: SKIN[1], hair: "#2b1d18", style: "short" as const, bg: "#ff7967" },
  ];
  return (
    <svg viewBox="0 0 400 300" className="size-full" role="img" aria-label="An open storybook with one sentence highlighted, and three family narrators to switch between">
      <rect width="400" height="300" fill="#7bc7f3" />
      <circle cx="350" cy="50" r="80" fill="#9dd5f6" />
      <circle cx="30" cy="250" r="60" fill="#9dd5f6" />
      {/* Book */}
      <path d="M50 52 Q125 38 200 58 Q275 38 350 52 V208 Q275 194 200 214 Q125 194 50 208Z" fill="#ff7967" />
      <path d="M58 46 Q128 32 196 52 V206 Q128 188 58 200Z" fill="#fffef9" />
      <path d="M204 52 Q272 32 342 46 V200 Q272 188 204 206Z" fill="#fffef9" />
      <g fill={INK} opacity="0.22">
        <rect x="76" y="70" width="98" height="8" rx="4" />
        <rect x="76" y="90" width="82" height="8" rx="4" />
        <rect x="76" y="150" width="96" height="8" rx="4" />
        <rect x="76" y="170" width="70" height="8" rx="4" />
        <rect x="222" y="66" width="100" height="8" rx="4" />
        <rect x="222" y="86" width="86" height="8" rx="4" />
        <rect x="222" y="106" width="96" height="8" rx="4" />
      </g>
      <rect x="70" y="111" width="112" height="24" rx="8" fill="#ffce58" />
      <rect x="78" y="119" width="94" height="8" rx="4" fill={INK} opacity="0.75" />
      {/* Little picture on the right page */}
      <rect x="222" y="128" width="100" height="56" rx="10" fill="#9ce2bc" />
      <circle cx="300" cy="146" r="10" fill="#ffce58" />
      <path d="M222 172 q24 -22 50 -6 q22 -14 50 0 V184 H222Z" fill="#6cc79a" />
      {/* Narrator picker */}
      <rect x="96" y="226" width="208" height="62" rx="31" fill="#fffef9" />
      {narrators.map((n) => (
        <g key={n.cx}>
          {n.active && <circle cx={n.cx} cy="257" r="29" fill="none" stroke="#c9402f" strokeWidth="5" />}
          <circle cx={n.cx} cy="257" r="23" fill={n.bg} />
          <Face cx={n.cx} cy={260} r={15} skin={n.skin} hair={n.hair} style={n.style} glasses={n.glasses} />
        </g>
      ))}
    </svg>
  );
}
