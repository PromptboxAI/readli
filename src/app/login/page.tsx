import type { Metadata } from "next";
import Link from "next/link";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";

export const metadata: Metadata = { title: "Log in | Readli" };

/** Placeholder until family accounts arrive (plan Phase 4: email and Continue with Google). */
export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6">
        <ReadiMascot size={160} decorative />
        <h1 className="font-display text-4xl font-semibold">Family accounts are coming soon</h1>
        <p className="text-lg">
          Soon you&apos;ll be able to log in with email or Google, invite your family and keep your voice. For now, try
          your voice for free with no signup.
        </p>
        <Link href="/try" className={buttonPrimary}>
          Try your voice
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
