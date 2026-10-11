"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import { EnvelopeArt } from "@/components/invites/illustrations";
import type { InviteLanding } from "@/lib/invites/server";

/** A signed-in grown-up accepting a family invitation. Joining shares no voice and starts no plan. */
export function AcceptInvite({ token, invite }: { token: string; invite: InviteLanding | null }) {
  const [state, setState] = useState<"ready" | "busy" | "joined">(invite?.alreadyMember ? "joined" : "ready");
  const [error, setError] = useState("");

  async function accept() {
    setState("busy");
    setError("");
    const res = await fetch("/api/invites/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    const body = await res.json().catch(() => null);
    if (res.ok || body?.error?.code === "already_member") return setState("joined");
    setError(body?.error?.message ?? "That didn't work. Please try again.");
    setState("ready");
  }

  if (!invite) {
    return (
      <section role="alert" className="rounded-[var(--radius-panel)] bg-coral/20 p-6">
        <h1 className="font-display text-2xl font-semibold">We couldn&apos;t find that invitation</h1>
        <p>Check the link, or ask the family to send a fresh one.</p>
      </section>
    );
  }
  const usable = invite.status === "invited";
  return (
    <section className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] bg-sky/50 p-6 sm:flex-row sm:items-center" data-testid="accept-invite">
      <EnvelopeArt className="w-24 shrink-0" />
      <div className="flex flex-col gap-3">
        {state === "joined" ? (
          <>
            <h1 className="font-display text-2xl font-semibold">You&apos;re in {invite.familyName}&apos;s circle</h1>
            <p>Nothing has been shared yet. When you&apos;re ready, record your voice and choose whether {invite.familyName} can use it.</p>
            <Link href="/voice/record" className={`${buttonPrimary} w-fit`}>
              Record my voice
            </Link>
          </>
        ) : usable ? (
          <>
            <h1 className="font-display text-2xl font-semibold">
              {invite.inviterName} invited you to join {invite.familyName}
            </h1>
            <p>Joining adds you to their family circle. It doesn&apos;t share your voice or start a subscription: you choose those separately.</p>
            {error && (
              <p role="alert" className="rounded-2xl bg-coral/30 p-3 font-semibold">
                {error}
              </p>
            )}
            <button type="button" className={`${buttonPrimary} w-fit`} onClick={accept} disabled={state === "busy"}>
              {state === "busy" ? "Joining…" : `Join ${invite.familyName}`}
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold">This invitation can&apos;t be used</h1>
            <p>It has expired, been withdrawn or already been used. Ask {invite.inviterName} for a fresh link.</p>
          </>
        )}
      </div>
    </section>
  );
}
