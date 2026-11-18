import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { buttonSecondary } from "@/components/brand/buttons";
import { requireAdmin } from "@/lib/admin/access";
import { filterMemberships, listMemberships, withClaimers, type IssuedStatus } from "@/lib/admin/complimentary";
import { accountDb } from "@/lib/family/account-store";
import { ComplimentaryTabs } from "../ComplimentaryTabs";
import { MEMBERSHIP_STATUSES as STATUSES, MembershipsTable } from "../MembershipsTable";

const PER_PAGE = 50;

export const metadata: Metadata = { title: "All complimentary memberships | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Every complimentary membership across batches, searchable like a table (Kevin, 2026-11-03). */
export default async function MembershipsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const gate = await requireAdmin("/admin/complimentary/memberships");
  const p = await searchParams;
  const q = typeof p.q === "string" ? p.q.trim() : "";
  const status = STATUSES.find((s) => s.value === p.status)?.value ?? null;
  const db = gate.preview ? null : accountDb();
  const all = db ? await withClaimers(db, await listMemberships(db)) : [];
  const matches = filterMemberships(all, q, status);
  const pages = Math.max(1, Math.ceil(matches.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(typeof p.page === "string" ? p.page : "1", 10) || 1));
  const rows = matches.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pageHref = (n: number) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    if (n > 1) qs.set("page", String(n));
    return `/admin/complimentary/memberships${qs.size ? `?${qs}` : ""}`;
  };
  const counts = Object.fromEntries(STATUSES.map((s) => [s.value, all.filter((r) => r.status === s.value).length])) as Record<IssuedStatus, number>;

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>
          <Link href="/admin" className="underline underline-offset-4">
            Admin
          </Link>
        </Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Complimentary memberships</h1>
        <p className="text-lg">
          {all.length} issued: {STATUSES.map((s) => `${counts[s.value]} ${s.label.toLowerCase()}`).join(", ")}.
        </p>
      </header>
      <ComplimentaryTabs current="who" />
      {!db && <PreviewNote>Connect sign-in and Supabase to see memberships.</PreviewNote>}

      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search memberships
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Name, email, who claimed it, certificate, last 4 of code, sponsor or event"
          className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15"
        />
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select id="status" name="status" defaultValue={status ?? ""} className="rounded-2xl bg-surface px-3 py-3 ring-2 ring-ink/15">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button className={buttonSecondary}>Search</button>
      </form>

      {db && (q || status) && (
        <p className="text-sm text-muted">
          {matches.length} of {all.length} match.{" "}
          <Link href="/admin/complimentary/memberships" className="underline underline-offset-4">
            Clear
          </Link>
        </p>
      )}

      {db && rows.length === 0 ? (
        <p className="text-muted">{all.length ? "No membership matches that." : "No complimentary memberships yet."}</p>
      ) : (
        <MembershipsTable rows={rows} />
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Showing {(page - 1) * PER_PAGE + 1} to {(page - 1) * PER_PAGE + rows.length} of {matches.length}, newest first.
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className={buttonSecondary}>
                Newer
              </Link>
            )}
            {page < pages && (
              <Link href={pageHref(page + 1)} className={buttonSecondary}>
                Older
              </Link>
            )}
          </div>
        </nav>
      )}
    </AdultPage>
  );
}
