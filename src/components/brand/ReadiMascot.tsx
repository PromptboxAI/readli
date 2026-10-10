import Image from "next/image";

export type ReadiState = "rest" | "listening";

const ART: Record<ReadiState, { src: string; width: number; height: number; label: string }> = {
  rest: { src: "/brand/readi-rest.webp", width: 700, height: 589, label: "Readi, the Readli book buddy" },
  listening: { src: "/brand/readi-listening.webp", width: 700, height: 376, label: "Readi listening to a story" },
};

/**
 * Readi, the Book Buddy (final artwork, 2026-10-10).
 * "rest": eyes open, pages together, used whenever nothing is playing.
 * "listening": eyes closed, pages fanned, used while a story plays.
 */
export function ReadiMascot({
  size = 120,
  state = "rest",
  decorative = false,
  priority = false,
  className = "",
}: {
  /** Rendered width in CSS pixels. */
  size?: number;
  state?: ReadiState;
  decorative?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const art = ART[state];
  return (
    <Image
      src={art.src}
      alt={decorative ? "" : art.label}
      width={size}
      height={Math.round((size * art.height) / art.width)}
      priority={priority}
      className={className}
    />
  );
}
