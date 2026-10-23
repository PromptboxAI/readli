import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { defaultClaimBy, earlierCodes, listBatches } from "@/lib/admin/complimentary";
import { COMPLIMENTARY_KIND_LABELS } from "@/lib/admin/complimentary-kinds";
import { accountDb } from "@/lib/family/account-store";
import { IssueForm } from "./IssueForm";

export const metadata: Metadata = { title: "Complimentary memberships | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Free Readli Family memberships for raffles, auctions, gift baskets, schools, charities and giveaways. */
export default async function ComplimentaryPage() {
  const gate = await requireAdmin("/admin/complimentary");
  const db = gate.preview ? null : accountDb();
  const batches = db ? await listBatches(db) : [];
  const earlier = db ? await earlierCodes(db) : null;
  const earlierTotal = earlier ? Object.values(earlier).reduce((a, b) => a + b, 0) : 0;
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>
          <Link href="/admin" className="underline underline-offset-4">
            Admin
          </Link>
        </Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Complimentary memberships</h1>
        <p className="text-lg">
          Donate Readli Family to raffles, auctions, gift baskets and giveaways. Each membership gets its own one-time link, QR code and printable certificate. Families
          claim it with no card, and nothing renews.
        </p>
      </header>
      {gate.preview && <PreviewNote>Issuing memberships needs sign-in and Supabase connected. This shows the form only.</PreviewNote>}
      <IssueForm defaultClaimBy={defaultClaimBy()} />

      {batches.length > 0 && (
        <section aria-labelledby="batches-h" className="flex flex-col gap-3">
          <h2 id="batches-h" className="font-display text-2xl font-semibold">
            Issued batches
          </h2>
          <ul className="flex flex-col gap-2">
            {batches.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/complimentary/${b.id}`} className="flex flex-col gap-1 rounded-2xl bg-surface p-4 ring-2 ring-ink/10 hover:ring-ink/40 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-display text-lg font-semibold">{b.label ?? b.eventName ?? b.sponsorName}</span>
                  <span className="text-sm text-muted">
                    {COMPLIMENTARY_KIND_LABELS[b.occasion]} · {b.months} months · {shortDate(b.createdAt)} · {b.counts.unclaimed} unclaimed, {b.counts.claimed} claimed
                    {b.counts.revoked ? `, ${b.counts.revoked} revoked` : ""}
                    {b.counts.expired ? `, ${b.counts.expired} expired` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {earlier && earlierTotal > 0 && (
        <p className="rounded-2xl bg-ink/5 p-4 text-sm">
          Earlier codes: {earlier.unclaimed} unclaimed, {earlier.claimed} claimed, {earlier.expired} expired. They were issued before downloads existed, so Readli kept only a
          scrambled copy and can&apos;t show or print them again. They still work for whoever has the link.
        </p>
      )}
    </AdultPage>
  );
}
