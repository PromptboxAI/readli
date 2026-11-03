import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { requireAdmin } from "@/lib/admin/access";
import { adminDate } from "@/lib/admin/time";
import { filterAccounts, listAccounts, type AdminAccount } from "@/lib/admin/users";
import { accountDb } from "@/lib/family/account-store";
import { deleteAccountAction, pauseAccountAction, unpauseAccountAction } from "./actions";

export const metadata: Metadata = { title: "Accounts | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const param = (p: Params, key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");

/** Every grown-up's sign-in account, with pause and delete. */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const gate = await requireAdmin("/admin/users");
  const params = await searchParams;
  const q = param(params, "q");
  const ok = param(params, "ok");
  const err = param(params, "err");
  const db = gate.preview ? null : accountDb();
  const all = db ? await listAccounts(db) : [];
  const shown = filterAccounts(all, q);

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
          Every grown-up who has signed up. Pausing stops an account signing in and keeps everything, so you can unpause it later. Deleting does what
          &ldquo;Delete my account&rdquo; does: it removes their voice and its audio, families only they belong to, their photos and recordings, and the sign-in,
          so the email can sign up again. It can&apos;t be undone.
        </p>
      </header>
      {gate.preview && <PreviewNote>The account list needs sign-in and Supabase connected.</PreviewNote>}
      {ok && <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">{ok}</p>}
      {err && <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">{err}</p>}

      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Find an account</label>
        <input id="q" name="q" defaultValue={q} placeholder="Email, name or family" className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15" />
        <button className={buttonSecondary}>Find</button>
      </form>
      {db && (
        <p className="text-sm text-muted">
          {q ? `${shown.length} of ${all.length} accounts` : `${all.length} account${all.length === 1 ? "" : "s"}`}, newest first.
        </p>
      )}
      {db && shown.length === 0 ? (
        <p className="text-muted">{q ? "No account matches that." : "No accounts yet."}</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="admin-accounts">
          {shown.map((a) => (
            <AccountRow key={a.id} account={a} q={q} />
          ))}
        </ul>
      )}
    </AdultPage>
  );
}

function AccountRow({ account: a, q }: { account: AdminAccount; q: string }) {
  const label = a.email ?? a.id;
  return (
    <li className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-semibold">
            {label}
            {a.isAdmin && <span className="ml-2 rounded-full bg-sunshine/50 px-2 py-0.5 text-sm">Admin</span>}
            {a.paused && <span className="ml-2 rounded-full bg-coral/30 px-2 py-0.5 text-sm">Paused</span>}
            {!a.confirmed && <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-sm">Email not confirmed</span>}
          </p>
          {a.name && <p className="text-sm">{a.name}</p>}
          <p className="text-sm text-muted">
            Joined {adminDate(a.createdAt)} · {a.lastSignInAt ? `last signed in ${adminDate(a.lastSignInAt)}` : "never signed in"}
          </p>
          <p className="text-sm">{a.families.length ? `Family: ${a.families.join(", ")}` : "No family"}</p>
        </div>
        {!a.isAdmin && (
          <form action={a.paused ? unpauseAccountAction : pauseAccountAction}>
            <input type="hidden" name="userId" value={a.id} />
            <input type="hidden" name="q" value={q} />
            <button className={buttonSecondary} aria-label={`${a.paused ? "Unpause" : "Pause"} ${label}`}>
              {a.paused ? "Unpause" : "Pause"}
            </button>
          </form>
        )}
      </div>
      {!a.isAdmin && a.email && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold underline underline-offset-4">Delete this account…</summary>
          <form action={deleteAccountAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="userId" value={a.id} />
            <input type="hidden" name="q" value={q} />
            <label htmlFor={`confirm-${a.id}`} className="w-full text-sm">
              Type <strong className="break-all">{a.email}</strong> to confirm. This can&apos;t be undone.
            </label>
            <input
              id={`confirm-${a.id}`}
              name="confirmEmail"
              autoComplete="off"
              required
              className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15"
            />
            <button className={buttonPrimary}>Delete account</button>
          </form>
        </details>
      )}
    </li>
  );
}
