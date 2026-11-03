"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parentPrimary, parentSecondary } from "@/components/brand/buttons";
import { SETUP_SEEN_COOKIE } from "@/lib/family/setup-cookie";
import { InviteStoryteller, type SavedInvite } from "./InviteStoryteller";

/** One tap in setup: your own voice shared with your family, in a narrator slot, and approved for every child. */
export function SetupMyVoice({ kidNames }: { kidNames: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const who = kidNames.length === 0 ? "your kids" : kidNames.length === 1 ? kidNames[0]! : `${kidNames.slice(0, -1).join(", ")} and ${kidNames.at(-1)}`;
  async function turnOn() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/family/setup/my-voice", { method: "POST" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(body?.error?.message ?? "That didn't work. Please try again.");
    router.refresh();
  }
  return (
    <section className="flex flex-col items-start gap-3 rounded-2xl bg-sky/40 p-5" data-testid="setup-my-voice">
      <p className="font-semibold">Your voice is ready. Let {who} hear it?</p>
      <p className="text-sm">This shares your voice with your family and turns it on for {kidNames.length === 1 ? "them" : "each of them"}. You can change it any time in Family.</p>
      <button type="button" className={parentPrimary} disabled={busy} onClick={turnOn}>
        {busy ? "Turning it on…" : `Yes, read to ${who} in my voice`}
      </button>
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </section>
  );
}

/** Setup's storyteller invitations: who's been invited so far, and the form for one more. */
export function SetupStorytellerInvites({ live, initial }: { live: boolean; initial: { id: string; name: string }[] }) {
  const [invited, setInvited] = useState(initial);
  const [open, setOpen] = useState(initial.length === 0);
  const [round, setRound] = useState(0);
  return (
    <div className="flex flex-col gap-3" data-testid="setup-storytellers">
      {invited.length > 0 && (
        <ul className="flex flex-col gap-2">
          {invited.map((i) => (
            <li key={i.id} className="rounded-2xl bg-sunshine/40 px-4 py-3">
              <span className="font-semibold">{i.name}</span> <span className="text-sm">is invited. You&apos;ll see them in Family when they&apos;ve recorded.</span>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <InviteStoryteller
          key={round}
          live={live}
          onSent={(inv: SavedInvite) => setInvited((list) => [{ id: inv.id, name: inv.name }, ...list])}
          onClose={() => {
            setOpen(false);
            setRound((r) => r + 1);
          }}
        />
      ) : (
        <button type="button" className={`${parentSecondary} self-start`} onClick={() => setOpen(true)}>
          {invited.length > 0 ? "Invite someone else" : "Invite a storyteller"}
        </button>
      )}
    </div>
  );
}

/** Remembers that this browser has seen setup, so Family Home stops sending it here and shows a reminder instead. */
export function SetupSeen() {
  useEffect(() => {
    document.cookie = `${SETUP_SEEN_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, []);
  return null;
}
