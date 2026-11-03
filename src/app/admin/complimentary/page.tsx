import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { buttonSecondary } from "@/components/brand/buttons";
import { requireAdmin } from "@/lib/admin/access";
import { defaultClaimBy, earlierCodes, listBatches, listMemberships, withClaimers } from "@/lib/admin/complimentary";
import { COMPLIMENTARY_KIND_LABELS } from "@/lib/admin/complimentary-kinds";
import { accountDb } from "@/lib/family/account-store";
import { IssueForm } from "./IssueForm";
import { MembershipsTable } from "./MembershipsTable";
import { adminDate } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Complimentary memberships | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const shortDate = (iso: string) => adminDate(iso);
const RECENT = 10;

/** Free Readli Family memberships for raffles, auctions, gift baskets, schools, charities and giveaways. */
export default async function ComplimentaryPage() {
  const gate = await requireAdmin("/admin/complimentary");
  const db = gate.preview ? null : accountDb();
  const batches = db ? await listBatches(db) : [];
  const earlier = db ? await earlierCodes(db) : null;
  const earlierTotal = earlier ? Object.values(earlier).reduce((a, b) => a + b, 0) : 0;
  const memberships = db ? await listMemberships(db, new Date(), RECENT + 1) : [];
  const recent = db ? await withClaimers(db, memberships.slice(0, RECENT)) : [];
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
      {db && (
        <section aria-labelledby="who-h" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="who-h" className="font-display text-2xl font-semibold">
              Who has a complimentary membership
            </h2>
            <Link href="/admin/complimentary/memberships" className={buttonSecondary}>
              Search all memberships
            </Link>
          </div>
          {recent.length ? (
            <>
              <MembershipsTable rows={recent} />
              {memberships.length > RECENT && <p className="text-sm text-muted">Showing the {RECENT} most recent. Search all memberships to see the rest.</p>}
            </>
          ) : (
            <p className="text-muted">None issued yet.</p>
          )}
        </section>
      )}

      <section aria-labelledby="issue-h" className="flex flex-col gap-3">
        <h2 id="issue-h" className="font-display text-2xl font-semibold">
          Give a membership
        </h2>
        <IssueForm defaultClaimBy={defaultClaimBy()} />
      </section>

      {batches.length > 0 && (
        <section aria-labelledby="batches-h" className="flex flex-col gap-3">
          <div>
            <h2 id="batches-h" className="font-display text-2xl font-semibold">
              Certificates and QR codes
            </h2>
            <p className="text-sm text-muted">Each time you press Issue, the memberships are grouped here. Open one to print certificates, copy links, email or revoke.</p>
          </div>
          <ul className="flex flex-col gap-2">
            {batches.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/complimentary/${b.id}`} className="flex flex-col gap-1 rounded-2xl bg-surface p-4 ring-2 ring-ink/10 hover:ring-ink/40 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-display text-lg font-semibold">{b.label ?? b.eventName ?? `Presented by ${b.sponsorName}`}</span>
                  <span className="text-sm text-muted">
                    Issued {shortDate(b.createdAt)} · {b.counts.unclaimed + b.counts.claimed + b.counts.revoked + b.counts.expired}{" "}
                    {b.counts.unclaimed + b.counts.claimed + b.counts.revoked + b.counts.expired === 1 ? "membership" : "memberships"} · {COMPLIMENTARY_KIND_LABELS[b.occasion]} · {b.months} months ·{" "}
                    {b.counts.claimed} claimed, {b.counts.unclaimed} not yet
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
          {earlierTotal} older {earlierTotal === 1 ? "membership was" : "memberships were"} issued before certificates existed ({earlier.claimed} claimed, {earlier.unclaimed} not yet
          {earlier.expired ? `, ${earlier.expired} expired` : ""}). They&apos;re in the table above as &quot;Earlier code&quot;. Readli can&apos;t show those codes again, but they still
          work for whoever has them.
        </p>
      )}
    </AdultPage>
  );
}
