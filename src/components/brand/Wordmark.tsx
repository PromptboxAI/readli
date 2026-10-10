import Image from "next/image";
import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-full" aria-label="Readli home">
      {/* Simplified Readi face icon (final artwork, 2026-10-10). */}
      <Image src="/brand/readi-icon.webp" alt="" width={44} height={30} priority />
      <span className="font-display text-2xl font-semibold tracking-tight text-ink">Readli</span>
    </Link>
  );
}
