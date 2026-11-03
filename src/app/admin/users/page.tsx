import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { buttonPrimary, buttonSecondary, buttonSmall } from "@/components/brand/buttons";
import { requireAdmin } from "@/lib/admin/access";
import { adminDate } from "@/lib/admin/time";
import {
  ACCOUNT_FILTERS,
  ACCOUNT_SORTS,
  filterAccounts,
  listAccounts,
  matchesFilter,
  sortAccounts,
  type AccountFilter,
  type AccountSort,
  type AdminAccount,
} from "@/lib/admin/users";
import { accountDb } from "@/lib/family/account-store";
import { deleteAccountAction, pauseAccountAction, unpauseAccountAction } from "./actions";

export const metadata: Metadata = { title: "Accounts | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const PER_PAGE = 50;

/** What each kind of family plan is called across admin. */
const PLAN_LABEL: Record<string, string> = {
  subscription: "Paid",
  gift: "Gift",
  donated: "Complimentary",
  trial: "Free trial",
  tester: "Tester",
};

const SORT_LABEL: Record<AccountSort, string> = { joined: "Joined", last_sign_in: "Last sign-in", email: "Account", family: "Family" };

type Params = Record<string, string | string[] | undefined>;
const param = (p: Params, key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");
const date = (iso: string | null) => (iso ? adminDate(iso) : "–");

/** Every grown-up's sign-in account as a searchable, sortable table, with pause and delete. */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const gate = await requireAdmin("/admin/users");
  const params = await searchParams;
  const q = param(params, "q").trim();
  const show = (ACCOUNT_FILTERS.find((f) => f.value === param(params, "show"))?.value ?? null) as AccountFilter | null;
  const sort = (ACCOUNT_SORTS.find((s) => s === param(params, "sort")) ?? "joined") as AccountSort;
  const ok = param(params, "ok");
  const err = param(params, "err");
  const db = gate.preview ? null : accountDb();
  const all = db ? await listAccounts(db) : [];
  const matches = sortAccounts(filterAccounts(all, q).filter((a) => matchesFilter(a, show)), sort);
  const pages = Math.max(1, Math.ceil(matches.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(param(params, "page"), 10) || 1));
  const rows = matches.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const deleting = all.find((a) => a.id === param(params, "delete") && !a.isAdmin && a.email) ?? null;

  const href = (change: { sort?: AccountSort; page?: number; delete?: string | null }) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (show) qs.set("show", show);
    const s = change.sort ?? sort;
    if (s !== "joined") qs.set("sort", s);
    const n = change.page ?? (change.sort ? 1 : page);
    if (n > 1) qs.set("page", String(n));
    if (change.delete) qs.set("delete", change.delete);
    return `/admin/users${qs.size ? `?${qs}` : ""}`;
  };
  const backQs = href({}).split("?")[1] ?? "";
  const count = (f: AccountFilter) => all.filter((a) => matchesFilter(a, f)).length;

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>
          <Link href="/admin" className="underline underline-offset-4">
            Admin
          </Link>
        </Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Accounts</h1>
        <p className="text-lg">
          Every grown-up who has signed up, with each family&apos;s plan. Pausing stops an account signing in and keeps everything. Deleting does what &ldquo;Delete my
          account&rdquo; does and can&apos;t be undone.
        </p>
      </header>
      {gate.preview && <PreviewNote>The account list needs sign-in and Supabase connected.</PreviewNote>}
      {ok && <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">{ok}</p>}
      {err && <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">{err}</p>}

      {deleting && <ConfirmDelete account={deleting} backQs={backQs} cancel={href({ delete: null })} />}

      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Find an account</label>
        <input id="q" name="q" defaultValue={q} placeholder="Email, name or family" className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15" />
        <label htmlFor="show" className="sr-only">Show</label>
        <select id="show" name="show" defaultValue={show ?? ""} className="rounded-2xl bg-surface px-3 py-3 ring-2 ring-ink/15">
          <option value="">All accounts ({all.length})</option>
          {ACCOUNT_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label} ({count(f.value)})
            </option>
          ))}
        </select>
        {sort !== "joined" && <input type="hidden" name="sort" value={sort} />}
        <button className={buttonSecondary}>Find</button>
      </form>

      {db && (
        <p className="text-sm text-muted">
          {matches.length === all.length ? `${all.length} account${all.length === 1 ? "" : "s"}` : `${matches.length} of ${all.length} accounts`}
          {matches.length > PER_PAGE && `, showing ${(page - 1) * PER_PAGE + 1} to ${(page - 1) * PER_PAGE + rows.length}`}
          {(q || show) && (
            <>
              {" · "}
              <Link href="/admin/users" className="underline underline-offset-4">
                Clear
              </Link>
            </>
          )}
        </p>
      )}

      {db && rows.length === 0 ? (
        <p className="text-muted">{all.length ? "No account matches that." : "No accounts yet."}</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10">
          <table className="w-full min-w-[960px] text-left text-sm" data-testid="admin-accounts">
            <thead>
              <tr className="border-b-2 border-ink/10 text-xs font-bold uppercase tracking-[0.06em] text-muted">
                <SortHeader col="email" sort={sort} href={href} />
                <SortHeader col="family" sort={sort} href={href} />
                <th className="px-3 py-3">Plan</th>
                <SortHeader col="joined" sort={sort} href={href} />
                <SortHeader col="last_sign_in" sort={sort} href={href} />
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <AccountRow key={a.id} account={a} backQs={backQs} deleteHref={href({ delete: a.id })} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className={buttonSecondary}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={href({ page: page + 1 })} className={buttonSecondary}>
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </AdultPage>
  );
}

function SortHeader({ col, sort, href }: { col: AccountSort; sort: AccountSort; href: (c: { sort: AccountSort }) => string }) {
  const active = col === sort;
  return (
    <th className="px-3 py-3" aria-sort={active ? (col === "email" || col === "family" ? "ascending" : "descending") : undefined}>
      <Link href={href({ sort: col })} className={`whitespace-nowrap hover:text-ink ${active ? "text-ink underline underline-offset-4" : ""}`}>
        {SORT_LABEL[col]}
        {active ? (col === "email" || col === "family" ? " ↑" : " ↓") : ""}
      </Link>
    </th>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{children}</span>;
}

function AccountRow({ account: a, backQs, deleteHref }: { account: AdminAccount; backQs: string; deleteHref: string }) {
  const label = a.email ?? a.id;
  return (
    <tr className="border-b border-ink/10 align-top last:border-b-0">
      <td className="px-3 py-2">
        <span className="block break-all font-semibold">{label}</span>
        {a.name && <span className="block text-xs text-muted">{a.name}</span>}
      </td>
      <td className="px-3 py-2">
        {a.homes.length ? (
          a.homes.map((h) => (
            <span key={h.name} className="block">
              {h.name}
            </span>
          ))
        ) : (
          <span className="text-muted">–</span>
        )}
      </td>
      <td className="px-3 py-2">
        {a.homes.length ? (
          a.homes.map((h, i) => (
            <span key={`${h.name}-${i}`} className="block whitespace-nowrap">
              {h.plan ? PLAN_LABEL[h.plan.source] ?? h.plan.source : <span className="text-muted">No plan</span>}
              {h.plan?.endsAt && <span className="text-xs text-muted"> until {adminDate(h.plan.endsAt)}</span>}
            </span>
          ))
        ) : (
          <span className="text-muted">–</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2">{date(a.createdAt)}</td>
      <td className="whitespace-nowrap px-3 py-2">{a.lastSignInAt ? date(a.lastSignInAt) : <span className="text-muted">Never</span>}</td>
      <td className="px-3 py-2">
        <span className="flex flex-wrap gap-1">
          {a.isAdmin && <Badge tone="bg-sunshine/50">Admin</Badge>}
          {a.paused && <Badge tone="bg-coral/30">Paused</Badge>}
          {!a.confirmed && <Badge tone="bg-ink/10">Unconfirmed</Badge>}
          {!a.isAdmin && !a.paused && a.confirmed && <span className="text-muted">Active</span>}
        </span>
      </td>
      <td className="px-3 py-2">
        {!a.isAdmin && (
          <span className="flex items-center justify-end gap-1">
            <form action={a.paused ? unpauseAccountAction : pauseAccountAction}>
              <input type="hidden" name="userId" value={a.id} />
              <input type="hidden" name="back" value={backQs} />
              <button className={buttonSmall} aria-label={`${a.paused ? "Unpause" : "Pause"} ${label}`}>
                {a.paused ? "Unpause" : "Pause"}
              </button>
            </form>
            {a.email && (
              <Link href={deleteHref} className="inline-flex min-h-11 items-center px-2 font-semibold text-coral-deep underline underline-offset-4" aria-label={`Delete ${label}`}>
                Delete
              </Link>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}

function ConfirmDelete({ account: a, backQs, cancel }: { account: AdminAccount; backQs: string; cancel: string }) {
  return (
    <section aria-labelledby="delete-h" className="flex flex-col gap-3 rounded-3xl bg-coral/15 p-4 ring-2 ring-coral/40">
      <h2 id="delete-h" className="font-display text-xl font-semibold">
        Delete <span className="break-all">{a.email}</span>?
      </h2>
      <p className="text-sm">
        This removes their voice and its audio, {a.families.length ? `families only they belong to (${a.families.join(", ")}), ` : ""}their photos and recordings, and
        the sign-in, so the email can sign up again. It can&apos;t be undone.
      </p>
      <form action={deleteAccountAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="userId" value={a.id} />
        <input type="hidden" name="back" value={backQs} />
        <label htmlFor="confirm-email" className="w-full text-sm">
          Type <strong className="break-all">{a.email}</strong> to confirm.
        </label>
        <input id="confirm-email" name="confirmEmail" autoComplete="off" required autoFocus className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15" />
        <button className={buttonPrimary}>Delete account</button>
        <Link href={cancel} className={buttonSecondary}>
          Cancel
        </Link>
      </form>
    </section>
  );
}
