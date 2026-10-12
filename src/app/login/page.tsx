import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { authConfigured, currentUser, safeNext } from "@/lib/auth/supabase";

export const metadata: Metadata = { title: "Log in | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const live = authConfigured();
  if (live && (await currentUser())) redirect(next);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-16 text-center sm:px-6">
        <ReadiMascot size={130} decorative />
        <h1 className="font-display text-4xl font-semibold">Log in to Readli</h1>
        {live ? (
          <>
            <p className="text-lg">New here? Signing in creates your account.</p>
            {params.error === "link" && (
              <p role="alert" className="w-full rounded-2xl bg-coral/30 p-3 font-semibold">
                That sign-in link didn&apos;t work or has expired. Please try again.
              </p>
            )}
            <LoginForm next={next} />
          </>
        ) : (
          <>
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
