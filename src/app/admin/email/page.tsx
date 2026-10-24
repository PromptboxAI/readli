import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { loadEmailDashboard, STATE_LABELS, type DashboardState, type EmailDashboard } from "@/lib/email/admin";
import { emailDefinition } from "@/lib/email/catalog";
import { readliMailer } from "@/lib/email/send";
import { accountDb } from "@/lib/family/account-store";
import { retryEmailAction, setEmailSwitchAction } from "./actions";

export const metadata: Metadata = { title: "Email | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const SHOWN: DashboardState[] = ["scheduled", "sent", "delivered", "bounced", "complained", "suppressed", "failed", "canceled"];
const CLASS_LABELS: Record<string, string> = { transactional: "Transactional", relationship: "Relationship", commercial: "Commercial (opt-in)" };
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10 hover:ring-ink/30">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
    </Link>
  );
}

/** Kevin, 2026-10-24: every automated email, its switch, what happened to each send, and safe retries. */
export default async function AdminEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const gate = await requireAdmin("/admin/email");
  const p = await searchParams;
  const state = typeof p.state === "string" && p.state in STATE_LABELS ? (p.state as DashboardState) : null;
  const emailId = typeof p.email === "string" && emailDefinition(p.email) ? p.email : null;
  const db = gate.preview ? null : accountDb();
  const dash: EmailDashboard | null = db ? await loadEmailDashboard(db, { state, emailId }) : null;
  const mailer = Boolean(readliMailer());
  const webhook = Boolean(process.env.RESEND_WEBHOOK_SECRET);

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Email</h1>
        <p className="text-lg">Every automated Readli email, sent through one outbox. Each one stays off until you switch it on.</p>
        <Link href="/admin" className="text-sm underline underline-offset-4">
          Back to the admin overview
        </Link>
        <Link href="/admin/bedtime" className="text-sm underline underline-offset-4">
          Pick this week&apos;s Bedtime Thursdays stories
        </Link>
      </header>
      {typeof p.ok === "string" && <p className="rounded-2xl bg-mint/60 px-4 py-3">{p.ok}</p>}
      {typeof p.err === "string" && (
        <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">
          {p.err}
        </p>
      )}
      {!db && <PreviewNote>Connect Supabase to see email activity and change switches.</PreviewNote>}
      <p className="text-sm">
        {mailer ? "Resend is configured." : "Resend isn't configured here (RESEND_API_KEY and EMAIL_FROM), so emails wait in the outbox."}{" "}
        {webhook ? "Delivery events arrive from Resend's webhook." : "Resend's webhook isn't set up (RESEND_WEBHOOK_SECRET), so Delivered, Bounced and Marked as spam stay at 0."}
      </p>

      {dash && (
        <section className="flex flex-col gap-3" aria-labelledby="totals-h">
          <h2 id="totals-h" className="font-display text-2xl font-semibold">
            Last {dash.days} days
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {SHOWN.map((s) => (
              <Stat key={s} label={STATE_LABELS[s]} value={dash.totals[s]} href={`/admin/email?state=${s}`} />
            ))}
          </div>
          <p className="text-sm text-muted">Scheduled includes failed sends that will be retried automatically. Failed means Readli has stopped trying.</p>
        </section>
      )}

      {dash && (
        <section className="flex flex-col gap-3" aria-labelledby="emails-h">
          <h2 id="emails-h" className="font-display text-2xl font-semibold">
            Emails and switches
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b-2 border-ink/10">
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Class</th>
                  <th className="py-2 pr-3">Sent</th>
                  <th className="py-2 pr-3">Delivered</th>
                  <th className="py-2 pr-3">Suppressed</th>
                  <th className="py-2 pr-3">Failed</th>
                  <th className="py-2">Switch</th>
                </tr>
              </thead>
              <tbody>
                {dash.emails.map((e) => (
                  <tr key={e.id} className="border-b border-ink/10">
                    <td className="py-2 pr-3">
                      <Link href={`/admin/email?email=${e.id}`} className="font-semibold underline underline-offset-4">
                        {e.id}
                      </Link>{" "}
                      {e.name}
                    </td>
                    <td className="py-2 pr-3">{CLASS_LABELS[e.category] ?? e.category}</td>
                    <td className="py-2 pr-3">{e.counts.sent + e.counts.delivered + e.counts.bounced + e.counts.complained}</td>
                    <td className="py-2 pr-3">{e.counts.delivered}</td>
                    <td className="py-2 pr-3">{e.counts.suppressed}</td>
                    <td className="py-2 pr-3">{e.counts.failed}</td>
                    <td className="py-2">
                      <form action={setEmailSwitchAction} className="flex items-center gap-2">
                        <input type="hidden" name="emailId" value={e.id} />
                        {!e.enabled && <input type="hidden" name="enabled" value="on" />}
                        <span className={e.enabled ? "font-semibold" : "text-muted"}>{e.enabled ? "On" : "Off"}</span>
                        <button className="min-h-11 rounded-full px-3 font-semibold underline underline-offset-4">{e.enabled ? "Turn off" : "Turn on"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {dash && (
        <section className="flex flex-col gap-3" aria-labelledby="recent-h">
          <h2 id="recent-h" className="font-display text-2xl font-semibold">
            {state ? STATE_LABELS[state] : "Recent"}
            {emailId ? ` · ${emailId}` : ""}
          </h2>
          {(state || emailId) && (
            <Link href="/admin/email" className="text-sm underline underline-offset-4">
              Show everything
            </Link>
          )}
          {dash.recent.length === 0 ? (
            <p>Nothing here yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dash.recent.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 rounded-3xl bg-surface p-4 ring-2 ring-ink/10 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">
                      {r.emailId} {r.emailName} · {STATE_LABELS[r.state]}
                    </span>
                    <span className="text-sm text-muted">
                      {when(r.at)} · {r.recipient} · {r.attempts} {r.attempts === 1 ? "attempt" : "attempts"}
                      {r.reason ? ` · ${r.reason}` : ""}
                    </span>
                  </div>
                  {r.canRetry && (
                    <form action={retryEmailAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="min-h-11 rounded-full px-3 font-semibold underline underline-offset-4">Retry</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </AdultPage>
  );
}
