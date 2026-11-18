import type { Metadata } from "next";
import Link from "next/link";
import { EmailPreferencesForm } from "@/components/email/EmailPreferencesForm";
import { AdultPage } from "@/components/invites/AdultPage";
import { preferencesFor, userFromPreferencesToken } from "@/lib/email/preferences";
import { emailSecret } from "@/lib/email/send";
import { accountDb } from "@/lib/family/account-store";

export const metadata: Metadata = { title: "Email settings | Readli", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/** Where every Readli email's footer points: change email settings without signing in. */
export default async function EmailPreferencesPage({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : "";
  const secret = emailSecret();
  const db = accountDb();
  const userId = secret ? userFromPreferencesToken(secret, token) : null;
  if (!userId || !db) {
    return (
      <AdultPage>
        <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
          <h1 className="font-display text-3xl font-semibold">Email settings</h1>
          <p className="text-lg">This link doesn&apos;t work. Use the link in your latest Readli email, or sign in and open Settings.</p>
          <Link href="/login?next=/family/settings/account" className="self-start font-semibold underline underline-offset-4">
            Sign in
          </Link>
        </section>
      </AdultPage>
    );
  }
  const prefs = await preferencesFor(db, userId);
  return (
    <AdultPage>
      <h1 className="font-display text-4xl font-semibold">Email settings</h1>
      <EmailPreferencesForm initial={prefs} token={token} />
    </AdultPage>
  );
}
