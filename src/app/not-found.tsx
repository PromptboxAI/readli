import Link from "next/link";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary } from "@/components/brand/buttons";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-5 px-4 text-center">
      <ReadiMascot size={120} />
      <h1 className="font-display text-3xl font-semibold">This page is still being written</h1>
      <p>We&apos;re building Readli one chapter at a time.</p>
      <Link href="/" className={buttonPrimary}>
        Back to the homepage
      </Link>
    </main>
  );
}
