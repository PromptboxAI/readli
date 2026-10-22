import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { authConfigured, safeNext } from "@/lib/auth/supabase";
import { currentAdult } from "@/lib/auth/adult";

export const metadata: Metadata = { title: "Log in | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const live = authConfigured();
  if (live && (await currentAdult())) redirect(next);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[468px] flex-col items-center gap-5 px-4 py-16 text-center sm:px-6">
        <ReadiMascot size={130} decorative />
        {live ? (
          <LoginPanel next={next} linkError={params.error === "link"} />
        ) : (
          <>
            <h1 className="font-display text-4xl font-semibold">Log in to Readli</h1>
            <p className="text-lg">Sign-in isn&apos;t switched on here. You can still try your voice for free with no signup.</p>
            <Link href="/try" className={buttonPrimary}>
              Try your voice
            </Link>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
