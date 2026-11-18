import type { Metadata } from "next";
import Link from "next/link";
import { buttonSecondary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { adminActivity, describeAction } from "@/lib/admin/activity";
import { adminDateTime } from "@/lib/admin/time";
import { accountDb } from "@/lib/family/account-store";

export const metadata: Metadata = { title: "Admin activity | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const param = (p: Params, key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");

/** Every admin action, newest first: who did what, when, and to which family (Kevin, 2026-11-08). */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<Params> }) {
  const gate = await requireAdmin("/admin/activity");
  const qs = await searchParams;
  const q = param(qs, "q").trim();
  const db = gate.preview ? null : accountDb();
  const entries = db ? await adminActivity(db, q) : null;
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>
          <Link href="/admin" className="underline underline-offset-4">
            Admin
          </Link>
        </Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Admin activity</h1>
        <p className="text-lg">Every change an admin made: support fixes, credits taken back, emails changed, plans and complimentary memberships. The newest 300 show.</p>
      </header>
      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Filter</label>
        <input id="q" name="q" defaultValue={q} placeholder="Admin email, family or action" className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15" />
        <button className={buttonSecondary}>Filter</button>
      </form>
      {!entries ? (
        <PreviewNote>Admin activity needs sign-in and Supabase connected.</PreviewNote>
      ) : entries.length === 0 ? (
        <p className="text-muted">{q ? "Nothing matches that." : "No admin activity yet."}</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10">
          <table className="w-full min-w-[760px] text-left text-sm" data-testid="admin-activity">
            <thead>
              <tr className="border-b-2 border-ink/10 text-xs font-bold uppercase tracking-[0.06em] text-muted">
                <th className="px-3 py-3">When</th>
                <th className="px-3 py-3">Admin</th>
                <th className="px-3 py-3">What</th>
                <th className="px-3 py-3">Family</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-ink/10 align-top last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2">{adminDateTime(e.at, true)}</td>
                  <td className="break-all px-3 py-2">{e.adminEmail}</td>
                  <td className="px-3 py-2">
                    {describeAction(e.action, e.detail)}
                    {typeof e.detail.userId === "string" && (
                      <Link href={`/admin/accounts/${e.detail.userId}`} className="ml-1 underline underline-offset-4">
                        account
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {e.householdId ? (
                      <Link href={`/admin/families/${e.householdId}`} className="underline underline-offset-4">
                        {e.family ?? "A removed family"}
                      </Link>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdultPage>
  );
}
