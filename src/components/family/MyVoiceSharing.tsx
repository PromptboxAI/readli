"use client";

import { useState } from "react";
import type { MyVoiceHousehold, MyVoiceView } from "@/lib/family/service";
import { Toggle } from "./Toggle";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** What the family has done with a shared voice. Read-only: the family's parents make these choices. */
function FamilyStatus({ h, onRename }: { h: MyVoiceHousehold; onRename?: (nickname: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(h.calledAs ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    if (await onRename!(name)) setEditing(false);
    setSaving(false);
  };
  return (
    <ul className="mt-2 flex flex-col gap-0.5 text-sm" data-testid={`family-status-${h.id}`}>
      {h.sharedSince && <li>Shared since {day(h.sharedSince)}</li>}
      <li>{h.inSlot ? "Added as a narrator" : "Waiting for a parent to add you as a narrator"}</li>
      {h.inSlot && <li>{h.approvedFor.length ? `Reading to ${h.approvedFor.join(", ")}` : "No children yet. A parent chooses who hears you."}</li>}
      {!onRename ? (
        h.calledAs && <li>They call you {h.calledAs}</li>
      ) : editing ? (
        <li className="mt-1 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`nick-${h.id}`}>
            What {h.name}&apos;s kids call you
          </label>
          <input
            id={`nick-${h.id}`}
            className="min-h-11 rounded-2xl border-[3px] border-ink/20 bg-surface px-3"
            value={name}
            maxLength={40}
            placeholder="Grandma, Aunt Ange…"
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className="min-h-11 rounded-full bg-ink px-4 font-semibold text-white" disabled={saving} onClick={save}>
            Save
          </button>
          <button type="button" className="min-h-11 px-2 font-semibold underline" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </li>
      ) : (
        <li>
          {h.calledAs ? `The kids see you as ${h.calledAs}. ` : "The kids see your own name. "}
          <button type="button" className="min-h-11 font-semibold underline" onClick={() => setEditing(true)}>
            Change
          </button>
        </li>
      )}
    </ul>
  );
}

/** The voice owner's own switch, per family. Turning it off removes the voice from every child at once. */
export function MyVoiceSharing({ initial, storyteller = false }: { initial: MyVoiceView[]; storyteller?: boolean }) {
  const [voices, setVoices] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = async (voiceId: string, householdId: string, name: string, shared: boolean) => {
    setSaving(true);
    const res = await fetch(`/api/family/voices/${voiceId}/share`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ householdId, shared }),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) return setMessage(body?.error?.message ?? "We couldn't save that. Please try again.");
    setVoices(body.voices);
    setMessage(
      shared
        ? `Your voice is now available to ${name}. Each child's parent still chooses whether their child hears it.`
        : `Your voice is no longer available to ${name}. It was removed from every child's bookshelf.`,
    );
  };

  const rename = async (householdId: string, nickname: string) => {
    const res = await fetch("/api/family/me/nickname", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ householdId, nickname }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(body?.error?.message ?? "We couldn't save that name. Please try again.");
      return false;
    }
    setVoices(body.voices);
    setMessage("Saved. That's the name their kids see.");
    return true;
  };

  if (voices.length === 0) return <p className="rounded-3xl bg-surface p-4">You haven&apos;t recorded your voice yet.</p>;
  // Families that connected in the last two weeks, so a new connection never goes unnoticed.
  const recent = voices.flatMap((v) => v.households.filter((h) => h.shared && h.sharedSince && Date.now() - Date.parse(h.sharedSince) < 14 * 86_400_000));
  return (
    <div className="flex flex-col gap-4" data-testid="my-voice">
      {recent.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="new-connections">
          {recent.map((h) => (
            <li key={h.id} className="rounded-3xl bg-mint/40 p-4">
              <span className="font-semibold">
                {h.name} can use your voice since {day(h.sharedSince!)}.
              </span>{" "}
              Their parents choose which children hear you. To stop sharing, turn off {h.name} below.
            </li>
          ))}
        </ul>
      )}
      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>
      {voices.map((v) =>
        v.status !== "ready" ? (
          <p key={v.voiceId} className="rounded-3xl bg-lavender/40 p-4 font-semibold">
            Your voice is still being made. You can share it once it&apos;s ready.
          </p>
        ) : (
          v.households.length === 0 && storyteller ? (
            <p key={v.voiceId} className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
              No families use your voice yet. When a family invites you, open their link to join them.
            </p>
          ) : (
          <ul key={v.voiceId} className="flex flex-col gap-3">
            {v.households.map((h) => (
              <li key={h.id} className="flex items-center gap-4 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-semibold">{h.name}</p>
                  <p className="text-sm text-muted">{h.shared ? (storyteller ? "Sharing your voice. Turn off to stop sharing." : "Available to your family") : "Private: only you can use it"}</p>
                  {h.shared && <FamilyStatus h={h} onRename={storyteller ? (n) => rename(h.id, n) : undefined} />}
                </div>
                <Toggle checked={h.shared} disabled={saving} label={`Share my voice with ${h.name}`} onChange={(on) => set(v.voiceId, h.id, h.name, on)} />
              </li>
            ))}
          </ul>
          )
        ),
      )}
    </div>
  );
}
