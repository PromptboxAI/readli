"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonSecondary } from "@/components/brand/buttons";
import type { ManageStorytellersView, StorytellerView } from "@/lib/family/service";
import { StorytellerAvatar } from "./StorytellerAvatar";
import { Toggle } from "./Toggle";

function statusText(s: StorytellerView, child: string): { badge: string; tone: string; note: string } {
  switch (s.status) {
    case "approved":
      return { badge: `Approved for ${child}`, tone: "bg-mint", note: "Available to your family" };
    case "available":
      return { badge: "Not available to this child", tone: "bg-surface border-2 border-ink/30", note: "Available to your family" };
    case "waiting_for_owner":
      return { badge: "Waiting for permission", tone: "bg-sunshine", note: `${s.ownerName} hasn't shared their voice with your family yet.` };
    case "needs_slot":
      return { badge: "Needs a narrator slot", tone: "bg-sky/60", note: "Shared with your family. Add them to a narrator slot to approve them." };
    case "processing":
      return { badge: "Voice still being made", tone: "bg-lavender/70", note: "You can approve it once it's ready and shared." };
  }
}

/** Readli Family → Kids Profiles → Manage Storytellers (Amendment 002 §2). */
export function ManageStorytellers({ initial }: { initial: ManageStorytellersView }) {
  const [view, setView] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const child = view.child.nickname;
  const available = view.storytellers.filter((s) => s.status === "available");
  const groups: { title: string; items: StorytellerView[] }[] = [
    { title: `Storytellers ${child} can hear`, items: view.storytellers.filter((s) => s.status === "approved") },
    { title: "Shared with your family", items: available },
    { title: "Not in a narrator slot", items: view.storytellers.filter((s) => s.status === "needs_slot") },
    { title: "Waiting for the storyteller", items: view.storytellers.filter((s) => s.status === "waiting_for_owner" || s.status === "processing") },
  ];

  const save = async (changes: { voiceId: string; approved: boolean }[], done: string) => {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/family/kids/${view.child.id}/storytellers`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setMessage(body?.error?.message ?? "We couldn't save that. Please try again.");
      return;
    }
    setView(body as ManageStorytellersView);
    setMessage(done);
  };

  return (
    <div className="flex flex-col gap-8" data-testid="manage-storytellers">
      <div className="flex flex-col gap-3">
        <p className="font-display font-semibold text-coral-deep">Kids profiles</p>
        <h1 className="font-display text-4xl font-semibold">Manage storytellers for {child}</h1>
        <p className="max-w-2xl text-lg">
          A voice appears for {child} only when its owner has shared it with your family, it&apos;s in one of your
          narrator slots, <em>and</em> you approve it here. Joining the family tree doesn&apos;t share anyone&apos;s voice.
        </p>
        {view.children.length > 1 && (
          <nav aria-label="Choose a child" className="flex flex-wrap gap-2">
            {view.children.map((c) => (
              <Link
                key={c.id}
                href={`/family/kids/${c.id}/storytellers`}
                aria-current={c.id === view.child.id ? "page" : undefined}
                className={`min-h-11 rounded-full border-[3px] px-4 py-1.5 font-display font-semibold ${c.id === view.child.id ? "border-ink bg-ink text-white" : "border-ink bg-surface"}`}
              >
                {c.nickname}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>

      {groups.filter((g) => g.items.length > 0 || !g.title.startsWith("Not in")).map((g) => (
        <section key={g.title} className="flex flex-col gap-3" aria-label={g.title}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">{g.title}</h2>
            {g.items === available && available.length > 1 && (
              <button
                type="button"
                className={buttonSecondary}
                disabled={saving}
                onClick={() => save(available.map((s) => ({ voiceId: s.voiceId, approved: true })), `Approved ${available.length} storytellers for ${child}.`)}
              >
                Approve all for {child}
              </button>
            )}
          </div>
          {g.items.length === 0 ? (
            <p className="rounded-3xl bg-surface p-4 text-muted">Nobody here right now.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {g.items.map((s) => {
                const t = statusText(s, child);
                const locked = s.status !== "approved" && s.status !== "available";
                return (
                  <li key={s.voiceId} data-testid={`storyteller-${s.voiceId}`} className={`flex items-center gap-4 rounded-3xl p-4 ${s.status === "approved" ? "bg-mint/40" : locked ? "bg-ink/5" : "bg-surface ring-2 ring-ink/10"}`}>
                    <StorytellerAvatar name={s.ownerName} avatarUrl={s.avatarUrl} tint={s.tint} muted={locked} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-xl font-semibold">{s.ownerName}</p>
                      <p className="text-sm text-muted">{s.relationship}</p>
                      <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-sm font-bold text-ink ${t.tone}`}>{t.badge}</span>
                      <p className="mt-1 text-sm text-muted">{t.note}</p>
                      {s.status === "needs_slot" && (
                        <Link href="/family/narrators" className="mt-1 inline-block text-sm font-semibold underline underline-offset-4">
                          Manage narrator slots
                        </Link>
                      )}
                    </div>
                    <Toggle
                      checked={s.status === "approved"}
                      disabled={locked || saving}
                      label={`${s.ownerName} for ${child}`}
                      onChange={(on) =>
                        save([{ voiceId: s.voiceId, approved: on }], on ? `${s.ownerName} is approved for ${child}.` : `${s.ownerName} was removed for ${child}.`)
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
