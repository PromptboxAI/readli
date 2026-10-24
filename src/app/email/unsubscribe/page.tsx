import type { Metadata } from "next";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage } from "@/components/invites/AdultPage";

export const metadata: Metadata = { title: "Unsubscribe | Readli", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/** Unsubscribe from Bedtime Thursdays and news without an account. A button, so link scanners can't unsubscribe anyone. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ c?: string | string[]; done?: string | string[] }> }) {
  const { c, done } = await searchParams;
  const token = typeof c === "string" ? c : "";
  return (
    <AdultPage>
      <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
        <h1 className="font-display text-3xl font-semibold">Unsubscribe</h1>
        {done ? (
          <p className="text-lg">You&apos;re unsubscribed. Readli won&apos;t send you Bedtime Thursdays or news again.</p>
        ) : token ? (
          <form method="post" action={`/api/email/unsubscribe?c=${encodeURIComponent(token)}&from=page`} className="flex flex-col gap-4">
            <p className="text-lg">Stop getting Bedtime Thursdays and Readli news at this address?</p>
            <button type="submit" className={`${buttonPrimary} self-start`}>
              Unsubscribe
            </button>
          </form>
        ) : (
          <p className="text-lg">This link doesn&apos;t work. Use the link in your latest Readli email.</p>
        )}
      </section>
    </AdultPage>
  );
}
