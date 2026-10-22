"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";

type Step = { title: string; done: boolean; current: boolean };

/** The invited storyteller's checklist for one family: joined, voice ready, shared. */
export function JoinSteps({
  householdId,
  familyName,
  voice,
  shared: initialShared,
  nickname: initialNickname,
  recordHref,
}: {
  householdId: string;
  familyName: string;
  voice: { id: string; ready: boolean } | null;
  shared: boolean;
  nickname: string;
  recordHref: string;
}) {
  const router = useRouter();
  const [shared, setShared] = useState(initialShared);
  const [agreed, setAgreed] = useState(false);
  const [nickname, setNickname] = useState(initialNickname);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ready = Boolean(voice?.ready);
  const steps: Step[] = [
    { title: `Joined ${familyName}`, done: true, current: false },
    { title: "Record and keep your voice", done: ready, current: !ready },
    { title: `Share it with ${familyName}`, done: shared, current: ready && !shared },
  ];

  async function share() {
    if (!voice || !agreed) return;
    setBusy(true);
    setError("");
    // The name first, so the family's notice already says what their kids will call this storyteller.
    if (nickname.trim() !== initialNickname.trim()) {
      const named = await fetch("/api/family/me/nickname", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ householdId, nickname }),
      });
      if (!named.ok) {
        const body = await named.json().catch(() => null);
        setBusy(false);
        return setError(body?.error?.message ?? "We couldn't save that name. Please try again.");
      }
    }
    const res = await fetch(`/api/family/voices/${encodeURIComponent(voice.id)}/share`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ householdId, shared: true }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(body?.error?.message ?? "We couldn't share your voice just now. Please try again.");
    setShared(true);
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]" data-testid="join-steps">
      <ol className="flex flex-col gap-2" aria-label="Your steps">
        {steps.map((s, i) => (
          <li key={s.title} aria-current={s.current ? "step" : undefined} className={`flex items-center gap-3 rounded-2xl p-3 ${s.current ? "bg-surface font-semibold ring-2 ring-ink/10" : ""}`}>
            <span className={`grid size-8 shrink-0 place-items-center rounded-full font-display font-semibold ${s.done ? "bg-mint" : s.current ? "bg-coral-deep text-white" : "bg-surface ring-2 ring-ink/15"}`}>
              {s.done ? "✓" : i + 1}
              <span className="sr-only">{s.done ? " done" : ""}</span>
            </span>
            {s.title}
          </li>
        ))}
      </ol>

      {!voice && (
        <section className="flex flex-col items-start gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10">
          <h2 className="font-display text-2xl font-semibold">Record your voice</h2>
          <p>You&apos;ll agree to how your voice is used, read a short story aloud, then listen and keep it. It takes about five minutes.</p>
          <Link href={recordHref} className={buttonPrimary}>
            Record my voice
          </Link>
        </section>
      )}

      {voice && !ready && (
        <section className="flex flex-col items-start gap-3 rounded-[var(--radius-panel)] bg-lavender/40 p-6">
          <h2 className="font-display text-2xl font-semibold">Your voice is still being made</h2>
          <p>It usually takes a minute. Check again shortly, then share it with {familyName}.</p>
          <button type="button" className={buttonSecondary} onClick={() => router.refresh()}>
            Check again
          </button>
        </section>
      )}

      {ready && !shared && (
        <section className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10" data-testid="share-step">
          <h2 className="font-display text-2xl font-semibold">Share your voice with {familyName}?</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>{familyName} can prepare audiobooks using your voice.</li>
            <li>Their parents decide which children can hear it.</li>
            <li>Sharing doesn&apos;t give them access to your account or your recording.</li>
            <li>You can stop sharing any time from your Readli Voice home, so no new books are made in your voice.</li>
            <li>Audiobooks already made are kept as described in the voice agreement you accepted.</li>
          </ul>
          <label className="flex w-full max-w-md flex-col gap-1">
            <span className="font-semibold">What should the kids call you?</span>
            <input
              className="min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink"
              value={nickname}
              maxLength={40}
              placeholder="Mommy, Grandma, Aunt Ange, Grandpa Joe"
              onChange={(e) => setNickname(e.target.value)}
              data-testid="join-nickname"
            />
            <span className="text-sm text-muted">This is the name children will see in Readli Kids. You can change it later.</span>
          </label>
          <label className="flex items-start gap-3 font-semibold">
            <input type="checkbox" className="mt-1 size-5 accent-coral-deep" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I agree to share my Readli voice with {familyName} on these terms.</span>
          </label>
          {error && (
            <p role="alert" className="rounded-2xl bg-coral/30 p-3 font-semibold">
              {error}
            </p>
          )}
          <button type="button" className={buttonPrimary} disabled={!agreed || busy} onClick={share}>
            {busy ? "Sharing…" : `Share with ${familyName}`}
          </button>
          <p className="text-sm text-muted">You&apos;ll never be asked to pay.</p>
        </section>
      )}

      {ready && shared && (
        <section aria-live="polite" className="flex flex-col items-start gap-3 rounded-[var(--radius-panel)] bg-mint/50 p-6" data-testid="join-done">
          <h2 className="font-display text-2xl font-semibold">You&apos;re ready to read to {familyName}</h2>
          <p>We&apos;ve let their parents know. They add you as a narrator and choose which children hear you. You can stop sharing any time.</p>
          <Link href="/voice" className={buttonPrimary}>
            Go to my Readli Voice home
          </Link>
        </section>
      )}
    </div>
  );
}
