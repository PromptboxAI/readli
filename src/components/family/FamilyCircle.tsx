"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import type { NarratorSlotsView } from "@/lib/family/service";
import type { SavedInvite } from "./InviteStoryteller";
import { StorytellerAvatar } from "./StorytellerAvatar";

type Kind = "reading" | "ready" | "waiting" | "joined" | "invited";

interface Member {
  key: string;
  name: string;
  ownName?: string;
  relationship: string;
  avatarUrl: string | null;
  tint: string;
  kind: Kind;
  badge: string;
  detail: string;
  canHear: string[];
  yours?: boolean;
  /** The card on the List view that holds this person's actions. */
  card: string;
  /** The existing action this person needs next, if any. */
  next?: { label: string; href?: string; card?: boolean };
}

const BADGE: Record<Kind, string> = {
  reading: "bg-mint",
  ready: "bg-sunshine",
  waiting: "bg-sky/60",
  joined: "bg-sky/60",
  invited: "bg-ivory ring-2 ring-ink/20",
};

const day = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const and = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** Everyone in this family's storytelling circle, from the same data as the List view. Nothing here is a family tree. */
function members(view: NarratorSlotsView, invites: SavedInvite[], kidName: (id: string) => string): Member[] {
  const free = view.total - view.active.length;
  const out: Member[] = [];
  for (const n of view.active) {
    const hear = n.canHear ?? [];
    out.push({
      key: n.voiceId,
      name: n.name,
      ownName: n.ownName,
      relationship: n.relationship,
      avatarUrl: n.avatarUrl,
      tint: n.tint,
      kind: "reading",
      badge: "In a slot",
      detail: hear.length ? `${and(hear.map(kidName))} can hear ${n.name}.` : `${n.name} is in a narrator slot. No child is switched on to hear them yet.`,
      canHear: hear,
      card: `slot-${n.voiceId}`,
      next: { label: "Choose which kids hear them", href: "approve" },
    });
  }
  for (const n of view.shared) {
    out.push({
      key: n.voiceId,
      name: n.name,
      ownName: n.ownName,
      relationship: n.relationship,
      avatarUrl: n.avatarUrl,
      tint: n.tint,
      kind: "ready",
      badge: "Voice ready",
      detail:
        free > 0
          ? `${n.name} shared their voice with your family. Add them to a slot, then choose which kids hear them.`
          : `${n.name} shared their voice with your family, but every narrator slot is in use. Free one up or add a slot to add them.`,
      canHear: [],
      card: `slot-${n.voiceId}`,
      next: {
        label: free > 0 ? "Add to a slot" : "See slot options",
        card: true,
      },
    });
  }
  for (const n of view.waiting) {
    const making = n.status === "processing";
    out.push({
      key: n.voiceId,
      name: n.name,
      ownName: n.ownName,
      relationship: n.relationship,
      avatarUrl: n.avatarUrl,
      tint: n.tint,
      kind: "waiting",
      yours: n.yours,
      badge: making ? "Making their voice" : n.status === "stopped_sharing" ? "Stopped sharing" : "Not shared yet",
      detail: making
        ? `${n.yours ? "Your" : `${n.name}'s`} voice is being made.`
        : n.yours
          ? "Your voice is ready. Only you can share it with your family."
          : n.status === "stopped_sharing"
            ? `${n.name} stopped sharing their voice with your family.`
            : `${n.name}'s voice is ready. Only ${n.name} can share it with your family.`,
      canHear: [],
      card: `slot-${n.voiceId}`,
      next: n.yours && !making ? { label: "Share my voice", href: "/family/my-voice" } : undefined,
    });
  }
  for (const p of view.joined) {
    out.push({
      key: p.adultId,
      name: p.name,
      ownName: p.ownName,
      relationship: p.relationship,
      avatarUrl: p.avatarUrl,
      tint: p.tint,
      kind: "joined",
      yours: p.yours,
      badge: "No voice yet",
      detail: p.yours ? "You haven't recorded your voice yet." : `${p.name} is in your family and hasn't recorded their voice yet.`,
      canHear: [],
      card: `joined-${p.adultId}`,
      next: p.yours ? { label: "Record my voice", href: "/voice/record" } : undefined,
    });
  }
  for (const inv of invites) {
    if (inv.status !== "invited" && inv.status !== "expired") continue;
    const expired = inv.status === "expired";
    out.push({
      key: inv.id,
      name: inv.name,
      relationship: inv.relationship,
      avatarUrl: null,
      tint: "bg-ivory",
      kind: "invited",
      badge: expired ? "Invitation expired" : "Invited",
      detail: expired
        ? `The invitation to ${inv.name} expired before it was used.`
        : `Invited ${day(inv.createdAt)}${inv.expiresAt ? `. The link works until ${day(inv.expiresAt)}` : ""}. Inviting doesn't use a narrator slot.`,
      canHear: [],
      card: `invite-${inv.id}`,
      next: {
        label: expired ? "Invite again" : "Resend or withdraw",
        card: true,
      },
    });
  }
  return out;
}

/**
 * Family storytellers → Circle: the family's children in the middle and everyone who reads to them around
 * them, with whose voice is ready and who each child can hear. It's a picture of the List view's data, not a
 * family tree: every action stays on the List view, and nothing here changes a permission.
 */
export function FamilyCircle({
  view,
  invites,
  onOpenCard,
}: {
  view: NarratorSlotsView;
  invites: SavedInvite[];
  /** Switches to the List view on this card, where the action lives. */
  onOpenCard: (card: string) => void;
}) {
  const kids = view.children;
  const kidName = (id: string) => kids.find((k) => k.id === id)?.nickname ?? "A child";
  const people = members(view, invites, kidName);
  const [selected, setSelected] = useState<string | null>(null);
  const person = people.find((p) => p.key === selected) ?? null;
  const child = kids.find((k) => `kid-${k.id}` === selected) ?? null;
  const small = people.length > 8;
  const at = (i: number) => {
    const angle = (i / Math.max(people.length, 1)) * 2 * Math.PI - Math.PI / 2;
    return { x: 50 + 40 * Math.cos(angle), y: 50 + 40 * Math.sin(angle) };
  };
  const approveHref = (ids: string[]) => (ids.length === 1 || kids.length === 1 ? `/family/kids/${ids[0] ?? kids[0]!.id}/storytellers` : "/family/kids");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" data-testid="family-circle">
      <div className="flex flex-col gap-3">
        <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#283548" strokeOpacity="0.15" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
            {people.map((p, i) =>
              p.canHear.length > 0 ? (
                <line
                  key={p.key}
                  x1="50"
                  y1="50"
                  x2={at(i).x}
                  y2={at(i).y}
                  className="text-coral"
                  stroke="currentColor"
                  strokeOpacity="0.7"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                />
              ) : null,
            )}
          </svg>
          <div className="absolute top-1/2 left-1/2 flex w-[44%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-full bg-sunshine p-3 text-center ring-2 ring-ink/10 aspect-square justify-center">
            {kids.length ? (
              <ul aria-label="Your children" className="flex flex-wrap justify-center gap-1">
                {kids.map((k) => (
                  <li key={k.id}>
                    <button
                      type="button"
                      aria-pressed={selected === `kid-${k.id}`}
                      onClick={() => setSelected(`kid-${k.id}`)}
                      className={`flex flex-col items-center rounded-2xl p-0.5 ${selected === `kid-${k.id}` ? "bg-surface" : ""}`}
                    >
                      <StorytellerAvatar name={k.nickname} avatarUrl={null} tint={k.tint} size={kids.length > 2 ? "xs" : "sm"} />
                      <span className="max-w-16 truncate text-xs font-semibold">{k.nickname}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Link href="/family/kids" className="text-sm font-semibold underline underline-offset-4">
                Add your first child
              </Link>
            )}
          </div>
          <ul aria-label="Your storytelling circle">
            {people.map((p, i) => (
              <li key={p.key} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${at(i).x}%`, top: `${at(i).y}%` }}>
                <button
                  type="button"
                  aria-pressed={selected === p.key}
                  onClick={() => setSelected(p.key)}
                  data-testid={`circle-${p.key}`}
                  className={`flex w-[4.75rem] flex-col items-center gap-0.5 rounded-2xl p-1 sm:w-24 ${selected === p.key ? "bg-sunshine/60" : ""}`}
                >
                  <span className={p.kind === "reading" ? "rounded-full ring-4 ring-mint" : p.kind === "ready" ? "rounded-full ring-4 ring-sunshine" : ""}>
                    <StorytellerAvatar
                      name={p.name}
                      avatarUrl={p.avatarUrl}
                      tint={p.tint}
                      size={small ? "sm" : "md"}
                      muted={p.kind === "invited" || (!p.yours && (p.kind === "waiting" || p.kind === "joined"))}
                    />
                  </span>
                  <span className="w-full truncate text-xs font-semibold sm:text-sm">{p.yours ? "You" : p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted" aria-label="Key">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 rounded-full bg-mint ring-2 ring-mint" /> In a slot
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 rounded-full bg-sunshine" /> Voice ready to add
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 rounded-full border-2 border-dashed border-ink/40" /> On the way
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.5 w-4 bg-coral" /> A child can hear them
          </li>
        </ul>
      </div>

      <div aria-live="polite">
        {person ? (
          <section
            className="flex flex-col gap-4 rounded-panel bg-surface p-5 ring-2 ring-ink/10"
            aria-label={`${person.name}'s status`}
            data-testid="circle-card"
          >
            <div className="flex items-center gap-3">
              <StorytellerAvatar name={person.name} avatarUrl={person.avatarUrl} tint={person.tint} size="md" muted={person.kind === "invited"} />
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold">{person.yours ? `${person.name} (you)` : person.name}</p>
                {(person.ownName || person.relationship) && (
                  <p className="text-sm text-muted">{[person.ownName, person.relationship].filter(Boolean).join(" · ")}</p>
                )}
              </div>
            </div>
            <span className={`self-start rounded-full px-3 py-1 text-sm font-bold ${BADGE[person.kind]}`}>{person.badge}</span>
            <p>{person.detail}</p>
            <div className="flex flex-wrap items-center gap-3">
              {person.next?.href ? (
                <Link href={person.next.href === "approve" ? approveHref(person.canHear) : person.next.href} className={buttonPrimary}>
                  {person.next.label}
                </Link>
              ) : person.next?.card ? (
                <button type="button" className={buttonPrimary} onClick={() => onOpenCard(person.card)}>
                  {person.next.label}
                </button>
              ) : null}
              {!person.yours && (
                <button type="button" className="font-display font-semibold underline underline-offset-4" onClick={() => onOpenCard(person.card)}>
                  {person.kind === "invited" ? "Edit relationship" : "Edit name or relationship"}
                </button>
              )}
            </div>
          </section>
        ) : child ? (
          <section
            className="flex flex-col gap-4 rounded-panel bg-surface p-5 ring-2 ring-ink/10"
            aria-label={`Who ${child.nickname} can hear`}
            data-testid="circle-card"
          >
            <div className="flex items-center gap-3">
              <StorytellerAvatar name={child.nickname} avatarUrl={null} tint={child.tint} size="md" />
              <p className="font-display text-xl font-semibold">{child.nickname}</p>
            </div>
            {(() => {
              const hears = people.filter((p) => p.canHear.includes(child.id)).map((p) => p.name);
              return <p>{hears.length ? `${child.nickname} can hear ${and(hears)}.` : `${child.nickname} can't hear any family voices yet.`}</p>;
            })()}
            <Link href={`/family/kids/${child.id}/storytellers`} className={`${buttonSecondary} self-start`}>
              Manage {child.nickname}&apos;s storytellers
            </Link>
          </section>
        ) : (
          <p className="rounded-panel bg-surface/70 p-5 text-muted">
            {people.length
              ? "Tap anyone to see whether their voice is ready and which kids can hear them."
              : "Invite someone to start your storytelling circle."}
          </p>
        )}
      </div>
    </div>
  );
}
