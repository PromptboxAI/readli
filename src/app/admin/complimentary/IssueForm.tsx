"use client";

import { useActionState, useEffect, useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import {
  COMPLIMENTARY_KIND_LABELS,
  COMPLIMENTARY_KINDS,
  COMPLIMENTARY_MONTHS,
  DEFAULT_COMPLIMENTARY_MONTHS,
  MAX_CODES_PER_BATCH,
  type ComplimentaryKind,
} from "@/lib/admin/complimentary-kinds";
import { complimentaryHeadline, presentedLine } from "@/lib/gifting/complimentary-copy";
import { issueComplimentaryAction, type IssueResult } from "./actions";

const input = "w-full rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/20 focus:ring-ink disabled:opacity-55";
const legend = "mb-2 font-display text-lg font-semibold";
const hint = "text-sm text-muted";

/** Issues a batch of complimentary memberships (approved design, 2026-10-22). Success opens the batch page. */
export function IssueForm({ defaultClaimBy }: { defaultClaimBy: string }) {
  const [result, action, pending] = useActionState<IssueResult, FormData>(issueComplimentaryAction, null);
  // One key per visit to the form: submitting twice returns the same batch instead of a second one.
  const [requestKey, setRequestKey] = useState("");
  useEffect(() => setRequestKey(crypto.randomUUID()), []);
  const [months, setMonths] = useState<number>(DEFAULT_COMPLIMENTARY_MONTHS);
  const [sponsor, setSponsor] = useState<"readli" | "organization">("readli");
  const [organization, setOrganization] = useState("");
  const [occasion, setOccasion] = useState<ComplimentaryKind>("raffle");
  const [eventName, setEventName] = useState("");
  const [recipient, setRecipient] = useState<"unknown" | "named">("unknown");
  const [count, setCount] = useState(1);
  const n = recipient === "named" ? 1 : Math.max(1, Math.min(MAX_CODES_PER_BATCH, count || 1));

  const preview = {
    headline: complimentaryHeadline({ months, occasion }),
    line: presentedLine({ sponsorName: organization.trim() || "[organization]", sponsorIsReadli: sponsor === "readli", eventName: eventName.trim() || null }),
  };

  return (
    <form action={action} className="grid gap-x-6 gap-y-6 rounded-[var(--radius-panel)] bg-sky/30 p-5 sm:grid-cols-2 sm:p-7" data-testid="complimentary-form">
      <input type="hidden" name="requestKey" value={requestKey} />

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className={legend}>Membership length</legend>
        <div className="flex flex-wrap gap-2">
          {COMPLIMENTARY_MONTHS.map((m) => (
            <label
              key={m}
              className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl px-5 font-bold ${months === m ? "bg-ink text-ivory" : "bg-surface ring-2 ring-ink/20"}`}
            >
              <input type="radio" name="months" value={m} checked={months === m} onChange={() => setMonths(m)} />
              {m === 1 ? "1 month" : `${m} months`}
            </label>
          ))}
        </div>
        <p className={hint}>Readli Family for the whole term: 2 storyteller slots, 40 narration credits a month, up to 6 kids&apos; profiles.</p>
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className={legend}>Presented by</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name="sponsor" value="readli" checked={sponsor === "readli"} onChange={() => setSponsor("readli")} /> Readli
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name="sponsor" value="organization" checked={sponsor === "organization"} onChange={() => setSponsor("organization")} /> Another organization
        </label>
        <input
          name="organization"
          aria-label="Organization name"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          disabled={sponsor === "readli"}
          maxLength={120}
          placeholder="e.g. Oak Street PTA"
          className={input}
        />
      </fieldset>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-display text-lg font-semibold">Occasion</span>
          <select name="occasion" value={occasion} onChange={(e) => setOccasion(e.target.value as ComplimentaryKind)} className={input}>
            {COMPLIMENTARY_KINDS.map((k) => (
              <option key={k} value={k}>
                {COMPLIMENTARY_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">
            Event or fundraiser name <span className="font-normal text-muted">(optional)</span>
          </span>
          <input name="eventName" value={eventName} onChange={(e) => setEventName(e.target.value)} maxLength={120} placeholder="Mount Elementary Basket Dinner" className={input} />
        </label>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className={legend}>Who receives it</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name="recipient" value="unknown" checked={recipient === "unknown"} onChange={() => setRecipient("unknown")} /> Unknown winner (raffle, auction, basket)
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name="recipient" value="named" checked={recipient === "named"} onChange={() => setRecipient("named")} /> A named adult
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="recipientName" aria-label="Recipient name" disabled={recipient !== "named"} maxLength={120} placeholder="Name" className={input} />
          <input name="recipientEmail" aria-label="Recipient email" type="email" disabled={recipient !== "named"} maxLength={254} placeholder="Email (optional)" className={input} />
        </div>
        <p className={hint}>Named memberships are one at a time. We never guess a family name.</p>
      </fieldset>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-display text-lg font-semibold">How many memberships</span>
          <input
            name="count"
            type="number"
            min={1}
            max={MAX_CODES_PER_BATCH}
            value={n}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={recipient === "named"}
            required
            className={`${input} w-36`}
          />
          <span className={hint}>Up to {MAX_CODES_PER_BATCH}. Each gets its own one-time code, QR code and certificate.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">Claim by</span>
          <input name="claimBy" type="date" defaultValue={defaultClaimBy} required className={`${input} w-56`} />
          <span className={hint}>Unclaimed codes stop working after this date. The membership starts when it&apos;s claimed.</span>
        </label>
      </div>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-bold">
          A note for the winner <span className="font-normal text-muted">(optional, shown on the gift page and certificate)</span>
        </span>
        <textarea name="message" maxLength={300} rows={2} placeholder="Thank you for supporting Mount Elementary!" className={input} />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-bold">
          Internal label <span className="font-normal text-muted">(admin only, never shown to the winner)</span>
        </span>
        <input name="label" maxLength={120} placeholder="Mount Elementary raffle, Oct 2026" className={input} />
      </label>

      <div className="flex flex-col gap-1 rounded-2xl bg-surface p-5 sm:col-span-2" aria-live="polite">
        <p className="text-sm font-bold uppercase tracking-[0.08em] text-muted">The winner will see</p>
        <p className="font-display text-2xl font-semibold">{preview.headline}</p>
        <p>{preview.line}</p>
      </div>

      {recipient === "named" && <input type="hidden" name="count" value="1" />}
      {result?.error && (
        <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3 sm:col-span-2">
          {result.error}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        <button className={`${buttonPrimary} w-fit`} disabled={pending}>
          {pending ? "Issuing…" : `Issue ${n} ${n === 1 ? "membership" : "memberships"}`}
        </button>
        <span className={hint}>Issuing never attaches your voice, family or recordings.</span>
      </div>
    </form>
  );
}
