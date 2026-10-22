import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { batchDetail } from "@/lib/admin/complimentary";
import { COMPLIMENTARY_KIND_LABELS } from "@/lib/admin/complimentary-kinds";
import { accountDb } from "@/lib/family/account-store";
import { claimByLabel } from "@/lib/gifting/complimentary-copy";
import { IssuedTable } from "./IssuedTable";

export const metadata: Metadata = { title: "Issued memberships | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** One batch: every membership's status, downloads, revoke and replace, and the audit trail. */
export default async function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const gate = await requireAdmin(`/admin/complimentary/${batchId}`);
  const db = gate.preview ? null : accountDb();
  const detail = db ? await batchDetail(db, batchId) : null;
  if (!detail) notFound();
  const { batch, gifts, audit } = detail;
  const live = gifts.filter((g) => g.status !== "revoked").length;
  return (
    <AdultPage wide>
      <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-mint/45 p-5 sm:p-7">
        <Eyebrow>
          <Link href="/admin/complimentary" className="underline underline-offset-4">
            Complimentary memberships
          </Link>
        </Eyebrow>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold uppercase tracking-[0.08em]">Batch {batch.prefix}</p>
          <h1 className="font-display text-3xl font-semibold">{batch.label ?? batch.eventName ?? batch.sponsorName}</h1>
          <p>
            {live} {live === 1 ? "membership" : "memberships"} · {batch.months} months each · {COMPLIMENTARY_KIND_LABELS[batch.occasion]} · Presented by {batch.sponsorName}
            {batch.eventName ? ` · ${batch.eventName}` : ""} · Claim by {claimByLabel(batch.claimBy)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={`/api/admin/complimentary/batches/${batch.id}/certificates.zip`} className={buttonPrimary} download>
            Download all certificates (ZIP)
          </a>
          <a href={`/api/admin/complimentary/batches/${batch.id}/qr-codes.zip`} className={buttonSecondary} download>
            All QR codes (ZIP)
          </a>
        </div>
        <p className="text-sm">Downloading again always gives the same codes. Nothing new is issued until you press Revoke and replace.</p>
      </section>

      <IssuedTable batchId={batch.id} gifts={gifts} />

      <section aria-labelledby="audit-h" className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-ink/5 p-5 sm:p-6">
        <h2 id="audit-h" className="font-display text-xl font-semibold">
          Audit trail
        </h2>
        <ul className="flex flex-col gap-1.5 text-[15px]" data-testid="audit-trail">
          {audit.map((a, i) => (
            <li key={`${a.at}-${i}`}>
              {when(a.at)} · {a.text}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">The log and analytics keep the certificate number and last 4 characters only, never a full code or link.</p>
      </section>
    </AdultPage>
  );
}
