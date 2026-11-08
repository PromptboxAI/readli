import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonSmall, buttonSmallPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { supportFamily, supportPeople, supportPlan, type SupportPerson } from "@/lib/admin/family-support";
import {
  supportDevices,
  supportHistory,
  supportPlaces,
  supportVoices,
  type SupportDevice,
  type SupportEvent,
  type SupportPin,
  type SupportPlace,
  type SupportVoice,
} from "@/lib/admin/support-people";
import { adminDate, adminDateTime } from "@/lib/admin/time";
import { accountDb } from "@/lib/family/account-store";
import type { FamilyState } from "@/lib/family/model";
import { childVoiceAccess } from "@/lib/family/permissions";
import type { PlanConfig } from "@/lib/family/plan";
import { creditBalance, displayCredits } from "@/lib/narration/credits";
import { READINESS_LABELS, type Readiness } from "@/lib/narration/narration";
import { supportAudiobooks, type SupportBook, type SupportJob, type SupportNarration } from "@/lib/narration/support";
import {
  carryForwardAction,
  clearPinAction,
  prepareFreeAction,
  refundPreparationAction,
  resumePreparationAction,
  signOutDeviceAction,
  stopPreparationAction,
  unlockPinAction,
} from "./actions";

export const metadata: Metadata = { title: "Family | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";
// Prepare and Resume keep a narration worker going after the response, like the family's own book page.
export const maxDuration = 300;

type Params = Record<string, string | string[] | undefined>;
const param = (p: Params, key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");
const ID = /^[0-9a-f-]{36}$/i;

const PLAN_LABEL: Record<string, string> = { subscription: "Paid", gift: "Gift", donated: "Complimentary", trial: "Free trial", tester: "Tester", sponsored: "Sponsored" };
const JOB_STATUS: Record<SupportJob["status"], string> = { queued: "Waiting to start", running: "Preparing", done: "Finished", failed: "Stopped with errors", canceled: "Stopped" };
const TONE: Record<Readiness, string> = { ready: "bg-mint/50", preparing: "bg-sky/40", partial: "bg-sunshine/50", not_prepared: "bg-ink/10" };

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{children}</span>;
}

function Readi({ readiness, ready, total }: { readiness: Readiness; ready: number; total: number }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={TONE[readiness]}>{READINESS_LABELS[readiness]}</Badge>
      <span className="text-xs text-muted">
        {ready} / {total}
      </span>
    </span>
  );
}

/**
 * One family as support sees it (Kevin, 2026-11-08): who's in it, its plan and credits, and every
 * audiobook the way the family's book page shows it, with the fixes support can make.
 */
export default async function FamilyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const { id } = await params;
  const gate = await requireAdmin(`/admin/families/${id}`);
  const qs = await searchParams;
  const ok = param(qs, "ok");
  const err = param(qs, "err");
  const db = gate.preview ? null : accountDb();
  if (!db) {
    return (
      <AdultPage wide>
        <Header name="Family" />
        <PreviewNote>Family support needs sign-in and Supabase connected.</PreviewNote>
      </AdultPage>
    );
  }
  if (!ID.test(id)) notFound();
  const family = await supportFamily(db, id);
  if (!family) notFound();
  const state = await family.store.read();
  const home = state.households.find((h) => h.id === id);
  if (!home) notFound();
  const at = new Date().toISOString();
  const plan = supportPlan(state, id, at);
  const credits = creditBalance(state, family.plan, id, at);
  const people = await supportPeople(db, state, id);
  const books = supportAudiobooks(state, family.plan, id, at);
  const [voices, kidsDevices, history] = await Promise.all([supportVoices(db, state, family.plan, id), supportDevices(db, state, id), supportHistory(db, state, id)]);
  const places = supportPlaces(state, id);
  const c = (units: number) => displayCredits(units, family.plan.charactersPerCredit).toLocaleString("en-US");

  return (
    <AdultPage wide>
      <Header name={home.name} />
      {ok && <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">{ok}</p>}
      {err && <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">{err}</p>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Plan and credits" data-testid="family-summary">
        <Stat label="Plan" value={plan ? (PLAN_LABEL[plan.source] ?? plan.source) : "No plan"} note={plan?.endsAt ? `until ${adminDate(plan.endsAt)}` : plan ? `since ${adminDate(plan.startsAt)}` : undefined} />
        <Stat label="Credits available" value={c(credits.available)} note={credits.held ? `${c(credits.held)} held for preparing` : undefined} />
        <Stat
          label="By kind"
          value={`${c(credits.bySource.subscription + credits.bySource.trial)} monthly`}
          note={`${c(credits.bySource.promotional)} promotional, ${c(credits.bySource.purchased)} purchased`}
        />
        <Stat label="Used this month" value={c(credits.usedThisPeriod)} note={credits.renewsAt ? `renews ${adminDate(credits.renewsAt)}` : undefined} />
      </section>

      <People people={people} />
      <Kids state={state} householdId={id} plan={family.plan} />
      <Voices voices={voices} />
      <Devices householdId={id} devices={kidsDevices.devices} pin={kidsDevices.pin} />
      <Places places={places} />

      <section className="flex flex-col gap-3" aria-labelledby="books-h">
        <h2 id="books-h" className="font-display text-2xl font-semibold">
          Audiobooks
        </h2>
        <p className="text-sm">
          Each book the way the family&apos;s book page shows it. &ldquo;Plays now&rdquo; is what the family hears, which can be an earlier text kept because today&apos;s isn&apos;t
          finished. Every fix here is free for the family, and nothing here deletes audio. 1 credit = {family.plan.charactersPerCredit.toLocaleString("en-US")} characters.
        </p>
        {books.length === 0 ? <p className="text-muted">No audiobooks prepared or asked for yet.</p> : books.map((b) => <Book key={b.slug} book={b} householdId={id} c={c} />)}
      </section>

      <History events={history} />
    </AdultPage>
  );
}

function Header({ name }: { name: string }) {
  return (
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
      <h1 className="font-display text-4xl font-semibold">{name}</h1>
    </header>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {note && <p className="text-sm text-muted">{note}</p>}
    </div>
  );
}

function People({ people }: { people: SupportPerson[] }) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="people-h">
      <h2 id="people-h" className="font-display text-2xl font-semibold">
        Grown-ups
      </h2>
      <div className="overflow-x-auto rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10">
        <table className="w-full min-w-[720px] text-left text-sm" data-testid="family-people">
          <thead>
            <tr className="border-b-2 border-ink/10 text-xs font-bold uppercase tracking-[0.06em] text-muted">
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Joined</th>
              <th className="px-3 py-3">Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-b border-ink/10 last:border-b-0">
                <td className="px-3 py-2">
                  <span className="font-semibold">{p.name}</span>
                  {p.calledHere && <span className="block text-xs text-muted">Called {p.calledHere} here</span>}
                </td>
                <td className="break-all px-3 py-2">
                  {p.email ? (
                    <Link href={`/admin/accounts/${p.id}`} className="underline underline-offset-4">
                      {p.email}
                    </Link>
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                  {p.email && !p.confirmed && <span className="ml-1"><Badge tone="bg-ink/10">Unconfirmed</Badge></span>}
                </td>
                <td className="px-3 py-2">
                  {p.owner ? "Owner (pays)" : p.role === "guardian" ? "Parent" : "Storyteller"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{adminDate(p.joinedAt)}</td>
                <td className="whitespace-nowrap px-3 py-2">{p.lastSignInAt ? adminDate(p.lastSignInAt) : <span className="text-muted">Never</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Kids({ state, householdId, plan }: { state: FamilyState; householdId: string; plan: PlanConfig }) {
  const kids = state.children.filter((k) => k.householdId === householdId && k.deletedAt === null);
  const voices = state.voices.filter((v) => v.deletedAt === null);
  const name = (ownerId: string) => {
    const m = state.members.find((x) => x.householdId === householdId && x.adultId === ownerId && x.removedAt === null);
    return m?.nickname?.trim() || state.adults.find((a) => a.id === ownerId)?.displayName || "A storyteller";
  };
  return (
    <section className="flex flex-col gap-2" aria-labelledby="kids-h">
      <h2 id="kids-h" className="font-display text-2xl font-semibold">
        Kids
      </h2>
      {kids.length === 0 ? (
        <p className="text-muted">No kids profiles.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {kids.map((k) => {
            const hears = voices.filter((v) => childVoiceAccess(state, k.id, v.id, plan).allowed).map((v) => name(v.ownerId));
            return (
              <li key={k.id} className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
                <p className="font-semibold">{k.nickname}</p>
                <p className="text-sm">{hears.length ? `Can hear ${hears.join(", ")}` : <span className="text-muted">Can&apos;t hear any storyteller yet</span>}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Hidden({ householdId, book, extra = {} }: { householdId: string; book: string; extra?: Record<string, string> }) {
  return (
    <>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="book" value={book} />
      {Object.entries(extra).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

function Book({ book, householdId, c }: { book: SupportBook; householdId: string; c: (units: number) => string }) {
  return (
    <article id={`book-${book.slug}`} className="flex scroll-mt-6 flex-col gap-4 rounded-3xl bg-surface p-4 ring-2 ring-ink/10" data-testid="support-book">
      <h3 className="font-display text-xl font-semibold">
        {book.title} <span className="font-mono text-xs font-normal text-muted">today&apos;s text {book.todayRevision}</span>
      </h3>
      {book.narrations.map((n) => (
        <Narration key={n.voiceId} n={n} book={book.slug} householdId={householdId} c={c} />
      ))}
    </article>
  );
}

function Narration({ n, book, householdId, c }: { n: SupportNarration; book: string; householdId: string; c: (units: number) => string }) {
  const running = n.jobs.some((j) => j.status === "queued" || j.status === "running");
  const canPrepare = n.shared && n.voiceStatus === "ready";
  const hidden = (extra: Record<string, string> = {}) => <Hidden householdId={householdId} book={book} extra={{ voiceId: n.voiceId, ...extra }} />;
  return (
    <div className="flex flex-col gap-3 border-t-2 border-ink/10 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">Read by {n.narrator}</p>
        {n.voiceStatus !== "ready" && <Badge tone="bg-coral/30">{n.voiceStatus === "deleted" ? "Voice deleted" : "Voice still being made"}</Badge>}
        {!n.shared && n.voiceStatus === "ready" && <Badge tone="bg-coral/30">Not shared with this family now</Badge>}
        {n.shared && !n.inSlot && <Badge tone="bg-sunshine/50">Not in a narrator slot</Badge>}
        <span className="text-xs text-muted">{n.approvedFor.length ? `Approved for ${n.approvedFor.join(", ")}` : "Not approved for any child"}</span>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Plays now</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <Readi readiness={n.heard.readiness} ready={n.heard.ready} total={n.heard.total} />
            <span>
              {n.heard.current ? "Today's text" : `Earlier text ${n.heard.revision}${n.heard.firstSeen ? ` (from ${adminDate(n.heard.firstSeen)})` : ""}`}
              {n.heard.listenable ? "" : ", can't play from the start yet"}
            </span>
          </dd>
        </div>
        {!n.heard.current && (
          <div>
            <dt className="text-muted">Today&apos;s text</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <Readi readiness={n.today.readiness} ready={n.today.ready} total={n.today.total} />
              {n.today.preparing > 0 && <span>{n.today.preparing} preparing</span>}
            </dd>
          </div>
        )}
      </dl>

      {n.chapters.length > 1 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/20 text-xs font-bold uppercase tracking-[0.06em] text-muted">
                <th className="py-2 pr-3">Chapter</th>
                <th className="py-2 pr-3">Plays now</th>
                {!n.heard.current && <th className="py-2 pr-3">Today&apos;s text</th>}
                <th className="py-2">
                  <span className="sr-only">Fix</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {n.chapters.map((ch) => {
                const todays = n.heard.current ? ch.heard : ch.today;
                return (
                  <tr key={ch.number} className="border-b border-ink/10">
                    <td className="py-2 pr-3">
                      {ch.number}. {ch.title}
                    </td>
                    <td className="py-2 pr-3">{ch.heard ? <Readi readiness={ch.heard.readiness} ready={ch.heard.ready} total={ch.heard.sentences} /> : <span className="text-muted">Not in that text</span>}</td>
                    {!n.heard.current && <td className="py-2 pr-3">{ch.today ? <Readi readiness={ch.today.readiness} ready={ch.today.ready} total={ch.today.sentences} /> : <span className="text-muted">–</span>}</td>}
                    <td className="py-2 text-right">
                      {canPrepare && todays && todays.readiness !== "ready" && todays.readiness !== "preparing" && (
                        <form action={prepareFreeAction}>
                          {hidden({ chapter: String(ch.number) })}
                          <button className={buttonSmall} aria-label={`Prepare chapter ${ch.number} at Readli's cost`}>
                            Prepare free
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {n.carry > 0 && (
          <form action={carryForwardAction}>
            {hidden()}
            <button className={buttonSmallPrimary}>
              Carry {n.carry} prepared {n.carry === 1 ? "sentence" : "sentences"} to today&apos;s text
            </button>
          </form>
        )}
        {canPrepare && n.missing > 0 && !running && (
          <details className="rounded-2xl bg-sunshine/20 px-3 py-2 ring-2 ring-sunshine/40">
            <summary className="cursor-pointer font-semibold">Prepare the whole book at Readli&apos;s cost</summary>
            <form action={prepareFreeAction} className="flex flex-wrap items-center gap-2 pt-2">
              {hidden()}
              <p className="text-sm">
                {n.missing} {n.missing === 1 ? "sentence" : "sentences"} still need audio in today&apos;s text, worth {c(n.missingCredits)} credits. The family isn&apos;t charged.
              </p>
              <button className={buttonSmallPrimary}>Prepare at Readli&apos;s cost</button>
            </form>
          </details>
        )}
      </div>

      {n.jobs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm" data-testid="support-jobs">
            <thead>
              <tr className="border-b border-ink/20 text-xs font-bold uppercase tracking-[0.06em] text-muted">
                <th className="py-2 pr-3">Preparation</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Sentences</th>
                <th className="py-2 pr-3">Credits</th>
                <th className="py-2">
                  <span className="sr-only">Fix</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {n.jobs.map((j) => (
                <Job key={j.id} j={j} hidden={hidden} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Job({ j, hidden, c }: { j: SupportJob; hidden: (extra?: Record<string, string>) => React.ReactNode; c: (units: number) => string }) {
  const running = j.status === "queued" || j.status === "running";
  return (
    <tr className="border-b border-ink/10 align-top">
      <td className="py-2 pr-3">
        <span className="block">{j.scope === "chapter" && j.chapter ? `Chapter ${j.chapter.number}` : j.scope === "passage" ? "A passage" : "Whole book"}</span>
        <span className="block text-xs text-muted">
          {adminDateTime(j.createdAt)} by {j.requestedBy} · text <span className="font-mono">{j.revision}</span>
        </span>
      </td>
      <td className="py-2 pr-3">
        <span className="flex flex-wrap gap-1">
          <span>{JOB_STATUS[j.status]}</span>
          {j.stuck && <Badge tone="bg-coral/30">Stuck</Badge>}
        </span>
        {j.lastStoredAt && <span className="block text-xs text-muted">last stored {adminDateTime(j.lastStoredAt)}</span>}
        {j.error && <span className="block text-xs text-coral-deep">{j.error}</span>}
      </td>
      <td className="py-2 pr-3">
        {j.ready} / {j.sentences}
      </td>
      <td className="py-2 pr-3">
        {j.free ? (
          <Badge tone="bg-mint/50">Readli paid</Badge>
        ) : running ? (
          <span>{c(j.held)} held</span>
        ) : (
          <span>
            {c(j.committed)} used{j.refunded > 0 && <span className="text-muted">, {c(j.refunded)} returned</span>}
          </span>
        )}
        {j.supportRefund > 0 && <span className="block text-xs font-semibold">Refunded {c(j.supportRefund)} by support</span>}
      </td>
      <td className="py-2">
        <span className="flex flex-wrap justify-end gap-2">
          {running && (
            <>
              <form action={resumePreparationAction}>
                {hidden({ jobId: j.id })}
                <button className={buttonSmall}>Resume</button>
              </form>
              <form action={stopPreparationAction}>
                {hidden({ jobId: j.id })}
                <button className={buttonSmall}>Stop</button>
              </form>
            </>
          )}
          {!running && j.committed > 0 && j.supportRefund === 0 && (
            <details>
              <summary className="cursor-pointer font-semibold underline underline-offset-4">Refund</summary>
              <form action={refundPreparationAction} className="flex flex-col items-end gap-2 pt-2">
                {hidden({ jobId: j.id })}
                <span className="max-w-xs text-right text-xs">Gives back {c(j.committed)} credits that never expire. The audio stays.</span>
                <button className={buttonSmallPrimary}>Refund {c(j.committed)} credits</button>
              </form>
            </details>
          )}
        </span>
      </td>
    </tr>
  );
}

function Voices({ voices }: { voices: SupportVoice[] }) {
  return (
    <section id="voices" className="flex scroll-mt-6 flex-col gap-2" aria-labelledby="voices-h">
      <h2 id="voices-h" className="font-display text-2xl font-semibold">
        Storyteller voices
      </h2>
      <p className="text-sm">
        A kid hears a voice only when its owner shares it with the family, the family puts it in a narrator slot, and a parent approves it for that kid. Consent is the
        owner&apos;s recorded agreement to make the voice.
      </p>
      {voices.length === 0 ? (
        <p className="text-muted">No voices yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10">
          <table className="w-full min-w-[820px] text-left text-sm" data-testid="family-voices">
            <thead>
              <tr className="border-b-2 border-ink/10 text-xs font-bold uppercase tracking-[0.06em] text-muted">
                <th className="px-3 py-3">Voice</th>
                <th className="px-3 py-3">Shared here</th>
                <th className="px-3 py-3">Slot</th>
                <th className="px-3 py-3">Approved for</th>
                <th className="px-3 py-3">Consent</th>
              </tr>
            </thead>
            <tbody>
              {voices.map((v) => (
                <tr key={v.id} className="border-b border-ink/10 align-top last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="block font-semibold">{v.owner}</span>
                    <span className="block text-xs text-muted">
                      {v.status === "ready" ? "Ready" : v.status === "deleted" ? "Deleted" : "Still being made"} · recording {v.version} · made {adminDate(v.createdAt)}
                      {v.modelId ? ` · ${v.modelId}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {v.sharedSince ? `Since ${adminDate(v.sharedSince)}` : v.unsharedAt ? <span className="text-coral-deep">Stopped {adminDate(v.unsharedAt)}</span> : <span className="text-muted">Never</span>}
                  </td>
                  <td className="px-3 py-2">{v.inSlot ? "Yes" : <span className="text-muted">No</span>}</td>
                  <td className="px-3 py-2">{v.approvedFor.length ? v.approvedFor.join(", ") : <span className="text-muted">No one</span>}</td>
                  <td className="px-3 py-2">
                    {v.consent ? (
                      <>
                        <span className="block">
                          {v.consent.revokedAt ? <span className="text-coral-deep">Withdrawn {adminDate(v.consent.revokedAt)}</span> : `Given ${adminDate(v.consent.capturedAt)}`}
                        </span>
                        <span className="block text-xs text-muted">policy {v.consent.policyVersion}</span>
                      </>
                    ) : (
                      <span className="text-muted">None on file</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const DEVICE_STATUS: Record<SupportDevice["status"], string> = { active: "Signed in", revoked: "Signed out", expired: "Expired (unused)" };

function Devices({ householdId, devices, pin }: { householdId: string; devices: SupportDevice[]; pin: SupportPin }) {
  const locked = Boolean(pin.lockedUntil) || pin.failures > 0 || devices.some((d) => d.pinLockedUntil || d.failedPinAttempts > 0);
  const hidden = (extra: Record<string, string> = {}) => (
    <>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="section" value="devices" />
      {Object.entries(extra).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
  return (
    <section id="devices" className="flex scroll-mt-6 flex-col gap-2" aria-labelledby="devices-h">
      <h2 id="devices-h" className="font-display text-2xl font-semibold">
        Kids Mode and devices
      </h2>
      <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-surface p-4 ring-2 ring-ink/10" data-testid="family-pin">
        <p className="mr-auto text-sm">
          <strong>Grown-up PIN:</strong> {pin.set ? `set${pin.updatedAt ? ` ${adminDate(pin.updatedAt)}` : ""}` : "not set"}
          {pin.lockedUntil && <> · <span className="text-coral-deep">locked until {adminDateTime(pin.lockedUntil)}</span></>}
          {!pin.lockedUntil && pin.failures > 0 && <> · {pin.failures} wrong {pin.failures === 1 ? "try" : "tries"}</>}
        </p>
        {locked && (
          <form action={unlockPinAction}>
            {hidden()}
            <button className={buttonSmall}>Clear lockout</button>
          </form>
        )}
        {pin.set && (
          <details>
            <summary className="cursor-pointer font-semibold underline underline-offset-4">Forget PIN</summary>
            <form action={clearPinAction} className="flex flex-col items-end gap-2 pt-2">
              {hidden()}
              <span className="max-w-xs text-right text-xs">For a parent who forgot it. They set a new one in Settings, Kids Mode. Until then, leaving Readli Kids needs a grown-up to sign in.</span>
              <button className={buttonSmallPrimary}>Forget the PIN</button>
            </form>
          </details>
        )}
      </div>
      {devices.length === 0 ? (
        <p className="text-muted">No kids devices set up.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10">
          <table className="w-full min-w-[760px] text-left text-sm" data-testid="family-devices">
            <thead>
              <tr className="border-b-2 border-ink/10 text-xs font-bold uppercase tracking-[0.06em] text-muted">
                <th className="px-3 py-3">Device</th>
                <th className="px-3 py-3">Kids</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Last used</th>
                <th className="px-3 py-3">
                  <span className="sr-only">Fix</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-ink/10 align-top last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="block font-semibold">{d.label}</span>
                    <span className="block text-xs text-muted">
                      set up by {d.registeredBy}, {adminDate(d.createdAt)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {d.kids.join(", ") || <span className="text-muted">–</span>}
                    {d.listening && <span className="block text-xs text-muted">{d.listening} is on it</span>}
                  </td>
                  <td className="px-3 py-2">
                    {DEVICE_STATUS[d.status]}
                    {d.pinLockedUntil && <span className="block text-xs text-coral-deep">PIN locked until {adminDateTime(d.pinLockedUntil)}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{adminDateTime(d.lastSeenAt)}</td>
                  <td className="px-3 py-2 text-right">
                    {d.status === "active" && (
                      <form action={signOutDeviceAction}>
                        {hidden({ deviceId: d.id })}
                        <button className={buttonSmall} aria-label={`Sign out ${d.label}`}>
                          Sign out
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Places({ places }: { places: SupportPlace[] }) {
  if (places.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="places-h">
      <details>
        <summary className="cursor-pointer">
          <h2 id="places-h" className="inline font-display text-2xl font-semibold">
            Reading places ({places.length})
          </h2>
        </summary>
        <div className="mt-2 overflow-x-auto rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10">
          <table className="w-full min-w-[640px] text-left text-sm" data-testid="family-places">
            <thead>
              <tr className="border-b-2 border-ink/10 text-xs font-bold uppercase tracking-[0.06em] text-muted">
                <th className="px-3 py-3">Kid</th>
                <th className="px-3 py-3">Book</th>
                <th className="px-3 py-3">Place</th>
                <th className="px-3 py-3">Narrator</th>
                <th className="px-3 py-3">Last listened</th>
              </tr>
            </thead>
            <tbody>
              {places.map((p, i) => (
                <tr key={`${p.kid}-${p.book}-${i}`} className="border-b border-ink/10 last:border-b-0">
                  <td className="px-3 py-2">{p.kid}</td>
                  <td className="px-3 py-2">{p.book}</td>
                  <td className="px-3 py-2">
                    sentence {p.sentence}
                    {p.of ? ` of ${p.of}` : ""}
                  </td>
                  <td className="px-3 py-2">{p.narrator ?? <span className="text-muted">–</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2">{adminDateTime(p.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function History({ events }: { events: SupportEvent[] }) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="history-h">
      <h2 id="history-h" className="font-display text-2xl font-semibold">
        History
      </h2>
      <p className="text-sm">The family&apos;s sharing, approvals and slot changes, and every support action on this family, newest first.</p>
      {events.length === 0 ? (
        <p className="text-muted">Nothing recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm" data-testid="family-history">
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex flex-wrap gap-x-2">
              <span className="whitespace-nowrap text-muted">{adminDateTime(e.at)}</span>
              {e.bySupport && <Badge tone="bg-sky/40">Support</Badge>}
              <span>
                <strong>{e.who}</strong> {e.what}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
