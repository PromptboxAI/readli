import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonSecondary, buttonSmall, buttonSmallPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { SupportEmails } from "@/components/admin/SupportEmails";
import { requireAdmin } from "@/lib/admin/access";
import { supportEmails } from "@/lib/admin/problems";
import { supportAccount } from "@/lib/admin/support-people";
import { adminDate, adminDateTime } from "@/lib/admin/time";
import { accountDb } from "@/lib/family/account-store";
import { changeEmailAction, confirmEmailAction, sendSignInAction } from "./actions";

export const metadata: Metadata = { title: "Account | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const param = (p: Params, key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");
const ID = /^[0-9a-f-]{36}$/i;
const input = "min-w-0 w-full rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15";

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{children}</span>;
}

/** One grown-up's sign-in, families and voices, with the sign-in fixes support makes most (Kevin, 2026-11-08). */
export default async function AccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const { id } = await params;
  const gate = await requireAdmin(`/admin/accounts/${id}`);
  const qs = await searchParams;
  const ok = param(qs, "ok");
  const err = param(qs, "err");
  const db = gate.preview ? null : accountDb();
  const header = (title: string) => (
    <header className="flex flex-col gap-2">
      <Eyebrow>
        <Link href="/admin" className="underline underline-offset-4">
          Admin
        </Link>{" "}
        ·{" "}
        <Link href="/admin/users" className="underline underline-offset-4">
          Accounts
        </Link>
      </Eyebrow>
      <h1 className="break-all font-display text-4xl font-semibold">{title}</h1>
    </header>
  );
  if (!db) {
    return (
      <AdultPage wide>
        {header("Account")}
        <PreviewNote>Accounts need sign-in and Supabase connected.</PreviewNote>
      </AdultPage>
    );
  }
  if (!ID.test(id)) notFound();
  const a = await supportAccount(db, id);
  if (!a) notFound();
  const emails = await supportEmails(db, { userId: a.id });
  const hidden = <input type="hidden" name="userId" value={a.id} />;

  return (
    <AdultPage wide>
      {header(a.email ?? a.id)}
      {ok && <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">{ok}</p>}
      {err && <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">{err}</p>}

      <section className="flex flex-col gap-2 rounded-3xl bg-surface p-4 ring-2 ring-ink/10" aria-label="Sign-in" data-testid="account-sign-in">
        <p className="flex flex-wrap items-center gap-2">
          {a.name && <strong>{a.name}</strong>}
          {a.isAdmin && <Badge tone="bg-sunshine/50">Admin</Badge>}
          {a.paused && <Badge tone="bg-coral/30">Paused</Badge>}
          {!a.confirmedAt && <Badge tone="bg-ink/10">Email not confirmed</Badge>}
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">Joined</dt>
            <dd>{adminDate(a.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted">Last sign-in</dt>
            <dd>{a.lastSignInAt ? adminDateTime(a.lastSignInAt, true) : "Never"}</dd>
          </div>
          <div>
            <dt className="text-muted">Email confirmed</dt>
            <dd>{a.confirmedAt ? adminDate(a.confirmedAt) : "No"}</dd>
          </div>
          <div>
            <dt className="text-muted">Signs in with</dt>
            <dd>{a.providers.length ? a.providers.map((p) => (p === "email" ? "Email link or code" : p === "google" ? "Google" : p)).join(", ") : "–"}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2 pt-2">
          {a.email && !a.paused && (
            <form action={sendSignInAction}>
              {hidden}
              <button className={buttonSmallPrimary}>Send a sign-in email</button>
            </form>
          )}
          {!a.confirmedAt && (
            <form action={confirmEmailAction}>
              {hidden}
              <button className={buttonSmall}>Mark email confirmed</button>
            </form>
          )}
          <Link href={`/admin/users?q=${encodeURIComponent(a.email ?? a.id)}`} className={buttonSmall}>
            Pause, delete or grant credits
          </Link>
        </div>
      </section>

      {!a.isAdmin && (
        <section aria-labelledby="email-h">
          <details className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
            <summary id="email-h" className="cursor-pointer font-display text-xl font-semibold">
              Change sign-in email
            </summary>
            <form action={changeEmailAction} className="grid gap-3 pt-3 sm:grid-cols-2">
              {hidden}
              <p className="text-sm sm:col-span-2">
                For a grown-up who lost their old address. Check who they are first: they will sign in with the new address, and everything in the account comes
                with it.
              </p>
              <label className="flex flex-col gap-1 text-sm">
                <span>New email</span>
                <input name="email" type="email" autoComplete="off" required className={input} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>New email again</span>
                <input name="emailAgain" type="email" autoComplete="off" required className={input} />
              </label>
              <div className="sm:col-span-2">
                <button className={buttonSmallPrimary}>Change email</button>
              </div>
            </form>
          </details>
        </section>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="families-h">
        <h2 id="families-h" className="font-display text-2xl font-semibold">
          Families
        </h2>
        {a.families.length === 0 ? (
          <p className="text-muted">Not in any family.</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="account-families">
            {a.families.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
                <span>
                  <strong>{f.name}</strong>{" "}
                  <span className="text-sm text-muted">
                    {f.role === "guardian" ? "parent" : "storyteller"} since {adminDate(f.joinedAt)}
                    {f.removedAt ? `, left ${adminDate(f.removedAt)}` : ""}
                  </span>
                </span>
                {!f.removedAt && (
                  <Link href={`/admin/families/${f.id}`} className={buttonSecondary}>
                    Open family
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="voices-h">
        <h2 id="voices-h" className="font-display text-2xl font-semibold">
          Their voice
        </h2>
        {a.voices.length === 0 ? (
          <p className="text-muted">They haven&apos;t recorded a voice.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {a.voices.map((v) => (
              <li key={v.id} className="rounded-3xl bg-surface p-4 text-sm ring-2 ring-ink/10">
                <strong>{v.deletedAt ? `Deleted ${adminDate(v.deletedAt)}` : v.status === "ready" ? "Ready" : "Still being made"}</strong>, made {adminDate(v.createdAt)}.{" "}
                {v.sharedWith.length ? `Shared with ${v.sharedWith.join(", ")}.` : "Not shared with any family."}
              </li>
            ))}
          </ul>
        )}
      </section>

      <SupportEmails emails={emails} people={[{ id: a.id, name: a.name ?? "them" }]} />
    </AdultPage>
  );
}
