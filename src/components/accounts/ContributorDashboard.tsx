"use client";

import Link from "next/link";
import { useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { CONTRIBUTOR_HOUSEHOLD_MAX_ADULTS } from "@/lib/accounts/accounts";
import { DEFAULT_PLAN, formatPrice } from "@/lib/family/plan";

interface Family {
  id: string;
  name: string;
  invitedBy: string;
  state: "requested" | "shared" | "declined" | "stopped";
  /** Whether that family has put the voice in one of its narrator slots. Their slot, their bill. */
  activeNarrator: boolean;
}

const START: Family[] = [
  { id: "okafor", name: "The Okafor family", invitedBy: "Ben", state: "requested", activeNarrator: false },
  { id: "rivera", name: "Sara's family", invitedBy: "Sara", state: "shared", activeNarrator: true },
  { id: "chen", name: "Priya's family", invitedBy: "Priya", state: "shared", activeNarrator: false },
];

/** Free Readli Voice dashboard: one voice, shared by reference with any number of families. */
export function ContributorDashboard({ invited = false }: { invited?: boolean }) {
  const [families, setFamilies] = useState(START);
  const [voice, setVoice] = useState<"ready" | "deleted">("ready");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [note, setNote] = useState("");

  const set = (id: string, state: Family["state"]) =>
    setFamilies((fs) => fs.map((f) => (f.id === id ? { ...f, state, activeNarrator: state === "shared" ? f.activeNarrator : false } : f)));
  const requests = families.filter((f) => f.state === "requested");
  const shared = families.filter((f) => f.state === "shared");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-4">
        <ReadiMascot size={96} decorative />
        <div>
          <p className="font-display font-semibold text-coral-deep">Readli Voice · Free</p>
          <h1 className="font-display text-4xl font-semibold">Hi, Grandma June</h1>
        </div>
      </header>

      <section aria-labelledby="my-voice" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-lavender/40 p-6 sm:p-8">
        <h2 id="my-voice" className="font-display text-2xl font-semibold">
          Your voice
        </h2>
        {voice === "ready" ? (
          <>
            <p>
              <span className="rounded-full bg-mint px-3 py-1 font-display text-sm font-semibold">Verified and ready</span>
            </p>
            <p>One voice, yours alone. Families you approve use this same voice; it&apos;s never copied for each family.</p>
            {confirmDelete ? (
              <div className="flex flex-col gap-3 rounded-2xl bg-coral/20 p-4">
                <p className="font-semibold">
                  Delete your voice? No new stories can be made in it and families can&apos;t add it as a narrator. Stories they&apos;ve already
                  prepared in your voice stay with them.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={buttonPrimary}
                    onClick={() => {
                      setVoice("deleted");
                      setFamilies((fs) => fs.map((f) => ({ ...f, activeNarrator: false })));
                      setConfirmDelete(false);
                    }}
                  >
                    Delete my voice entirely
                  </button>
                  <button type="button" className={buttonSecondary} onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button type="button" className={buttonSecondary} onClick={() => setNote("Preview: your short sample would play here.")}>
                  Play my preview
                </button>
                <Link href="/voice/record" className={buttonSecondary}>
                  Re-record my voice
                </Link>
                <button type="button" className={buttonQuiet} onClick={() => setConfirmDelete(true)}>
                  Delete my voice entirely
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p>Your voice is deleted, so no new stories can be made in it. Stories families already prepared keep playing for them. You can record a new one whenever you like.</p>
            <Link href="/voice/record" className={buttonPrimary}>
              Record my voice
            </Link>
          </div>
        )}
        {note && (
          <p role="status" className="rounded-2xl bg-surface p-3 text-sm">
            {note}
          </p>
        )}
      </section>

      <section aria-labelledby="requests" className="flex flex-col gap-4" data-testid="sharing-requests">
        <h2 id="requests" className="font-display text-2xl font-semibold">
          Sharing requests {requests.length > 0 && <span className="rounded-full bg-coral px-2 font-display text-lg text-white">{requests.length}</span>}
        </h2>
        {requests.length === 0 && <p className="text-muted">No new requests.</p>}
        {requests.map((f) => (
          <article key={f.id} className={`flex flex-col gap-3 rounded-3xl bg-sunshine/60 p-5 ${invited ? "ring-[3px] ring-ink" : ""}`}>
            <h3 className="font-display text-xl font-semibold">{f.name}</h3>
            <p>
              {f.invitedBy} would like their kids to hear you read. If you say yes, their parents can choose your voice for each child.
              Nothing plays until they do.
            </p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={buttonPrimary} disabled={voice !== "ready"} onClick={() => set(f.id, "shared")}>
                Share my voice
              </button>
              <button type="button" className={buttonSecondary} onClick={() => set(f.id, "declined")}>
                Not now
              </button>
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="shared" className="flex flex-col gap-4" data-testid="shared-families">
        <h2 id="shared" className="font-display text-2xl font-semibold">
          Families who can use your voice
        </h2>
        {shared.length === 0 && <p className="text-muted">No families yet.</p>}
        <ul className="flex flex-col gap-3">
          {shared.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10">
              <span>
                <span className="block font-display text-lg font-semibold">{f.name}</span>
                <span className="text-sm">
                  {f.activeNarrator ? "Your voice is one of their storytellers." : "Shared. They haven't picked your voice as a storyteller yet."}
                </span>
              </span>
              <button type="button" className={buttonSecondary} onClick={() => set(f.id, "stopped")}>
                Stop sharing
              </button>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">Sharing with more families is always free for you. Each family covers its own storyteller slots.</p>
      </section>

      <section aria-labelledby="household" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10">
        <h2 id="household" className="font-display text-2xl font-semibold">
          Your household
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="rounded-2xl bg-ivory p-4">
            <span className="block font-display font-semibold">Grandma June (you)</span>
            <span className="text-sm">Your own voice and choices</span>
          </li>
          <li className="rounded-2xl bg-ivory p-4">
            <span className="block font-display font-semibold">Grandpa Lou</span>
            <span className="text-sm">Invited. He&apos;ll verify and control his own voice.</span>
          </li>
        </ul>
        <p className="text-sm text-muted">Up to {CONTRIBUTOR_HOUSEHOLD_MAX_ADULTS} adults, each verified separately. Nobody can share someone else&apos;s voice.</p>
      </section>

      <section aria-labelledby="upgrade" className="flex flex-col items-start gap-3 rounded-[var(--radius-panel)] bg-sky/40 p-6">
        <h2 id="upgrade" className="font-display text-2xl font-semibold">
          Want stories for kids in your home?
        </h2>
        <p>
          Start Readli Family for {formatPrice(DEFAULT_PLAN.familyMonthlyPriceCents)} a month. You keep your account, your voice and every family you
          share with.
        </p>
        <Link href="/signup/family" className={buttonSecondary}>
          Start Readli Family
        </Link>
      </section>
    </div>
  );
}
