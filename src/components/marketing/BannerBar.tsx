import Link from "next/link";
import type { ReactNode } from "react";
import { messageParts, safeBannerLink, type BannerStyle } from "@/lib/marketing/site-banner";

/** Per-look colors. The gradients use the brand palette; text contrast stays at 4.5:1 or better everywhere. */
const LOOKS: Record<BannerStyle, { bar: string; accent: string; sparkles: [string, string] | null }> = {
  festive: { bar: "banner-festive", accent: "text-sunshine", sparkles: ["var(--color-sunshine)", "var(--color-coral)"] },
  evergreen: { bar: "banner-evergreen", accent: "text-sunshine", sparkles: ["var(--color-sunshine)", "var(--color-mint)"] },
  starry: { bar: "banner-starry", accent: "text-sky", sparkles: ["var(--color-ivory)", "var(--color-sky)"] },
  classic: { bar: "bg-navy", accent: "text-sunshine", sparkles: null },
};

function Star({ x, y, size, color, delay }: { x: number; y: number; size: number; color: string; delay: number }) {
  const r = size / 2;
  const w = size / 7;
  return (
    <path
      className="banner-twinkle"
      style={{ animationDelay: `${delay}s`, transformOrigin: `${x}px ${y}px` }}
      fill={color}
      d={`M${x} ${y - r}Q${x + w} ${y - w} ${x + r} ${y}Q${x + w} ${y + w} ${x} ${y + r}Q${x - w} ${y + w} ${x - r} ${y}Q${x - w} ${y - w} ${x} ${y - r}Z`}
    />
  );
}

/** A small cluster of four-point sparkles that twinkle in turn. Decorative only. */
function Sparkles({ colors, flip = false }: { colors: [string, string]; flip?: boolean }) {
  const [a, b] = colors;
  return (
    <svg viewBox="0 0 40 32" aria-hidden="true" className={`hidden h-9 w-11 shrink-0 sm:block ${flip ? "-scale-x-100" : ""}`} data-testid="banner-sparkles">
      <Star x={25} y={17} size={20} color={a} delay={0} />
      <Star x={9} y={7} size={9} color={b} delay={1.1} />
      <Star x={8} y={25} size={7} color={a} delay={2} />
    </svg>
  );
}

/**
 * The look of the announcement bar, shared by the live site (SiteBanner) and the admin preview.
 * Words wrapped in *asterisks* show in the look's accent color.
 */
export function BannerBar({ style, message, linkText, linkUrl, closeButton }: { style: BannerStyle; message: string; linkText: string; linkUrl: string; closeButton?: ReactNode }) {
  const look = LOOKS[style] ?? LOOKS.festive;
  const href = linkText ? safeBannerLink(linkUrl) : null;
  const linkClass = "whitespace-nowrap font-display font-semibold text-ivory underline decoration-2 underline-offset-4 hover:no-underline";
  return (
    <div className={`${look.bar} text-ivory`} data-banner-style={style}>
      <div className={`mx-auto flex max-w-6xl items-center gap-2 py-2 pl-4 sm:gap-3 sm:pl-6 ${closeButton ? "pr-1" : "pr-4 sm:pr-6"}`}>
        <div className="flex flex-1 items-center justify-center gap-2 sm:gap-3">
          {look.sparkles && <Sparkles colors={look.sparkles} />}
          <p className="text-center text-sm font-bold leading-snug sm:text-base">
            {messageParts(message).map((part, i) =>
              part.highlight ? (
                <strong key={i} className={`font-extrabold ${look.accent}`}>
                  {part.text}
                </strong>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
            {href && (
              <>
                {" "}
                {href.startsWith("https://") ? (
                  <a href={href} className={linkClass}>
                    {linkText}
                  </a>
                ) : (
                  <Link href={href} className={linkClass}>
                    {linkText}
                  </Link>
                )}
              </>
            )}
          </p>
          {look.sparkles && <Sparkles colors={[look.sparkles[1], look.sparkles[0]]} flip />}
        </div>
        {closeButton}
      </div>
    </div>
  );
}
