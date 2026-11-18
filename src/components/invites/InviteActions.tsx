import Link from "next/link";
import { EnvelopeArt, GiftBoxArt } from "@/components/invites/illustrations";

/**
 * "Invite Family" and "Invite & Gift", side by side. Drop-in for the Family dashboard; no props.
 */
export function InviteActions({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as "h2" | "h3";
  const cards = [
    {
      href: "/invite/family",
      title: "Invite Family",
      body: "Ask a grandparent, aunt or friend to join your family circle and record their own voice.",
      note: "Free to invite",
      art: <EnvelopeArt className="w-24 sm:w-28" />,
      tint: "bg-mint/60",
    },
    {
      href: "/gift/family",
      title: "Invite & Gift",
      body: "Give up to two families Readli Family. You pay, and each runs its own family library.",
      note: "A gift for their home",
      art: <GiftBoxArt className="w-24 sm:w-28" />,
      tint: "bg-sunshine/60",
    },
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-2" data-testid="invite-actions">
      {cards.map((c) => (
        <li key={c.href}>
          <Link
            href={c.href}
            className={`group flex h-full items-center gap-4 rounded-[var(--radius-panel)] p-5 ring-2 ring-ink/10 transition-transform hover:-translate-y-0.5 hover:ring-ink sm:p-6 ${c.tint}`}
          >
            <span className="shrink-0">{c.art}</span>
            <span className="flex min-w-0 flex-col gap-1">
              <H className="font-display text-2xl font-semibold">{c.title}</H>
              <span>{c.body}</span>
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-surface px-3 py-1 font-display text-sm font-semibold">
                {c.note} <span aria-hidden="true">→</span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
