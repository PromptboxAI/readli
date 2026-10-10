"use client";

import { useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary } from "@/components/brand/buttons";
import {
  EXAMPLE_FAMILY,
  initials,
  STATUS_LABELS,
  TREE_LINKS,
  type ExampleMember,
  type MemberStatus,
} from "@/lib/content/example-family";

const RING: Record<MemberStatus, string> = {
  ready_shared: "border-[4px] border-solid border-ink",
  invited: "border-[4px] border-dashed border-coral-deep",
  not_invited: "border-[4px] border-dashed border-ink/40 opacity-80",
  listener: "border-[4px] border-solid border-surface",
};

const BADGE: Record<MemberStatus, string> = {
  ready_shared: "bg-mint text-ink",
  invited: "bg-sunshine text-ink",
  not_invited: "bg-surface text-ink border-2 border-ink/30",
  listener: "bg-lavender/70 text-ink",
};

const ACTION: Record<MemberStatus, { label: string; note: (m: ExampleMember) => string }> = {
  ready_shared: {
    label: "Hear a sample",
    note: (m) => `In your family, this plays ${m.name} reading. Sample voices switch on soon.`,
  },
  invited: {
    label: "Resend invite",
    note: (m) => `${m.name} has an invitation waiting. This is an example family, so nothing was sent.`,
  },
  not_invited: {
    label: "Invite to record",
    note: (m) => `In your family, this texts ${m.name} a link to record. This is an example family, so nothing was sent.`,
  },
  listener: {
    label: "Open their bookshelf",
    note: (m) => `Kids listen in a profile you manage. ${m.name} never needs a login.`,
  },
};

function Avatar({ member, size }: { member: ExampleMember; size: "lg" | "sm" }) {
  const dims = size === "lg" ? "size-20 text-2xl" : "size-12 text-lg";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-display font-semibold text-ink ${dims} ${member.tint} ${RING[member.status]}`}
    >
      {initials(member.name)}
    </span>
  );
}

function ProfileCard({ member, onClose }: { member: ExampleMember; onClose: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const action = ACTION[member.status];
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label={`${member.name}'s profile`}
      className="flex flex-col gap-4 rounded-panel border-[3px] border-ink bg-surface p-5 shadow-[0_6px_0_#283548]"
    >
      <div className="flex items-center gap-4">
        <Avatar member={member} size="lg" />
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold">{member.name}</p>
          <p className="text-muted">{member.relation}</p>
          <span className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-bold ${BADGE[member.status]}`}>
            {STATUS_LABELS[member.status]}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonPrimary} onClick={() => setNote(action.note(member))}>
          {action.label}
        </button>
        <button type="button" className="min-h-12 rounded-full px-4 font-semibold underline-offset-4 hover:underline" onClick={onClose}>
          Close
        </button>
      </div>
      {note && <p className="rounded-2xl bg-ivory p-3 text-sm">{note}</p>}
    </div>
  );
}

/** Interactive example family (Design Revision 001 §2). Explorable without signing up; nothing is sent. */
export function FamilyTree() {
  const [selectedId, setSelectedId] = useState<string>("lou");
  const [view, setView] = useState<"tree" | "list">("tree");
  const selected = EXAMPLE_FAMILY.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-5" data-testid="family-tree">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ReadiMascot size={64} decorative />
          <span className="relative rounded-2xl bg-sunshine px-4 py-2 text-sm font-bold before:absolute before:-left-1.5 before:top-1/2 before:size-3 before:-translate-y-1/2 before:rotate-45 before:bg-sunshine">
            Example family · tap anyone to meet them
          </span>
        </div>
        <div role="group" aria-label="Family view" className="flex rounded-full border-[3px] border-ink bg-surface p-1">
          {(["tree", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-10 rounded-full px-4 font-display font-semibold capitalize ${view === v ? "bg-ink text-white" : "text-ink"}`}
            >
              {v === "tree" ? "Tree" : "List"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        {view === "tree" ? (
          <div className="overflow-x-auto rounded-panel bg-surface/70 [touch-action:pan-x_pan-y]" tabIndex={-1}>
            <div className="relative aspect-[1000/660] min-w-[760px]">
              <svg viewBox="0 0 1000 660" className="absolute inset-0 size-full" aria-hidden="true">
                {TREE_LINKS.map((d) => (
                  <path key={d} d={d} fill="none" stroke="#283548" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
              <ul aria-label="Example family members">
                {EXAMPLE_FAMILY.map((m) => (
                  <li
                    key={m.id}
                    className="absolute -translate-x-1/2 -translate-y-[40px]"
                    style={{ left: `${m.x / 10}%`, top: `${(m.y / 660) * 100}%` }}
                  >
                    <button
                      type="button"
                      aria-pressed={selectedId === m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`flex w-32 flex-col items-center gap-1 rounded-3xl p-1 transition-transform hover:-translate-y-0.5 ${selectedId === m.id ? "bg-sunshine/60" : ""}`}
                    >
                      <Avatar member={m} size="lg" />
                      <span className="font-display text-base font-semibold leading-tight">{m.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${BADGE[m.status]}`}>{STATUS_LABELS[m.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <p className="sticky left-0 px-4 pb-3 text-sm text-muted sm:hidden">Swipe sideways to see the whole family.</p>
          </div>
        ) : (
          <ul aria-label="Example family members" className="flex flex-col gap-2">
            {EXAMPLE_FAMILY.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={selectedId === m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`flex w-full items-center gap-3 rounded-3xl border-[3px] p-3 text-left ${selectedId === m.id ? "border-ink bg-sunshine/50" : "border-transparent bg-surface"}`}
                >
                  <Avatar member={m} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-semibold">{m.name}</span>
                    <span className="block text-sm text-muted">{m.relation}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${BADGE[m.status]}`}>{STATUS_LABELS[m.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected && <ProfileCard key={selected.id} member={selected} onClose={() => setSelectedId("")} />}
      </div>
    </div>
  );
}
