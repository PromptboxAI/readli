import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { COHORT_MONTHS, loadGrowth, type GrowthReport } from "@/lib/admin/growth";
import { accountDb } from "@/lib/family/account-store";
import { CHANNEL_LABELS } from "@/lib/marketing/first-touch";

export const metadata: Metadata = { title: "Growth metrics | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const n = (x: number) => x.toLocaleString("en-US");
const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 1000) / 10}%`);
const one = (x: number | null) => (x === null ? "–" : (Math.round(x * 10) / 10).toString());
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const FEEDBACK_LABELS: Record<string, string> = {
  too_expensive: "Too expensive",
  unused: "Not using it enough",
  missing_features: "Missing features",
  low_quality: "Quality wasn't good enough",
  too_complex: "Too hard to use",
  switched_service: "Switched to something else",
  customer_service: "Customer service",
  other: "Other",
  not_answered: "Didn't say",
};

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {note && <p className="text-sm text-muted">{note}</p>}
    </div>
  );
}

function Block({ id, title, note, children }: { id: string; title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <h2 id={id} className="font-display text-2xl font-semibold">{title}</h2>
      {note && <p className="text-sm">{note}</p>}
      {children}
    </section>
  );
}

const th = "py-2 pr-3";
const td = "py-2 pr-3";

type Params = Record<string, string | string[] | undefined>;

/** The numbers investors ask about: retention cohorts, the family-voices effect, channels, cancel reasons and listening habit. */
export default async function GrowthPage({ searchParams }: { searchParams: Promise<Params> }) {
  const gate = await requireAdmin("/admin/growth");
  const test = (await searchParams).mode === "test";
  const db = gate.preview ? null : accountDb();
  const r = db ? await loadGrowth(db, { live: !test }) : null;

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Growth metrics</h1>
        <p className="text-lg">Aggregates only, for investor updates. Nothing here identifies a child.</p>
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin" className="underline underline-offset-4">Back to the admin overview</Link>
          <Link href="/admin/finance" className="underline underline-offset-4">Finances</Link>
          <Link href={test ? "/admin/growth" : "/admin/growth?mode=test"} className="underline underline-offset-4">
            {test ? "Show live payments" : "Show test-mode payments"}
          </Link>
        </p>
      </header>
      {!r ? <PreviewNote>Growth metrics show here once sign-in and Supabase are connected.</PreviewNote> : <Report r={r} test={test} />}
    </AdultPage>
  );
}

function Report({ r, test }: { r: GrowthReport; test: boolean }) {
  return (
    <>
      {!r.hasPayments && (
        <p role="note" className="rounded-2xl bg-lavender/40 px-4 py-3 text-sm">
          No {test ? "test-mode" : "live"} subscription payments yet, so retention and channel payments read empty. Listening below is real.
        </p>
      )}

      <Block
        id="voices-h"
        title="Retention by family voices"
        note="Share of paying families still paying 1, 3 and 6 months after their first payment. Voices are counted as they are today, so read this as a signal rather than proof of cause."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="voice-retention">
            <thead>
              <tr className="border-b-2 border-ink/10">
                <th className={th}>Families</th>
                <th className={th}>Count</th>
                <th className={th}>Month 1</th>
                <th className={th}>Month 3</th>
                <th className={th}>Month 6</th>
              </tr>
            </thead>
            <tbody>
              {r.segments.map((s) => (
                <tr key={s.label} className="border-b border-ink/10">
                  <td className={td}>{s.label}</td>
                  <td className={td}>{n(s.families)}</td>
                  <td className={td}>{pct(s.m1)}</td>
                  <td className={td}>{pct(s.m3)}</td>
                  <td className={td}>{pct(s.m6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block id="cohorts-h" title="Retention cohorts" note="Families grouped by the month they first paid. A dash means that month hasn't arrived for the cohort yet.">
        {r.cohorts.length === 0 ? (
          <p className="text-muted">No paying families yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="cohorts">
              <thead>
                <tr className="border-b-2 border-ink/10">
                  <th className={th}>First paid</th>
                  <th className={th}>Families</th>
                  {Array.from({ length: COHORT_MONTHS }, (_, i) => (
                    <th key={i} className={th}>M{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.cohorts.map((c) => (
                  <tr key={c.month} className="border-b border-ink/10">
                    <td className={td}>{c.month}</td>
                    <td className={td}>{n(c.families)}</td>
                    {c.retained.map((x, i) => (
                      <td key={i} className={td}>{pct(x)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block
        id="channels-h"
        title="Where families come from"
        note={`Referral links, storyteller invites and gifts come from Readli's own records; the rest from the first link or site that brought the grown-up in. ${n(r.trackedFamilies)} families have a recorded source; older families show as "Before tracking".`}
      >
        {r.channels.length === 0 ? (
          <p className="text-muted">No families yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="channels">
              <thead>
                <tr className="border-b-2 border-ink/10">
                  <th className={th}>Channel</th>
                  <th className={th}>Started, last 90 days</th>
                  <th className={th}>Of those, paid</th>
                  <th className={th}>Paying families, all time</th>
                  <th className={th}>Month 3 retention</th>
                </tr>
              </thead>
              <tbody>
                {r.channels.map((c) => (
                  <tr key={c.channel} className="border-b border-ink/10">
                    <td className={td}>{CHANNEL_LABELS[c.channel]}</td>
                    <td className={td}>{n(c.started)}</td>
                    <td className={td}>{c.started ? `${n(c.startedAndPaid)} (${pct(c.startedAndPaid / c.started)})` : "–"}</td>
                    <td className={td}>{n(c.payingEver)}</td>
                    <td className={td}>{pct(c.m3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block
        id="cancels-h"
        title="Why families cancel, last 90 days"
        note="From Stripe. Reasons appear once the cancel survey is turned on in Stripe's customer portal settings. Failed payments are counted apart from families who chose to leave."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Cancels" value={n(r.cancels.total)} />
          <Stat label="Chose to leave" value={n(r.cancels.voluntary)} />
          <Stat label="Payment failed" value={n(r.cancels.involuntary)} note="Involuntary churn" />
          <Stat label="Changed their mind" value={n(r.cancels.withdrawn)} note="Turned the plan back on" />
        </div>
        {r.cancels.byFeedback.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm" data-testid="cancel-reasons">
            {r.cancels.byFeedback.map((f) => (
              <li key={f.feedback}>
                <span className="font-semibold">{FEEDBACK_LABELS[f.feedback] ?? f.feedback}</span>: {n(f.count)}
              </li>
            ))}
          </ul>
        )}
        {r.cancels.recentComments.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="font-display text-lg font-semibold">What they said</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {r.cancels.recentComments.map((c, i) => (
                <li key={i} className="rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/10">
                  <p>&ldquo;{c.comment}&rdquo;</p>
                  <p className="text-muted">{day(c.at)}{c.feedback ? ` · ${FEEDBACK_LABELS[c.feedback] ?? c.feedback}` : ""}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Block>

      <Block
        id="habit-h"
        title="Listening habit"
        note="Weeks start Monday (UTC). Bedtime is listening that starts between 5pm and 10pm in the family's time zone, counted only for families with a saved time zone."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Paying families who listened, last 7 days" value={pct(r.payingActive7d.rate)} note={`${n(r.payingActive7d.active)} of ${n(r.payingActive7d.paying)}`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="weeks">
            <thead>
              <tr className="border-b-2 border-ink/10">
                <th className={th}>Week of</th>
                <th className={th}>Children listening</th>
                <th className={th}>Families listening</th>
                <th className={th}>Days per child</th>
                <th className={th}>At bedtime</th>
              </tr>
            </thead>
            <tbody>
              {r.weeks.map((w) => (
                <tr key={w.weekOf} className="border-b border-ink/10">
                  <td className={td}>{day(w.weekOf)}</td>
                  <td className={td}>{n(w.activeChildren)}</td>
                  <td className={td}>{n(w.activeFamilies)}</td>
                  <td className={td}>{one(w.daysPerChild)}</td>
                  <td className={td}>{pct(w.bedtimeShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
    </>
  );
}
