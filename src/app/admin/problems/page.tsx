import type { Metadata } from "next";
import Link from "next/link";
import { buttonSmall } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { FAILED_DAYS, supportProblems, type ProblemJob } from "@/lib/admin/problems";
import { adminDateTime } from "@/lib/admin/time";
import { accountDb } from "@/lib/family/account-store";
import { resumePreparationAction, stopPreparationAction } from "../families/[id]/actions";

export const metadata: Metadata = { title: "Problems | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";
// Resume keeps a narration worker going after the response.
export const maxDuration = 300;

const familyHref = (j: { householdId: string; bookSlug?: string }) => `/admin/families/${j.householdId}${j.bookSlug ? `#book-${j.bookSlug}` : ""}`;

/** What's going wrong across every family right now, each linked to where support fixes it (Kevin, 2026-11-08). */
export default async function ProblemsPage() {
  const gate = await requireAdmin("/admin/problems");
  const db = gate.preview ? null : accountDb();
  const p = db ? await supportProblems(db) : null;
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>
          <Link href="/admin" className="underline underline-offset-4">
            Admin
          </Link>
        </Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Problems</h1>
        <p className="text-lg">Things going wrong for families right now. Open a family to see the whole picture and fix it there.</p>
      </header>
      {!p ? (
        <PreviewNote>The problems queue needs sign-in and Supabase connected.</PreviewNote>
      ) : (
        <>
          <section className="flex flex-col gap-2" aria-labelledby="stuck-h">
            <h2 id="stuck-h" className="font-display text-2xl font-semibold">
              Stuck preparations ({p.stuck.length})
            </h2>
            <p className="text-sm">Still going, but nothing stored for 15 minutes. A worker usually picks them up when the family opens the book. Resume starts one now.</p>
            {p.stuck.length === 0 ? <p className="text-muted">None.</p> : <Jobs jobs={p.stuck} running />}
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="failed-h">
            <h2 id="failed-h" className="font-display text-2xl font-semibold">
              Failed preparations, last {FAILED_DAYS} days ({p.failed.length})
            </h2>
            <p className="text-sm">Unused credits went back on their own. On the family page, prepare what&apos;s missing at Readli&apos;s cost, or refund what was used.</p>
            {p.failed.length === 0 ? <p className="text-muted">None.</p> : <Jobs jobs={p.failed} />}
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="other-h">
            <h2 id="other-h" className="font-display text-2xl font-semibold">
              Elsewhere
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                {p.failedEmails ? `${p.failedEmails} ${p.failedEmails === 1 ? "email" : "emails"} failed in the last 7 days. ` : "No failed emails in the last 7 days. "}
                <Link href="/admin/email" className="underline underline-offset-4">
                  Email
                </Link>{" "}
                lists them with Retry.
              </li>
              <li>
                <Link href="/admin/users?show=unconfirmed" className="underline underline-offset-4">
                  Accounts with an unconfirmed email
                </Link>{" "}
                can be sent a sign-in email or confirmed from their account page.
              </li>
              {p.lockedDevices.map((d, i) => (
                <li key={`${d.householdId}-${i}`}>
                  Kids PIN locked on &ldquo;{d.label}&rdquo; in{" "}
                  <Link href={`/admin/families/${d.householdId}#devices`} className="underline underline-offset-4">
                    {d.family}
                  </Link>{" "}
                  until {adminDateTime(d.until)}.
                </li>
              ))}
              {p.paymentErrors.map((e, i) => (
                <li key={`${e.at}-${i}`} className="text-coral-deep">
                  Stripe event {e.type} failed to process {adminDateTime(e.at)}: {e.error}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </AdultPage>
  );
}

function Jobs({ jobs, running = false }: { jobs: ProblemJob[]; running?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10">
      <table className="w-full min-w-[820px] text-left text-sm" data-testid={running ? "problems-stuck" : "problems-failed"}>
        <thead>
          <tr className="border-b-2 border-ink/10 text-xs font-bold uppercase tracking-[0.06em] text-muted">
            <th className="px-3 py-3">Family</th>
            <th className="px-3 py-3">Book</th>
            <th className="px-3 py-3">Started</th>
            <th className="px-3 py-3">Sentences</th>
            <th className="px-3 py-3">{running ? "Last stored" : "Why"}</th>
            <th className="px-3 py-3">
              <span className="sr-only">Fix</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-b border-ink/10 align-top last:border-b-0">
              <td className="px-3 py-2">
                <Link href={familyHref(j)} className="font-semibold underline underline-offset-4">
                  {j.family}
                </Link>
              </td>
              <td className="px-3 py-2">
                {j.book}
                {j.free && <span className="block text-xs text-muted">Readli paid</span>}
                {j.refunded && <span className="block text-xs font-semibold">Refunded</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-2">{adminDateTime(j.createdAt)}</td>
              <td className="px-3 py-2">
                {j.ready} / {j.sentences}
              </td>
              <td className="px-3 py-2">{running ? (j.lastStoredAt ? adminDateTime(j.lastStoredAt) : "Nothing yet") : (j.error ?? <span className="text-muted">Not recorded</span>)}</td>
              <td className="px-3 py-2">
                {running && (
                  <span className="flex justify-end gap-2">
                    {(["resume", "stop"] as const).map((kind) => (
                      <form key={kind} action={kind === "resume" ? resumePreparationAction : stopPreparationAction}>
                        <input type="hidden" name="householdId" value={j.householdId} />
                        <input type="hidden" name="book" value={j.bookSlug} />
                        <input type="hidden" name="jobId" value={j.id} />
                        <button className={buttonSmall}>{kind === "resume" ? "Resume" : "Stop"}</button>
                      </form>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
