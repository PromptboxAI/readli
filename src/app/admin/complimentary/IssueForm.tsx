"use client";

import { useActionState, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { COMPLIMENTARY_KIND_LABELS, COMPLIMENTARY_KINDS, MAX_CODES_PER_BATCH } from "@/lib/admin/complimentary-kinds";
import { issueComplimentaryAction, type IssueResult } from "./actions";

const input = "w-full rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/20 focus:ring-ink";

/** Issues complimentary memberships and shows their links once. */
export function IssueForm() {
  const [result, action, pending] = useActionState<IssueResult, FormData>(issueComplimentaryAction, null);
  const [copied, setCopied] = useState(false);
  const links = result && "links" in result ? result.links : null;

  async function copy() {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.join("\n"));
      setCopied(true);
    } catch {
      /* Clipboard blocked; the links are visible to copy by hand. */
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="grid gap-4 rounded-[var(--radius-panel)] bg-sky/30 p-6 sm:grid-cols-2" data-testid="complimentary-form">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="font-display font-semibold">Who they&apos;re for</span>
          <input name="organization" required maxLength={120} placeholder="Oak Street Elementary" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-display font-semibold">Kind</span>
          <select name="kind" required className={input} defaultValue="school">
            {COMPLIMENTARY_KINDS.map((k) => (
              <option key={k} value={k}>
                {COMPLIMENTARY_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-display font-semibold">How many families</span>
          <input name="count" type="number" min={1} max={MAX_CODES_PER_BATCH} defaultValue={1} required className={input} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="font-display font-semibold">A note for families (optional)</span>
          <textarea name="message" maxLength={300} rows={2} className={input} />
        </label>
        <button className={`${buttonPrimary} w-fit`} disabled={pending}>
          {pending ? "Issuing…" : "Issue memberships"}
        </button>
      </form>

      {result && "error" in result && (
        <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">
          {result.error}
        </p>
      )}
      {links && (
        <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-mint/40 p-6" aria-labelledby="issued-h">
          <h2 id="issued-h" className="font-display text-2xl font-semibold">
            {links.length === 1 ? "1 membership" : `${links.length} memberships`} for {result && "organization" in result ? result.organization : ""}
          </h2>
          <p>Copy these now: Readli keeps only a scrambled copy, so they can&apos;t be shown again. Each link works once and must be opened within a year.</p>
          <ul className="flex flex-col gap-1 break-all rounded-2xl bg-surface p-3 font-mono text-sm">
            {links.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <button type="button" className={`${buttonSecondary} w-fit`} onClick={copy}>
            {copied ? "Links copied" : "Copy all links"}
          </button>
        </section>
      )}
    </div>
  );
}
