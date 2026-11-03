import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { buttonSecondary } from "@/components/brand/buttons";
import { requireAdmin } from "@/lib/admin/access";
import { filterMemberships, listMemberships, type IssuedStatus } from "@/lib/admin/complimentary";
import { COMPLIMENTARY_KIND_LABELS, type ComplimentaryKind } from "@/lib/admin/complimentary-kinds";
import { adminDate } from "@/lib/admin/time";
import { accountDb } from "@/lib/family/account-store";

export const metadata: Metadata = { title: "All complimentary memberships | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUSES: { value: IssuedStatus; label: string; tone: string }[] = [
  { value: "unclaimed", label: "Unclaimed", tone: "bg-sunshine" },
  { value: "claimed", label: "Claimed", tone: "bg-mint" },
  { value: "revoked", label: "Revoked", tone: "bg-ink/10" },
  { value: "expired", label: "Expired", tone: "bg-ink/10" },
];
const TONE = Object.fromEntries(STATUSES.map((s) => [s.value, s])) as Record<IssuedStatus, (typeof STATUSES)[number]>;
const date = (iso: string | null) => (iso ? adminDate(iso) : "–");
const occasionLabel = (o: string | null) => (o ? (COMPLIMENTARY_KIND_LABELS[o as ComplimentaryKind] ?? o) : "–");

/** Every complimentary membership across batches, searchable like a table (Kevin, 2026-11-03). */
export default async function MembershipsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const gate = await requireAdmin("/admin/complimentary/memberships");
  const p = await searchParams;
  const q = typeof p.q === "string" ? p.q.trim() : "";
  const status = STATUSES.find((s) => s.value === p.status)?.value ?? null;
  const db = gate.preview ? null : accountDb();
  const all = db ? await listMemberships(db) : [];
  const rows = filterMemberships(all, q, status);
  const counts = Object.fromEntries(STATUSES.map((s) => [s.value, all.filter((r) => r.status === s.value).length])) as Record<IssuedStatus, number>;

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>
          <Link href="/admin/complimentary" className="underline underline-offset-4">
            Complimentary memberships
          </Link>
        </Eyebrow>
        <h1 className="font-display text-4xl font-semibold">All memberships</h1>
        <p className="text-lg">
          {all.length} issued: {STATUSES.map((s) => `${counts[s.value]} ${s.label.toLowerCase()}`).join(", ")}.
        </p>
      </header>
      {!db && <PreviewNote>Connect sign-in and Supabase to see memberships.</PreviewNote>}

      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search memberships
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Name, email, certificate, last 4 of code, sponsor or event"
          className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15"
        />
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select id="status" name="status" defaultValue={status ?? ""} className="rounded-2xl bg-surface px-3 py-3 ring-2 ring-ink/15">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button className={buttonSecondary}>Search</button>
      </form>

      {db && (q || status) && (
        <p className="text-sm text-muted">
          {rows.length} of {all.length} match.{" "}
          <Link href="/admin/complimentary/memberships" className="underline underline-offset-4">
            Clear
          </Link>
        </p>
      )}

      {db && rows.length === 0 ? (
        <p className="text-muted">{all.length ? "No membership matches that." : "No complimentary memberships yet."}</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10">
          <table className="w-full min-w-[960px] text-left text-sm" data-testid="memberships-table">
            <thead>
              <tr className="border-b-2 border-ink/10 text-xs font-bold uppercase tracking-[0.06em] text-muted">
                <th className="px-3 py-3">Certificate</th>
                <th className="px-3 py-3">Recipient</th>
                <th className="px-3 py-3">Presented by</th>
                <th className="px-3 py-3">Occasion</th>
                <th className="px-3 py-3">Length</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Issued</th>
                <th className="px-3 py-3">Claim by</th>
                <th className="px-3 py-3">Claimed</th>
                <th className="px-3 py-3">Ends</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-ink/10 align-top last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-3">
                    {r.batchId ? (
                      <Link href={`/admin/complimentary/${r.batchId}`} className="font-semibold underline underline-offset-4">
                        {r.certificate}
                      </Link>
                    ) : (
                      <span className="font-semibold">{r.certificate}</span>
                    )}
                    {r.last4 && <span className="block font-mono text-xs text-muted">…{r.last4}</span>}
                  </td>
                  <td className="px-3 py-3">
                    {r.recipientName ?? <span className="text-muted">Unknown winner</span>}
                    {r.recipientEmail && <span className="block break-all text-xs text-muted">{r.recipientEmail}</span>}
                  </td>
                  <td className="px-3 py-3">
                    {r.sponsorName ?? "–"}
                    {r.eventName && <span className="block text-xs text-muted">{r.eventName}</span>}
                    {r.label && <span className="block text-xs text-muted">{r.label}</span>}
                  </td>
                  <td className="px-3 py-3">{occasionLabel(r.occasion)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{r.months ? `${r.months} mo` : "–"}</td>
                  <td className="px-3 py-3">
                    <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${TONE[r.status].tone}`}>{TONE[r.status].label}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{date(r.issuedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{date(r.claimBy)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{date(r.redeemedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{date(r.paidThrough)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdultPage>
  );
}
