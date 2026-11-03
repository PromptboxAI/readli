import Link from "next/link";
import type { IssuedStatus, MembershipRow } from "@/lib/admin/complimentary";
import { COMPLIMENTARY_KIND_LABELS, type ComplimentaryKind } from "@/lib/admin/complimentary-kinds";
import { adminDate } from "@/lib/admin/time";

export const MEMBERSHIP_STATUSES: { value: IssuedStatus; label: string; tone: string }[] = [
  { value: "unclaimed", label: "Not claimed yet", tone: "bg-sunshine" },
  { value: "claimed", label: "Active", tone: "bg-mint" },
  { value: "revoked", label: "Revoked", tone: "bg-ink/10" },
  { value: "expired", label: "Expired unclaimed", tone: "bg-ink/10" },
];
const TONE = Object.fromEntries(MEMBERSHIP_STATUSES.map((s) => [s.value, s])) as Record<IssuedStatus, (typeof MEMBERSHIP_STATUSES)[number]>;
const date = (iso: string | null) => (iso ? adminDate(iso) : "–");
const occasionLabel = (o: string | null) => (o ? (COMPLIMENTARY_KIND_LABELS[o as ComplimentaryKind] ?? o) : "–");

/** One row per complimentary membership: who it's for, who claimed it, and how long it lasts. */
export function MembershipsTable({ rows }: { rows: MembershipRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10">
      <table className="w-full min-w-[960px] text-left text-sm" data-testid="memberships-table">
        <thead>
          <tr className="border-b-2 border-ink/10 text-xs font-bold uppercase tracking-[0.06em] text-muted">
            <th className="px-3 py-3">For</th>
            <th className="px-3 py-3">Claimed by</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Ends</th>
            <th className="px-3 py-3">Length</th>
            <th className="px-3 py-3">Presented by</th>
            <th className="px-3 py-3">Occasion</th>
            <th className="px-3 py-3">Issued</th>
            <th className="px-3 py-3">Claim by</th>
            <th className="px-3 py-3">Certificate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ink/10 align-top last:border-b-0">
              <td className="px-3 py-3">
                <span className="font-semibold">{r.recipientName ?? <span className="font-normal text-muted">Unnamed winner</span>}</span>
                {r.recipientEmail && <span className="block break-all text-xs text-muted">{r.recipientEmail}</span>}
              </td>
              <td className="px-3 py-3">
                {r.claimedBy ? <span className="break-all">{r.claimedBy}</span> : r.redeemedAt ? "A family" : <span className="text-muted">–</span>}
                {r.redeemedAt && <span className="block text-xs text-muted">on {date(r.redeemedAt)}</span>}
              </td>
              <td className="px-3 py-3">
                <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${TONE[r.status].tone}`}>{TONE[r.status].label}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-3">{date(r.paidThrough)}</td>
              <td className="whitespace-nowrap px-3 py-3">{r.months ? `${r.months} mo` : "–"}</td>
              <td className="px-3 py-3">
                {r.sponsorName ?? "–"}
                {r.eventName && <span className="block text-xs text-muted">{r.eventName}</span>}
                {r.label && <span className="block text-xs text-muted">{r.label}</span>}
              </td>
              <td className="px-3 py-3">{occasionLabel(r.occasion)}</td>
              <td className="whitespace-nowrap px-3 py-3">{date(r.issuedAt)}</td>
              <td className="whitespace-nowrap px-3 py-3">{r.status === "unclaimed" ? date(r.claimBy) : "–"}</td>
              <td className="whitespace-nowrap px-3 py-3">
                {r.batchId ? (
                  <Link href={`/admin/complimentary/${r.batchId}`} className="font-semibold underline underline-offset-4">
                    {r.certificate}
                  </Link>
                ) : (
                  <span>{r.certificate}</span>
                )}
                {r.last4 && <span className="block font-mono text-xs text-muted">…{r.last4}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
