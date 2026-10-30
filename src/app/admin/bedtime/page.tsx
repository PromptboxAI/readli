import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { currentWeek, featuredBooks, nextWeek } from "@/lib/email/bedtime";
import { accountDb } from "@/lib/family/account-store";
import { CATALOG, type CatalogBook } from "@/lib/library/catalog";
import { chooseBooksAction } from "./actions";

export const metadata: Metadata = { title: "Bedtime Thursdays | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const thursday = (weekOf: string) => new Date(`${weekOf}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const BOOKS = [...CATALOG].sort((a, b) => a.title.localeCompare(b.title));

function WeekForm({ weekOf, books, chosen }: { weekOf: string; books: CatalogBook[]; chosen: boolean }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10">
      <h2 className="font-display text-2xl font-semibold">{thursday(weekOf)}</h2>
      <p className="text-sm text-muted">{chosen ? "Picked here." : "Readli's pick: the two newest stories not featured before. Choose two to replace them."}</p>
      <form action={chooseBooksAction} className="flex flex-col gap-3">
        <input type="hidden" name="weekOf" value={weekOf} />
        {(["first", "second"] as const).map((name, i) => (
          <label key={name} className="flex flex-col gap-1">
            <span className="font-semibold">{i === 0 ? "First story" : "Second story"}</span>
            <select name={name} defaultValue={books[i]?.slug} className="min-h-11 rounded-xl border-2 border-ink/15 bg-white px-3">
              {BOOKS.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.title} ({b.author})
                </option>
              ))}
            </select>
          </label>
        ))}
        <button type="submit" className={`${buttonPrimary} self-start`}>
          Save
        </button>
      </form>
    </section>
  );
}

/** Kevin, 2026-10-24, point 6: the two stories in each week's Bedtime Thursdays email and the app's "New this week". */
export default async function AdminBedtimePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const gate = await requireAdmin("/admin/bedtime");
  const p = await searchParams;
  const db = gate.preview ? null : accountDb();
  const now = new Date();
  const weeks = [currentWeek(now), nextWeek(now)];
  const features = db ? await Promise.all(weeks.map((w) => featuredBooks(db, w))) : [];
  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Bedtime Thursdays</h1>
        <p className="text-lg">
          Two stories a week, in the Thursday email for people who opted in (sent from 4pm their time) and in the app&apos;s &quot;New this week&quot; notice.
        </p>
        <Link href="/admin/email" className="text-sm underline underline-offset-4">
          Back to Email
        </Link>
      </header>
      {typeof p.ok === "string" && <p className="rounded-2xl bg-mint/60 px-4 py-3">{p.ok}</p>}
      {typeof p.err === "string" && (
        <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">
          {p.err}
        </p>
      )}
      {!db && <PreviewNote>Connect Supabase to pick stories.</PreviewNote>}
      {weeks.map((w, i) => {
        const f = features[i];
        return f ? <WeekForm key={w} weekOf={w} books={f.books} chosen={f.chosen} /> : null;
      })}
      <p className="text-sm text-muted">The email itself is switched on or off as BT1 on the Email page. Changing this week&apos;s stories only affects emails not yet sent.</p>
    </AdultPage>
  );
}
