import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { DONATION_USES, EVENT_TYPES, eventDateLabel, ORG_TYPES, STATUS_LABELS, US_STATES, type DonationUse, type EventType, type OrgType } from "@/lib/donations/program";
import { requestDetail } from "@/lib/donations/server";
import { accountDb } from "@/lib/family/account-store";
import { approveAction, askForInfoAction, rejectAction, resendAction } from "../actions";

export const metadata: Metadata = { title: "Donation request | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const ACTIONS: Record<string, string> = {
  submitted: "Request submitted",
  flagged: "Automatic checks flagged it",
  info_requested: "Asked for more information",
  applicant_replied: "Applicant replied",
  approved: "Approved",
  rejected: "Declined",
  certificate_issued: "Certificate issued",
  certificate_emailed: "Certificate emailed",
  certificate_downloaded: "Applicant downloaded",
  redeemed: "A family redeemed the certificate",
  note: "Note",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-ink/10 py-2 sm:grid-cols-[200px_1fr]">
      <dt className="font-semibold">{label}</dt>
      <dd className="break-words">{children ?? "—"}</dd>
    </div>
  );
}

const ext = (url: string) => (
  <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
    {url}
  </a>
);

type Params = Record<string, string | string[] | undefined>;

/** One request: everything the applicant sent, the automatic checks, the decision buttons and the activity log. */
export default async function DonationRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const { id } = await params;
  const sp = await searchParams;
  const gate = await requireAdmin(`/admin/donations/${id}`);
  const db = gate.preview ? null : accountDb();
  const detail = db ? await requestDetail(db, id) : null;
  if (!detail) notFound();
  const { request: r, activity, history } = detail;
  const open = r.status === "pending" || r.status === "needs_info";
  const ok = typeof sp.ok === "string" ? sp.ok : "";
  const err = typeof sp.err === "string" ? sp.err : "";

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>
          <Link href="/admin/donations" className="underline underline-offset-4">
            Readli Gives Back
          </Link>
        </Eyebrow>
        <h1 className="font-display text-3xl font-semibold">
          {r.orgName}: {r.eventName}
        </h1>
        <p className="text-lg">
          {r.reference} · {STATUS_LABELS[r.status]} · applied {when(r.createdAt)}
          {r.decidedBy ? ` · decided by ${r.decidedBy}` : ""}
        </p>
      </header>
      {ok && <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">{ok}</p>}
      {err && <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">{err}</p>}

      <section aria-labelledby="checks-h" className={`flex flex-col gap-2 rounded-[var(--radius-panel)] p-5 ${r.flags.length ? "bg-sunshine/40" : "bg-mint/35"}`}>
        <h2 id="checks-h" className="font-display text-xl font-semibold">
          Automatic checks
        </h2>
        {r.flags.length ? (
          <ul className="list-disc pl-5" data-testid="donation-flags">
            {r.flags.map((f) => (
              <li key={f.code}>{f.text}</li>
            ))}
          </ul>
        ) : (
          <p>Nothing flagged.</p>
        )}
        <p className="text-sm">{r.officialEmail ? "The contact email matches the organization's website or an official domain." : "The contact email doesn't match the organization's website."}</p>
      </section>

      {open && (
        <section aria-labelledby="decide-h" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10 sm:p-7">
          <h2 id="decide-h" className="font-display text-2xl font-semibold">
            Decide
          </h2>
          <form action={approveAction}>
            <input type="hidden" name="id" value={r.id} />
            <button className={buttonPrimary}>Approve and send certificate</button>
          </form>
          <details className="rounded-2xl bg-ink/5 px-4 py-3">
            <summary className="cursor-pointer font-semibold">Ask for more information</summary>
            <form action={askForInfoAction} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="id" value={r.id} />
              <label htmlFor="ask" className="text-sm">
                The applicant sees exactly this, by email and on their request page.
              </label>
              <textarea id="ask" name="message" required maxLength={2000} className="min-h-24 rounded-2xl bg-surface p-3 ring-2 ring-ink/20" defaultValue={r.infoRequest ?? ""} />
              <button className={`${buttonSecondary} self-start`}>Send question</button>
            </form>
          </details>
          <details className="rounded-2xl bg-ink/5 px-4 py-3">
            <summary className="cursor-pointer font-semibold">Decline</summary>
            <form action={rejectAction} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="id" value={r.id} />
              <label htmlFor="reason" className="text-sm">
                A short, kind reason. The applicant sees it, with a way to ask us to reconsider.
              </label>
              <textarea id="reason" name="reason" required maxLength={2000} className="min-h-24 rounded-2xl bg-surface p-3 ring-2 ring-ink/20" />
              <button className={`${buttonSecondary} self-start`}>Decline request</button>
            </form>
          </details>
        </section>
      )}

      {r.status === "approved" && (
        <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-mint/40 p-5 sm:p-7">
          <h2 className="font-display text-2xl font-semibold">Certificate</h2>
          <p>
            Redemption: <strong>{r.redemption === "unredeemed" ? "not yet redeemed" : r.redemption}</strong>. Download it, show the code, or revoke and replace it on the
            membership page.
          </p>
          <div className="flex flex-wrap gap-3">
            {r.batchId && (
              <Link href={`/admin/complimentary/${r.batchId}`} className={buttonSecondary}>
                Open membership
              </Link>
            )}
            <form action={resendAction}>
              <input type="hidden" name="id" value={r.id} />
              <button className={buttonSecondary}>Email certificate again</button>
            </form>
          </div>
        </section>
      )}

      {r.applicantReply || r.hasReplyFile ? (
        <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-sky/25 p-5">
          <h2 className="font-display text-xl font-semibold">Applicant&apos;s reply</h2>
          {r.infoRequest && <p className="text-sm text-muted">You asked: {r.infoRequest}</p>}
          {r.applicantReply && <p className="whitespace-pre-line">{r.applicantReply}</p>}
          {r.hasReplyFile && (
            <a href={`/api/admin/donations/${r.id}/reply`} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">
              Open attached document
            </a>
          )}
        </section>
      ) : null}

      <section aria-labelledby="org-h" className="grid gap-6 lg:grid-cols-2">
        <dl className="flex flex-col">
          <h2 id="org-h" className="mb-2 font-display text-xl font-semibold">
            Organization
          </h2>
          <Row label="Name">{r.orgName}</Row>
          <Row label="Type">{ORG_TYPES[r.orgType as OrgType] ?? r.orgType}</Row>
          <Row label="Website">{r.orgWebsite ? ext(r.orgWebsite) : null}</Row>
          <Row label="Other proof">{r.orgProof}</Row>
          <Row label="EIN">{r.orgEin}</Row>
          <Row label="Address">{r.address ? `${r.address}${r.state ? ` (${US_STATES[r.state] ?? r.state})` : ""}` : null}</Row>
          <Row label="Contact">
            {r.contactName}
            {r.contactRole ? `, ${r.contactRole}` : ""}
          </Row>
          <Row label="Email">
            <a href={`mailto:${r.contactEmail}`} className="underline underline-offset-4">
              {r.contactEmail}
            </a>
          </Row>
          <Row label="Phone">{r.contactPhone}</Row>
        </dl>
        <dl className="flex flex-col">
          <h2 className="mb-2 font-display text-xl font-semibold">Event</h2>
          <Row label="Event">{r.eventName}</Row>
          <Row label="Type">{EVENT_TYPES[r.eventType as EventType] ?? r.eventType}</Row>
          <Row label="Date">{eventDateLabel(r.eventDate)}</Row>
          <Row label="Benefits">{r.beneficiary}</Row>
          <Row label="Location">{[r.eventLocation, r.eventOnline ? "Online" : null].filter(Boolean).join(" · ") || null}</Row>
          <Row label="Event page">{r.eventUrl ? ext(r.eventUrl) : null}</Row>
          <Row label="Attendance">{r.attendance?.toLocaleString("en-US") ?? null}</Row>
          <Row label="Used as">{r.donationUse ? (DONATION_USES[r.donationUse as DonationUse] ?? r.donationUse) : null}</Row>
          <Row label="Flyer">
            {r.hasFlyer ? (
              <a href={`/api/admin/donations/${r.id}/flyer`} target="_blank" rel="noopener" className="underline underline-offset-4">
                Open flyer
              </a>
            ) : null}
          </Row>
          <Row label="Certificate name">{r.certificateOrgName}</Row>
          <Row label="Delivery">{r.certificateDelivery === "download" ? "Download from request page" : "Email"}</Row>
          <Row label="Notes">{r.notes ? <span className="whitespace-pre-line">{r.notes}</span> : null}</Row>
        </dl>
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-semibold">Other requests from this organization</h2>
          <ul className="flex flex-col gap-1.5">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/admin/donations/${h.id}`} className="underline underline-offset-4">
                  {h.reference}
                </Link>{" "}
                · {h.eventName} · {eventDateLabel(h.eventDate)} · {STATUS_LABELS[h.status]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="log-h" className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-ink/5 p-5 sm:p-6">
        <h2 id="log-h" className="font-display text-xl font-semibold">
          Activity
        </h2>
        <ul className="flex flex-col gap-1.5 text-[15px]" data-testid="donation-activity">
          {activity.map((a, i) => (
            <li key={`${a.at}-${i}`}>
              {when(a.at)} · {ACTIONS[a.action] ?? a.action}
              {a.actor === "admin" || a.actor === "system" || a.actor === "applicant" ? "" : ` by ${a.actor}`}
              {typeof a.detail.reason === "string" ? `: ${a.detail.reason}` : ""}
              {typeof a.detail.message === "string" ? `: ${a.detail.message}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </AdultPage>
  );
}
