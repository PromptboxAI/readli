import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { requireAdmin } from "@/lib/admin/access";
import { adminOverview, filterFamilies, type AdminFamily } from "@/lib/admin/overview";
import { accountDb } from "@/lib/family/account-store";
import { endTesterPlanAction, grantTesterPlanAction } from "./actions";

export const metadata: Metadata = { title: "Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const n = (x: number) => x.toLocaleString("en-US");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const SOURCE: Record<string, string> = { subscription: "Paid", gift: "Gift", donated: "Donated", trial: "Trial", tester: "Tester" };

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {note && <p className="text-sm text-muted">{note}</p>}
    </div>
  );
}

type Params = Record<string, string | string[] | undefined>;
const param = (p: Params, key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");

/** Admin home: live numbers from the database, and free Family plans for testers. */
export default async function AdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const gate = await requireAdmin("/admin");
  const params = await searchParams;
  const q = param(params, "q");
  const db = gate.preview ? null : accountDb();
  const overview = db ? await adminOverview(db) : null;
  const t = overview?.totals;
  const families = overview ? filterFamilies(overview.families, q) : [];
  const ok = param(params, "ok");
  const err = param(params, "err");

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Readli admin</h1>
        {!gate.preview && <p className="text-lg">Signed in as {gate.admin.email}.</p>}
        <nav className="flex flex-wrap gap-3 pt-2" aria-label="Admin pages">
          <Link href="/admin/plans" className={buttonSecondary}>Plan settings</Link>
          <Link href="/admin/narration" className={buttonSecondary}>Narration</Link>
        </nav>
      </header>

      {ok && <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">{ok}</p>}
      {err && <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">{err}</p>}

      {!t ? (
        <PreviewNote>Real numbers and tester plans show here once sign-in and Supabase are connected.</PreviewNote>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals" data-testid="admin-overview">
            <Stat label="Families" value={n(t.families)} />
            <Stat label="Grown-ups" value={n(t.grownUps)} />
            <Stat label="Kids profiles" value={n(t.kids)} />
            <Stat
              label="Family plans"
              value={n(t.plans)}
              note={Object.entries(t.plansBySource).map(([s, c]) => `${c} ${SOURCE[s]?.toLowerCase() ?? s}`).join(", ") || undefined}
            />
            <Stat label="Family voices" value={n(t.voices)} />
            <Stat label="Narration libraries" value={n(t.libraries)} />
            <Stat label="Narration jobs" value={`${n(t.jobsActive)} running`} note={t.jobsFailed ? `${n(t.jobsFailed)} failed` : undefined} />
            <Stat label="Voice previews, last 7 days" value={n(t.guestPreviews7d)} />
          </section>

          <section className="flex flex-col gap-4" aria-labelledby="testers-h">
            <h2 id="testers-h" className="font-display text-2xl font-semibold">Tester plans</h2>
            <p>
              Give a family a free Readli Family plan so they can try kids profiles before payments are on. The tester signs in and names
              their family first, then shows up here. Families that already have a plan keep it.
            </p>
            <form className="flex flex-wrap gap-2" role="search">
              <label htmlFor="q" className="sr-only">Find a family</label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Family name or owner email"
                className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15"
              />
              <button className={buttonSecondary}>Find</button>
            </form>
            {families.length === 0 ? (
              <p className="text-muted">{q ? "No family matches that." : "No families yet."}</p>
            ) : (
              <ul className="flex flex-col gap-3" data-testid="admin-families">
                {families.map((f) => (
                  <FamilyRow key={f.id} family={f} q={q} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AdultPage>
  );
}

function FamilyRow({ family: f, q }: { family: AdminFamily; q: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
      <div className="min-w-0">
        <p className="font-semibold">{f.name}</p>
        <p className="break-all text-sm text-muted">{f.ownerEmail ?? "Owner email unknown"}</p>
        <p className="text-sm">
          {f.members} grown-up{f.members === 1 ? "" : "s"}, {f.kids} kid{f.kids === 1 ? "" : "s"} · since {day(f.createdAt)} ·{" "}
          {f.plan ? `${SOURCE[f.plan.source] ?? f.plan.source} plan${f.plan.endsAt ? ` until ${day(f.plan.endsAt)}` : ""}` : "No plan"}
        </p>
      </div>
      {!f.plan ? (
        <form action={grantTesterPlanAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="householdId" value={f.id} />
          <input type="hidden" name="name" value={f.name} />
          <input type="hidden" name="q" value={q} />
          <label className="sr-only" htmlFor={`days-${f.id}`}>Plan length</label>
          <select id={`days-${f.id}`} name="days" defaultValue="30" className="rounded-2xl bg-surface px-3 py-3 ring-2 ring-ink/15">
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="none">Until I end it</option>
          </select>
          <button className={buttonPrimary}>Give Family plan</button>
        </form>
      ) : f.plan.source === "tester" ? (
        <form action={endTesterPlanAction}>
          <input type="hidden" name="entitlementId" value={f.plan.id} />
          <input type="hidden" name="name" value={f.name} />
          <input type="hidden" name="q" value={q} />
          <button className={buttonSecondary}>End tester plan</button>
        </form>
      ) : null}
    </li>
  );
}
