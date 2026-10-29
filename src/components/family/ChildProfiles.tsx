"use client";

import Link from "next/link";
import { useState } from "react";
import { parentPrimary, buttonQuiet } from "@/components/brand/buttons";
import type { ChildProfilesView } from "@/lib/family/service";
import { SessionButton } from "./SessionButton";
import { StorytellerAvatar } from "./StorytellerAvatar";

/** Readli Family → Kids profiles. Up to the plan's maximum, never charged per child. */
export function ChildProfiles({ initial }: { initial: ChildProfilesView }) {
  const [view, setView] = useState(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const full = view.children.length >= view.max;

  const send = async (url: string, init: RequestInit, done: string) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(url, init);
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setMessage(json?.error?.message ?? "We couldn't save that. Please try again.");
    setView(json as ChildProfilesView);
    setMessage(done);
  };

  return (
    <div className="flex flex-col gap-8" data-testid="child-profiles">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-semibold">Kids profiles</h1>
        <p className="max-w-2xl text-lg text-muted">Open a child&apos;s Readli Kids here, or choose which storytellers they can hear.</p>
        <p className="max-w-2xl text-lg">
          Readli Family includes up to {view.max} kids profiles at no extra cost. Each child gets their own bookshelf, place in
          every book, favourite stories and storytellers you approve.
        </p>
        <p className="font-display text-xl font-semibold" data-testid="profiles-count">
          {view.children.length} of {view.max} profiles
        </p>
      </div>

      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {view.children.map((c) => (
          <li key={c.id} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
            <div className="flex min-w-0 items-center gap-3">
              <StorytellerAvatar name={c.nickname} avatarUrl={null} tint={c.tint} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-semibold">{c.nickname}</p>
                <Link href={`/family/kids/${c.id}/storytellers`} className="text-sm font-semibold underline underline-offset-4">
                  Manage storytellers
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SessionButton as={`child:${c.id}`} next="/kids" className={parentPrimary}>
                Open Readli Kids<span className="sr-only"> for {c.nickname}</span>
              </SessionButton>
              <button
                type="button"
                className={buttonQuiet}
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Remove ${c.nickname}'s profile? Their bookshelf and places in books go too.`)) {
                    void send(`/api/family/children/${c.id}`, { method: "DELETE" }, `${c.nickname}'s profile was removed.`);
                  }
                }}
              >
                Remove<span className="sr-only"> {c.nickname}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      {full ? (
        <p className="rounded-3xl bg-sunshine/60 p-4 font-semibold">You have the most kids profiles Readli Family includes.</p>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-panel bg-mint/40 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const nickname = name.trim();
            if (!nickname) return;
            void send(
              "/api/family/children",
              { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nickname }) },
              `${nickname}'s profile is ready. Choose their storytellers next; no extra charge.`,
            ).then(() => setName(""));
          }}
        >
          <label htmlFor="child-name" className="font-display text-2xl font-semibold">
            Add a child
          </label>
          <p className="text-sm text-muted">A first name or nickname is enough. Kids never need an email or a login.</p>
          <div className="flex flex-wrap gap-2">
            <input
              id="child-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="min-h-12 flex-1 rounded-full border-[3px] border-ink bg-surface px-4 text-lg"
            />
            <button type="submit" className={parentPrimary} disabled={busy || !name.trim()}>
              Add profile
            </button>
          </div>
          <p className="text-sm font-semibold">No extra charge for more children.</p>
        </form>
      )}
    </div>
  );
}
