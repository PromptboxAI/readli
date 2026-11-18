import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage } from "@/components/invites/AdultPage";
import { DEMO_BOOKS } from "@/lib/content/demo-books";
import { guestForDemoToken } from "@/lib/email/guest-demo";
import { accountDb } from "@/lib/family/account-store";
import { guestDemoDeps } from "@/lib/server/guest-demo";
import { previewKey } from "@/lib/server/guest-preview";

export const metadata: Metadata = { title: "Your Readli demo", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/** Where an emailed demo link opens: the stories this guest heard, until their demo is deleted. */
export default async function EmailedDemoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const deps = guestDemoDeps();
  const db = accountDb();
  const guestId = deps && db ? await guestForDemoToken(db, token).catch(() => null) : null;
  const voiceId = guestId && deps ? await deps.store.getVoice(guestId).catch(() => null) : null;
  const heard = [];
  if (guestId && voiceId && deps) {
    for (const book of DEMO_BOOKS) {
      if (book.passageText && (await deps.store.findPreview(guestId, previewKey(voiceId, book.slug)).catch(() => null))) heard.push(book);
    }
  }
  return (
    <AdultPage>
      <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
        <h1 className="font-display text-3xl font-semibold">Your Readli demo</h1>
        {heard.length === 0 ? (
          <p className="text-lg">This demo has ended. Demos and their recordings are deleted within a day.</p>
        ) : (
          <>
            <p className="text-lg">Stories read in your voice. This page stops working when your demo is deleted, within a day of recording.</p>
            <ul className="flex flex-col gap-4">
              {heard.map((book) => (
                <li key={book.slug} className="flex flex-col gap-2">
                  <p className="font-display text-xl font-semibold">{book.title}</p>
                  <audio controls preload="none" src={`/api/guest/demo-email/${encodeURIComponent(token)}/${book.slug}`} className="w-full" aria-label={`${book.title}, read in your voice`} />
                </li>
              ))}
            </ul>
          </>
        )}
        <Link href="/try" className={`${buttonPrimary} self-start`}>
          {heard.length ? "Record again on Readli" : "Try Readli again"}
        </Link>
      </section>
    </AdultPage>
  );
}
