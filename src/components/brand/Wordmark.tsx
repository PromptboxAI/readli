import Link from "next/link";
import { ReadiMascot } from "./ReadiMascot";

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-full" aria-label="Readli home">
      <ReadiMascot size={36} />
      <span className="font-display text-2xl font-semibold tracking-tight text-ink">Readli</span>
    </Link>
  );
}
