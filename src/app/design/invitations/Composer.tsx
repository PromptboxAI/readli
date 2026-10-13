"use client";

import { useState } from "react";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { SamplePlayer } from "./SamplePlayer";

const RELATIONSHIPS = ["Son or daughter", "Grandchild's parent", "Sibling", "Niece or nephew", "Friend of the family", "Other"];
const MAX_PER_SEND = 10;
const input = "w-full rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/20 focus:outline-none focus:ring-ink";

interface Recipient {
  name: string;
  relationship: string;
  email: string;
}

/** Invitation composer: several adults at once, an optional note, and the approved preview sample. */
export function Composer() {
  const [people, setPeople] = useState<Recipient[]>([
    { name: "Sara", relationship: "Son or daughter", email: "sara@example.com" },
    { name: "", relationship: "", email: "" },
  ]);
  const [adults, setAdults] = useState(false);
  const set = (i: number, patch: Partial<Recipient>) => setPeople((ps) => ps.map((p, j) => (i === j ? { ...p, ...patch } : p)));
  const ready = adults && people.some((p) => /\S+@\S+\.\S+/.test(p.email));

  return (
    <form className="flex flex-col gap-6 rounded-[var(--radius-panel)] bg-sky/30 p-5 sm:p-8" onSubmit={(e) => e.preventDefault()} data-testid="invite-composer">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 font-display text-xl font-semibold">Who would you like to invite?</legend>
        {people.map((p, i) => (
          <div key={i} className="grid gap-3 rounded-3xl bg-surface/70 p-4 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Name (optional)</span>
              <input className={input} value={p.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Sara" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Relationship (optional)</span>
              <select className={input} value={p.relationship} onChange={(e) => set(i, { relationship: e.target.value })}>
                <option value="">Choose…</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Email</span>
              <input className={input} type="email" value={p.email} onChange={(e) => set(i, { email: e.target.value })} placeholder="name@example.com" />
            </label>
            <button
              type="button"
              className={`${buttonQuiet} min-h-11 px-3 text-base`}
              onClick={() => setPeople((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : ps))}
              aria-label={`Remove person ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className={`${buttonSecondary} w-fit`}
          disabled={people.length >= MAX_PER_SEND}
          onClick={() => setPeople((ps) => [...ps, { name: "", relationship: "", email: "" }])}
        >
          Add another person
        </button>
        <p className="text-sm text-muted">Up to {MAX_PER_SEND} people at a time. Readli never looks at or emails your contacts.</p>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-display text-xl font-semibold">A note from you (optional)</span>
        <textarea className={input} rows={3} maxLength={300} defaultValue="I recorded my voice so I can read the kids their bedtime stories, even from far away. Love, Mom" />
        <span className="text-sm text-muted">Shown in the email and on your preview page.</span>
      </label>

      <div className="flex flex-col gap-3">
        <h3 className="font-display text-xl font-semibold">What they&apos;ll hear</h3>
        <SamplePlayer label="“Once upon a time, there were three little pigs…”" />
        <p className="text-sm">
          Your approved preview sample. It was made with your Readli voice and you can change it any time. Your original recordings are never shared.{" "}
          <a href="#" className="font-semibold underline underline-offset-4">
            Choose a different sample
          </a>
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-2xl bg-surface p-4">
        <input type="checkbox" className="mt-1 size-5 accent-coral-deep" checked={adults} onChange={(e) => setAdults(e.target.checked)} />
        <span>Everyone I&apos;m inviting is an adult (18 or older), and I know them personally.</span>
      </label>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button className={buttonPrimary} disabled={!ready}>
          Send invitations
        </button>
        <p className="text-sm text-muted">Links expire after 14 days. Each person can decline or unsubscribe in one tap.</p>
      </div>
    </form>
  );
}
