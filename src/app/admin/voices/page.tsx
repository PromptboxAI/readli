import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { requireAdmin } from "@/lib/admin/access";
import { loadVoiceMetrics, type VoiceMetric } from "@/lib/admin/voice-metrics";
import { billingConfig } from "@/lib/billing/config";
import { accountDb } from "@/lib/family/account-store";
import { formatPrice, planConfig } from "@/lib/family/plan";
import { CONFIRM_REMOVAL } from "@/lib/lifecycle/legal-removal";
import { legalRemovalAction } from "./actions";

export const metadata: Metadata = { title: "Voice lifecycle | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const param = (p: Params, key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");

function show(m: VoiceMetric): string {
  if (m.unit === "cents") return formatPrice(m.value);
  if (m.unit === "usd") return `$${m.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (m.unit === "ratio" && m.key.endsWith("conversion")) return `${Math.round(m.value * 1000) / 10}%`;
  if (m.unit === "hours") return `${m.value.toLocaleString("en-US")} h`;
  return m.value.toLocaleString("en-US");
}

const input = "min-w-0 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15";

/** Voice Lifecycle and Acquisition Metrics, with CSV exports and the legal-removal tool. */
export default async function VoiceLifecyclePage({ searchParams }: { searchParams: Promise<Params> }) {
  const gate = await requireAdmin("/admin/voices");
  const params = await searchParams;
  const db = gate.preview ? null : accountDb();
  const report = db ? await loadVoiceMetrics(db, { live: billingConfig().mode === "live", cloneRetireAfterDays: planConfig().cloneRetireAfterDays }) : null;
  const groups = report ? [...new Set(report.metrics.map((m) => m.group))] : [];
  const ok = param(params, "ok");
  const err = param(params, "err");

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Voice lifecycle and acquisition metrics</h1>
        <p className="text-lg">
          Every number comes straight from the database, with its definition beside it. Clone, plan, recovery and removal events come
          from the append-only lifecycle log.
        </p>
        <nav className="flex flex-wrap gap-3 pt-2" aria-label="Exports">
          <Link href="/admin" className={buttonSecondary}>Admin overview</Link>
          <a href="/api/admin/voices/export?what=metrics" className={buttonSecondary}>Export metrics (CSV)</a>
          <a href="/api/admin/voices/export?what=voices" className={buttonSecondary}>Export voices (CSV)</a>
          <a href="/api/admin/voices/export?what=log" className={buttonSecondary}>Export lifecycle log (CSV)</a>
        </nav>
      </header>

      {ok && <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">{ok}</p>}
      {err && <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">{err}</p>}

      {!report ? (
        <PreviewNote>Voice lifecycle numbers show here once sign-in and Supabase are connected.</PreviewNote>
      ) : (
        groups.map((g) => (
          <section key={g} className="flex flex-col gap-3" aria-labelledby={`g-${g}`}>
            <h2 id={`g-${g}`} className="font-display text-2xl font-semibold">{g}</h2>
            <dl className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid={`voice-metrics-${g}`}>
              {report.metrics
                .filter((m) => m.group === g)
                .map((m) => (
                  <div key={m.key} className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
                    <dt className="text-sm text-muted">{m.label}</dt>
                    <dd className="font-display text-2xl font-semibold">{show(m)}</dd>
                    <dd className="text-sm text-muted">{m.definition}</dd>
                  </div>
                ))}
            </dl>
          </section>
        ))
      )}

      <section id="legal-removal" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10" aria-labelledby="removal-h">
        <h2 id="removal-h" className="font-display text-2xl font-semibold">Legally required removal</h2>
        <p>
          Deleting or replacing a voice never removes stories already prepared in it. Use this only when the law requires stories to be
          removed, for one voice or one book. Run it first without the confirmation word: that dry run changes nothing and logs what
          would go. Then type {CONFIRM_REMOVAL} to carry out the same removal. Both are recorded in the lifecycle log with the reason and
          reference.
        </p>
        <form action={legalRemovalAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Voice id</span>
            <input name="voice_id" required className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Book (leave empty to remove the whole voice)</span>
            <input name="book_slug" className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Why the law requires it</span>
            <textarea name="reason" required minLength={10} rows={2} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Legal reference (request, ticket or order)</span>
            <input name="reference" required className={input} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="keep_recordings" />
            <span>Keep the original recordings (whole-voice removal deletes them otherwise)</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Confirmation (empty for a dry run, {CONFIRM_REMOVAL} to carry it out)</span>
            <input name="confirm" autoComplete="off" className={input} />
          </label>
          <button className={`${buttonPrimary} self-start`}>Run</button>
        </form>
      </section>
    </AdultPage>
  );
}
