import type { Metadata } from "next";
import { FeedbackForm } from "@/components/email/FeedbackForm";
import { AdultPage } from "@/components/invites/AdultPage";
import { fromFeedbackToken, W2_REASONS } from "@/lib/email/feedback";
import { emailSecret } from "@/lib/email/send";

export const metadata: Metadata = { title: "Feedback | Readli", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/** Where "How are bedtimes going?" and "Did Readli fit your family's evenings?" link. No sign-in needed. */
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : "";
  const secret = emailSecret();
  const who = secret ? fromFeedbackToken(secret, token) : null;
  return (
    <AdultPage>
      <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
        <h1 className="font-display text-3xl font-semibold">{who?.ask === "W2" ? "Did Readli fit your family's evenings?" : "How are bedtimes going?"}</h1>
        {who ? (
          <FeedbackForm token={token} ask={who.ask} reasons={W2_REASONS.map((r) => ({ id: r.id, label: r.label }))} />
        ) : (
          <p className="text-lg">This feedback link doesn&apos;t work. Use the link in your latest Readli email.</p>
        )}
      </section>
    </AdultPage>
  );
}
