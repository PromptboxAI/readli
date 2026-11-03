"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parentSecondary } from "@/components/brand/buttons";
import { SETUP_SEEN_COOKIE } from "@/lib/family/setup-cookie";
import { InviteStoryteller, type SavedInvite } from "./InviteStoryteller";

/**
 * Setup turns your own voice on for your kids by itself, with no extra button: once your voice is ready and
 * you have a child, it's shared with your family, put in a narrator slot and approved for every child. If
 * that can't happen (say a slot is full), the book page still shows each step to do by hand.
 */
export function SetupUseMyVoice() {
  const router = useRouter();
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    void fetch("/api/family/setup/my-voice", { method: "POST" })
      .then((res) => {
        if (res.ok) router.refresh();
      })
      .catch(() => {});
  }, [router]);
  return null;
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
export function SetupSeen({ cookie = SETUP_SEEN_COOKIE }: { cookie?: string }) {
  useEffect(() => {
    document.cookie = `${cookie}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [cookie]);
  return null;
}
