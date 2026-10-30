"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { buttonPrimary } from "@/components/brand/buttons";
import { EnvelopeArt } from "@/components/invites/illustrations";
import { JOIN_COOKIE } from "@/lib/invites/join-cookie";
import type { InviteLanding } from "@/lib/invites/server";

const steps = (family: string) =>
  [
    ["Sign in or create a free Readli Voice account", "Just you, with your own email."],
    ["Record and approve your voice", "About five minutes reading a short story aloud. Already have a Readli voice? You skip this."],
    [`Agree to share it with ${family}`, "Their parents then choose which children hear you."],
    ["Finish on your Readli Voice home", "Where you see every family using your voice."],
  ] as const;

const parentSteps = (family: string, inviter: string) =>
  [
    ["Sign in or create a free Readli account", "Just you, with your own email."],
    [`Join ${family} as a parent`, "You see the whole family account, and choose which storytellers each child hears."],
    ["Open Readli Kids on your own phone or tablet", `Whenever the kids use your device. ${inviter} keeps the plan and billing.`],
    ["Record your own voice, if you like", "It's optional. You can add it any time from My Voice."],
  ] as const;

/** The invitee's side of a family's storyteller or co-parent invitation: sign in, then accept explicitly. */
export function JoinInvite({ token, invite, signedIn, live }: { token: string; invite: InviteLanding | null; signedIn: boolean; live: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const usable = live && invite?.status === "invited";
  const coParent = invite?.role === "guardian";
  useEffect(() => {
    if (usable) document.cookie = `${JOIN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${7 * 86_400}; samesite=lax`;
  }, [usable, token]);

  if (!live) {
    return (
      <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-lavender/40 p-6" data-testid="join-preview">
        <p className="text-lg">A family invited you to record your voice and read stories to their kids.</p>
        <p>Sign-in isn&apos;t switched on here, so this invitation can&apos;t be accepted on this site.</p>
      </section>
    );
  }
  if (!invite) {
    return (
      <section role="alert" className="rounded-[var(--radius-panel)] bg-coral/20 p-6">
        <h2 className="font-display text-2xl font-semibold">We couldn&apos;t find that invitation</h2>
        <p>Check the link, or ask the family to send a fresh one.</p>
      </section>
    );
  }
  if (invite.status !== "invited") {
    return (
      <section role="alert" className="rounded-[var(--radius-panel)] bg-coral/20 p-6" data-testid="join-unusable">
        <h2 className="font-display text-2xl font-semibold">This invitation can&apos;t be used</h2>
        <p>
          It has {invite.status === "expired" ? "expired" : invite.status === "withdrawn" ? "been withdrawn" : invite.status === "declined" ? "been declined" : "already been used"}. Ask {invite.inviterName} to
          send a fresh link from {coParent ? "Settings" : "Family storytellers"}.
        </p>
      </section>
    );
  }

  async function accept() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/invites/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.householdId) {
      document.cookie = `${JOIN_COOKIE}=; path=/; max-age=0`;
      return router.push(coParent ? "/family" : `/voice/join/${body.householdId}`);
    }
    if (body?.error?.code === "already_member") return router.refresh();
    setError(body?.error?.message ?? "That didn't work. Please try again.");
    setBusy(false);
  }

  if (coParent) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]" data-testid="join-co-parent">
        <section className="flex flex-col gap-4">
          <p className="text-lg">
            Share {invite.familyName}&apos;s Readli account with {invite.inviterName}, so you can set up stories for the kids from your own phone.
          </p>
          <ol className="flex flex-col gap-3">
            {parentSteps(invite.familyName, invite.inviterName).map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full font-display font-semibold ${i === 0 && signedIn ? "bg-mint" : "bg-surface ring-2 ring-ink/15"}`}>{i + 1}</span>
                <span>
                  <span className="block font-display font-semibold">{t}</span>
                  {d}
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] bg-sky/40 p-6">
          <EnvelopeArt className="w-20" />
          {signedIn ? (
            <>
              <h2 className="font-display text-2xl font-semibold">Join {invite.familyName} as a parent?</h2>
              <p>You&apos;ll be a parent of every child in the family. It&apos;s free for you: {invite.inviterName} keeps the plan and billing.</p>
              {error && (
                <p role="alert" className="rounded-2xl bg-coral/30 p-3 font-semibold">
                  {error}
                </p>
              )}
              <button type="button" className={buttonPrimary} onClick={accept} disabled={busy}>
                {busy ? "Joining…" : `Join ${invite.familyName}`}
              </button>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold">Continue with your email</h2>
              <p>New to Readli? This makes your free account. Already have one? Use the same sign-in.</p>
              <div className="w-full">
                <LoginForm next={`/voice/join?invite=${encodeURIComponent(token)}`} />
              </div>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]" data-testid="join-invite">
      <section className="flex flex-col gap-4">
        <p className="text-lg">Record your voice once, and the kids in {invite.familyName} can hear you read their favourite books.</p>
        <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10" data-testid="voice-account-facts">
          <h2 className="font-display text-xl font-semibold">Readli Voice is free</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>No subscription and no credit card.</li>
            <li>You never buy narration credits. {invite.familyName} pays for preparing their audiobooks.</li>
            <li>You control your voice and which families can use it.</li>
            <li>One voice can be shared with more than one family.</li>
          </ul>
        </section>
        <ol className="flex flex-col gap-3">
          {steps(invite.familyName).map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className={`grid size-9 shrink-0 place-items-center rounded-full font-display font-semibold ${i === 0 && signedIn ? "bg-mint" : "bg-surface ring-2 ring-ink/15"}`}>{i + 1}</span>
              <span>
                <span className="block font-display font-semibold">{t}</span>
                {d}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] bg-sky/40 p-6">
        <EnvelopeArt className="w-20" />
        {signedIn ? (
          <>
            <h2 className="font-display text-2xl font-semibold">Join {invite.familyName} as a storyteller?</h2>
            <p>Joining doesn&apos;t share your voice. You choose that after your voice is ready.</p>
            {error && (
              <p role="alert" className="rounded-2xl bg-coral/30 p-3 font-semibold">
                {error}
              </p>
            )}
            <button type="button" className={buttonPrimary} onClick={accept} disabled={busy}>
              {busy ? "Joining…" : `Join ${invite.familyName}`}
            </button>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-semibold">Continue with your email</h2>
            <p>New to Readli? This makes your free Readli Voice account. Already have one? Use the same sign-in and we&apos;ll keep your voice.</p>
            <div className="w-full">
              <LoginForm next={`/voice/join?invite=${encodeURIComponent(token)}`} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
