"use client";

import { useId, useMemo, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { chargeCopy, chargeSchedule, dollars, shortDate, SPONSORED, zonedTime, type SponsorPlan } from "@/lib/sponsorship/rules";

const field = "min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink";
const choice = (on: boolean) =>
  `flex cursor-pointer flex-col gap-1 rounded-3xl p-5 ring-[3px] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-coral-deep ${on ? "-translate-y-0.5 ring-ink" : "ring-transparent"}`;

interface Family {
  name: string;
  email: string;
  shareVoice: boolean;
}

/** The next Christmas morning that's still ahead, as YYYY-MM-DD. */
function christmas(today: string): string {
  const year = Number(today.slice(0, 4));
  return today <= `${year}-12-25` ? `${year}-12-25` : `${year + 1}-12-25`;
}

/**
 * Give Readli Family to up to two families. The year is featured for Christmas; every line that makes
 * a promise (what's charged today, what it covers, when it renews) uses the approved copy with real dates.
 */
export function GiveFamilyForm({ today, hasVoice, defaultGiverName }: { today: string; hasVoice: boolean; defaultGiverName: string }) {
  const id = useId();
  const [plan, setPlan] = useState<SponsorPlan>("annual");
  const [families, setFamilies] = useState<Family[]>([{ name: "", email: "", shareVoice: hasVoice }]);
  const [giverName, setGiverName] = useState(defaultGiverName);
  const [message, setMessage] = useState("");
  const xmas = christmas(today);
  const [when, setWhen] = useState<"christmas" | "now" | "date">(today <= xmas && xmas !== today ? "christmas" : "now");
  const [date, setDate] = useState(xmas);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const deliverOn = when === "now" ? "now" : when === "christmas" ? xmas : date;
  const deliverAt = useMemo(() => (deliverOn === "now" ? new Date() : (zonedTime(deliverOn, timeZone, SPONSORED.deliveryHour) ?? new Date())), [deliverOn, timeZone]);
  const schedule = chargeSchedule(plan, deliverAt);
  const year = chargeCopy("annual", deliverAt);
  const monthly = chargeCopy("monthly", deliverAt);
  const sharesVoice = families.some((f) => f.shareVoice);
  const arrives = when === "now" ? "Right away" : `${shortDate(deliverAt)}, 7:00 a.m.`;

  const update = (i: number, patch: Partial<Family>) => setFamilies(families.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/sponsorships", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan, deliverOn, timeZone, giverName, message, recipients: families, voiceConsent: consent }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { url?: string; error?: { message?: string } } | undefined;
    if (res?.ok && json?.url) window.location.assign(json.url);
    else {
      setError(json?.error?.message ?? "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-label="Give Readli Family">
      <div className="flex flex-col gap-8">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-display text-2xl font-semibold">1. Choose how to give</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`${choice(plan === "annual")} bg-sunshine/60`}>
              <input type="radio" name="plan" value="annual" checked={plan === "annual"} onChange={() => setPlan("annual")} className="sr-only" />
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-xl font-semibold">A whole year · {dollars(SPONSORED.annualCents)}</span>
                <span className="rounded-full bg-coral-deep px-3 py-1 text-xs font-bold text-white">Best for Christmas</span>
              </span>
              <span>Paid today. Starts the day it arrives. Doesn&apos;t renew unless you choose to.</span>
              <span className="sr-only">{year.choice}</span>
            </label>
            <label className={`${choice(plan === "monthly")} bg-lavender/50`}>
              <input type="radio" name="plan" value="monthly" checked={plan === "monthly"} onChange={() => setPlan("monthly")} className="sr-only" />
              <span className="font-display text-xl font-semibold">Monthly · {dollars(SPONSORED.monthlyCents)}</span>
              <span>
                First month paid today. Then {dollars(SPONSORED.monthlyCents)} each month from {shortDate(chargeSchedule("monthly", deliverAt).nextChargeAt!)} until you cancel.
              </span>
              <span className="sr-only">{monthly.choice}</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-display text-2xl font-semibold">2. Add up to two families</legend>
          {families.map((f, i) => (
            <div key={i} className="grid gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10 sm:grid-cols-2">
              <label className="flex flex-col gap-1 font-semibold" htmlFor={`${id}-name-${i}`}>
                Family name
                <input id={`${id}-name-${i}`} className={field} value={f.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Michael and Sarah" required maxLength={120} autoComplete="off" />
              </label>
              <label className="flex flex-col gap-1 font-semibold" htmlFor={`${id}-email-${i}`}>
                A parent&apos;s email
                <input id={`${id}-email-${i}`} type="email" className={field} value={f.email} onChange={(e) => update(i, { email: e.target.value })} required autoComplete="off" />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" className="size-5" checked={f.shareVoice} disabled={!hasVoice} onChange={(e) => update(i, { shareVoice: e.target.checked })} />
                Share my voice with this family
              </label>
              {families.length > 1 && (
                <button type="button" className="justify-self-start text-sm font-semibold underline underline-offset-4" onClick={() => setFamilies(families.filter((_, j) => j !== i))}>
                  Remove this family
                </button>
              )}
            </div>
          ))}
          {families.length < SPONSORED.households && (
            <button type="button" className={`${buttonSecondary} self-start`} onClick={() => setFamilies([...families, { name: "", email: "", shareVoice: hasVoice }])}>
              Add a second family
            </button>
          )}
          <p className="text-sm">Their parents add the children and decide who each child hears, you included. You won&apos;t see or manage the children&apos;s profiles.</p>
          {!hasVoice && <p className="text-sm text-muted">Record your Readli voice first if you&apos;d like to share it with them. You can still give the gift without it.</p>}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-display text-2xl font-semibold">3. Your name and message</legend>
          <label className="flex flex-col gap-1 font-semibold" htmlFor={`${id}-from`}>
            How the families know you
            <input id={`${id}-from`} className={field} value={giverName} onChange={(e) => setGiverName(e.target.value)} placeholder="Grandma Ruth" required maxLength={120} />
          </label>
          <label className="flex flex-col gap-1 font-semibold" htmlFor={`${id}-msg`}>
            A note for them <span className="font-normal text-muted">(optional)</span>
            <textarea
              id={`${id}-msg`}
              rows={3}
              maxLength={300}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-2xl border-[3px] border-ink/20 bg-surface p-4 text-lg font-normal focus:border-ink"
              placeholder="Merry Christmas, my darlings. Now I can read to you every night, wherever you are."
            />
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-display text-2xl font-semibold">4. When should it arrive?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["christmas", `Christmas morning · ${shortDate(new Date(`${xmas}T12:00:00Z`)).replace(/, \d{4}$/, "")}`],
                ["now", "Send it now"],
                ["date", "Pick another date"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-2xl px-3 text-center font-display ring-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-coral-deep ${when === v ? "bg-sky/60 ring-ink" : "bg-surface ring-ink/15"}`}>
                <input type="radio" name="when" value={v} checked={when === v} onChange={() => setWhen(v)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          {when === "date" && <input aria-label="Delivery date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={field} required />}
          <p className="text-sm text-muted">It arrives at 7:00 a.m. your time on the day you choose.</p>
        </fieldset>
      </div>

      <aside className="flex flex-col gap-4 self-start rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 lg:sticky lg:top-6" aria-labelledby={`${id}-sum`}>
        <h2 id={`${id}-sum`} className="font-display text-2xl font-semibold">
          Your gift
        </h2>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
          <dt className="text-muted">Plan</dt>
          <dd>Readli Family, {plan === "annual" ? "a whole year" : "monthly"}</dd>
          <dt className="text-muted">Families</dt>
          <dd>{families.length}</dd>
          <dt className="text-muted">Arrives</dt>
          <dd>{arrives}</dd>
          <dt className="text-muted">Covers</dt>
          <dd>
            {shortDate(schedule.accessStarts)} to {shortDate(schedule.lastDay)}
          </dd>
          <dt className="font-semibold">Charged today</dt>
          <dd className="font-semibold">{dollars(schedule.chargedTodayCents)}</dd>
        </dl>
        <p className="text-sm font-semibold" data-testid="renewal-terms">
          {plan === "annual" ? "No automatic renewal. We'll ask you before the year ends." : monthly.renewal}
        </p>
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold">Each family gets</p>
          <ul className="list-disc pl-5">
            <li>Your voice, once their parents approve it, plus one more storyteller</li>
            <li>Up to 6 children with their own profiles</li>
            <li>2 children listening at once</li>
          </ul>
        </div>
        <p className="text-sm">
          <span className="font-semibold">Story credits. </span>
          Your gift includes 40 story credits a month, shared between your {families.length === 1 ? "families" : "two families"}: 20 each to start. You can change the split for future months. You&apos;ll see how many each family uses, never which stories.
        </p>
        {sharesVoice && (
          <label className="flex items-start gap-2 rounded-2xl bg-ivory p-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            I agree to share my Readli voice with each family I chose. Their parents decide whether each child hears it, and I can stop sharing at any time.
          </label>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-coral/20 px-4 py-3 text-sm">
            {error}
          </p>
        )}
        <button type="submit" className={buttonPrimary} disabled={busy}>
          {busy ? "Opening checkout…" : "Continue to payment"}
        </button>
        <div className="text-sm">
          <p className="font-semibold">If you stop the gift</p>
          <p>
            Cancel before it arrives and you get a full refund. After that, the families keep Readli to the end of what you paid for. Their children&apos;s profiles, approvals and progress stay with them, and
            each family can continue with its own plan.
          </p>
        </div>
      </aside>
    </form>
  );
}
