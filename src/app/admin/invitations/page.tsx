import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { accountDb } from "@/lib/family/account-store";
import { invitationMailer } from "@/lib/invitations/email";
import { DEFAULT_INVITATION_SETTINGS, REPORT_REASONS, SETTING_BOUNDS, type InvitationSettings, type ReportReason } from "@/lib/invitations/invitations";
import { loadInvitationFunnel, openReports, type InvitationFunnel, type InvitationReport } from "@/lib/invitations/report";
import { invitationSettings } from "@/lib/invitations/server";
import { findCatalogBook } from "@/lib/library/catalog";
import { reviewReportAction, saveInvitationSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Family invitations | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const LABELS: Record<keyof typeof SETTING_BOUNDS, string> = {
  maxRecipientsPerSend: "People per send",
  maxRecipientsPerDay: "People per contributor per day",
  maxResends: "Resends per person",
  linkDays: "Days a link works",
  previewGenerationsPer30Days: "Previews a contributor can make in 30 days",
};

const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

/** Kevin, 2026-10-12: invitation limits are configurable here, and the funnel is attributed to contributors. */
export default async function AdminInvitationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const gate = await requireAdmin("/admin/invitations");
  const p = await searchParams;
  const db = gate.preview ? null : accountDb();
  let settings: InvitationSettings = DEFAULT_INVITATION_SETTINGS;
  let funnel: InvitationFunnel | null = null;
  let reports: InvitationReport[] = [];
  if (db) [settings, funnel, reports] = await Promise.all([invitationSettings(db), loadInvitationFunnel(db), openReports(db)]);
  const mailer = Boolean(invitationMailer());

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Family invitations</h1>
        <p className="text-lg">Readli Voice contributors inviting adult family members to hear their voice and start Readli Family.</p>
        <Link href="/admin" className="text-sm underline underline-offset-4">
          Back to the admin overview
        </Link>
      </header>
      {typeof p.ok === "string" && <p className="rounded-2xl bg-mint/60 px-4 py-3">{p.ok}</p>}
      {typeof p.err === "string" && (
        <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">
          {p.err}
        </p>
      )}
      {!db && <PreviewNote>Connect Supabase to change these settings and see the funnel.</PreviewNote>}

      <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10" aria-labelledby="settings-h">
        <h2 id="settings-h" className="font-display text-2xl font-semibold">
          Sending and limits
        </h2>
        <p className="text-sm">
          Email provider: {mailer ? "Resend is configured." : "Resend isn't configured here (RESEND_API_KEY and INVITE_EMAIL_FROM)."} Switch sending on only after the sending domain is verified.
        </p>
        <form action={saveInvitationSettingsAction} className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 sm:col-span-2">
            <input type="checkbox" name="sendingEnabled" defaultChecked={settings.sendingEnabled} className="size-5 accent-coral-deep" />
            <span className="font-semibold">Contributors can send invitations</span>
          </label>
          {(Object.keys(SETTING_BOUNDS) as (keyof typeof SETTING_BOUNDS)[]).map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{LABELS[k]}</span>
              <input
                type="number"
                name={k}
                min={SETTING_BOUNDS[k][0]}
                max={SETTING_BOUNDS[k][1]}
                defaultValue={settings[k]}
                className="rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/20"
                required
              />
            </label>
          ))}
          <button className={`${buttonPrimary} w-fit sm:col-span-2`} disabled={!db}>
            Save settings
          </button>
        </form>
      </section>

      {funnel && (
        <section className="flex flex-col gap-3" aria-labelledby="funnel-h">
          <h2 id="funnel-h" className="font-display text-2xl font-semibold">
            Funnel, last {funnel.days} days
          </h2>
          <p className="text-sm">Opens are preview pages viewed in a browser, never email pixels. Plays are people pressing play.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Contributor voices made" value={funnel.voicesCreated} />
            <Stat label="Previews made" value={funnel.previewsGenerated} />
            <Stat label="Previews approved" value={funnel.previewsApproved} />
            <Stat label="Invitations sent" value={funnel.invitationsSent} />
            <Stat label="Unique recipients" value={funnel.uniqueRecipients} />
            <Stat label="Preview pages opened" value={funnel.pagesOpened} />
            <Stat label="Previews played" value={funnel.previewsPlayed} />
            <Stat label="Storytellers connected" value={funnel.accepted} />
            <Stat label="Trials started" value={funnel.trialsStarted} />
            <Stat label="Trials converted to paid" value={funnel.converted} />
            <Stat label="Paying families from invitations" value={funnel.payingHouseholds} />
            <Stat label="Attributed recurring revenue" value={`${money(funnel.attributedMrrCents)}/mo`} />
            <Stat label="Declined" value={funnel.declined} />
            <Stat label="Reported" value={funnel.reports} />
          </div>
          {funnel.books.length > 0 && (
            <p className="text-sm">
              Books chosen for previews: {funnel.books.map((b) => `${findCatalogBook(b.slug)?.title ?? b.slug} (${b.previews})`).join(", ")}
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="reports-h">
        <h2 id="reports-h" className="font-display text-2xl font-semibold">
          Reports to review
        </h2>
        {reports.length === 0 ? (
          <p>No open reports.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-3xl bg-surface p-4 ring-2 ring-ink/10 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{REPORT_REASONS[r.reason as ReportReason] ?? r.reason}</span>
                  {r.details && <span className="text-sm">{r.details}</span>}
                  <span className="text-sm text-muted">
                    {new Date(r.createdAt).toLocaleString("en-US")} · contributor {r.contributorId?.slice(0, 8) ?? "deleted"}
                  </span>
                </div>
                <form action={reviewReportAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="min-h-11 rounded-full px-3 font-semibold underline underline-offset-4">Mark reviewed</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdultPage>
  );
}
