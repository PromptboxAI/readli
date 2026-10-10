"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { addDays, addMonths, cancelGift, renewalNotices, STATUS_LABEL, statusAt, type Gift } from "@/lib/gifting/lifecycle";
import { giftPlan } from "@/lib/gifting/plans";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function sampleGifts(now: Date): Gift[] {
  const base = { giverName: "You", message: "", renewalsStopped: false, recipientEmail: "" };
  return [
    {
      ...base,
      id: "g-ben",
      plan: giftPlan("prepaid_3m")!,
      status: "sent",
      recipientName: "Ben and family",
      deliverOn: addDays(now, -3),
      sentAt: addDays(now, -3),
      redeemedAt: null,
      paidThrough: null,
    },
    {
      ...base,
      id: "g-priya",
      plan: giftPlan("sponsored_monthly")!,
      status: "active",
      recipientName: "Aunt Priya",
      deliverOn: addDays(now, -40),
      sentAt: addDays(now, -40),
      redeemedAt: addDays(now, -38),
      paidThrough: addDays(now, 6),
    },
    {
      ...base,
      id: "g-lou",
      plan: giftPlan("prepaid_12m")!,
      status: "active",
      recipientName: "Grandpa Lou",
      deliverOn: addMonths(now, -11),
      sentAt: addMonths(now, -11),
      redeemedAt: addMonths(now, -11),
      paidThrough: addDays(now, 12),
    },
  ];
}

const TINT: Record<string, string> = { sent: "bg-sunshine", active: "bg-mint", cancelled: "bg-surface ring-2 ring-ink/20", ended: "bg-surface ring-2 ring-ink/20" };

export function GiftManager({ nowIso }: { nowIso: string }) {
  const now = new Date(nowIso);
  const [gifts, setGifts] = useState(() => sampleGifts(now));
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  function confirmCancel(g: Gift) {
    const r = cancelGift(g, now);
    if (r.ok) setGifts((all) => all.map((x) => (x.id === g.id ? r.gift : x)));
    setNotes((n) => ({ ...n, [g.id]: `${r.summary} (Preview: nothing was changed.)` }));
    setConfirming(null);
  }

  return (
    <ul className="flex flex-col gap-4" data-testid="gift-list">
      {gifts.map((g) => {
        const status = statusAt(g, now);
        const recurring = g.plan.kind === "recurring";
        const notices = renewalNotices(g).filter((n) => n.audience === "giver");
        const canCancel = status === "sent" || (status === "active" && recurring && !g.renewalsStopped);
        return (
          <li key={g.id} className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-semibold">{g.recipientName}</h3>
                <p>{recurring ? "Monthly sponsorship" : `${g.plan.name}, paid once`}</p>
              </div>
              <span className={`rounded-full px-3 py-1 font-display text-sm font-semibold ${TINT[status] ?? "bg-ivory"}`}>
                {recurring && g.renewalsStopped && status === "active" ? "Ends soon" : STATUS_LABEL[status]}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {g.sentAt && (
                <div>
                  <dt className="inline font-semibold">Sent: </dt>
                  <dd className="inline">{fmt(g.sentAt)}</dd>
                </div>
              )}
              {g.redeemedAt && (
                <div>
                  <dt className="inline font-semibold">Opened: </dt>
                  <dd className="inline">{fmt(g.redeemedAt)}</dd>
                </div>
              )}
              {g.paidThrough && (
                <div>
                  <dt className="inline font-semibold">{recurring && !g.renewalsStopped ? "Next renewal: " : "Ends: "}</dt>
                  <dd className="inline">{fmt(g.paidThrough)}</dd>
                </div>
              )}
            </dl>
            {notices.map((n) => (
              <p key={n.kind} className="rounded-2xl bg-sky/30 p-3 text-sm">
                {n.kind === "renewal_upcoming"
                  ? `Renewal notice: we'll email you on ${fmt(n.sendAt)}, before the next monthly charge.`
                  : n.sendAt.getTime() <= now.getTime()
                    ? `Ending notice: we emailed you on ${fmt(n.sendAt)} that this gift is ending. ${g.recipientName} gets a reminder too.`
                    : `Ending notice: we'll email you on ${fmt(n.sendAt)} that this gift is ending, and remind ${g.recipientName} too.`}
              </p>
            ))}
            {notes[g.id] && (
              <p role="status" className="rounded-2xl bg-mint/50 p-3 text-sm">
                {notes[g.id]}
              </p>
            )}
            {confirming === g.id ? (
              <div className="flex flex-col gap-3 rounded-2xl bg-coral/20 p-4">
                <p className="font-semibold">
                  {status === "sent"
                    ? `Cancel this gift? ${g.recipientName}'s link will stop working and you'll get a full refund.`
                    : `Stop renewing? ${g.recipientName} keeps Readli until ${g.paidThrough ? fmt(g.paidThrough) : "the end of this month"}, and we'll let them know.`}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={buttonPrimary} onClick={() => confirmCancel(g)}>
                    {status === "sent" ? "Cancel gift" : "Stop renewing"}
                  </button>
                  <button type="button" className={buttonSecondary} onClick={() => setConfirming(null)}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {canCancel && (
                  <button type="button" className={buttonSecondary} onClick={() => setConfirming(g.id)}>
                    {status === "sent" ? "Cancel gift" : "Stop renewing"}
                  </button>
                )}
                {status === "sent" && (
                  <button type="button" className={buttonSecondary} onClick={() => setNotes((n) => ({ ...n, [g.id]: "Preview: we'd resend the gift email." }))}>
                    Resend
                  </button>
                )}
                {!recurring && status !== "sent" && (
                  <Link href={`/invite/gift?plan=${g.plan.id}&to=${encodeURIComponent(g.recipientName)}`} className={buttonSecondary}>
                    Gift again
                  </Link>
                )}
                {!canCancel && status === "active" && !recurring && (
                  <p className="self-center text-sm text-muted">Opened gifts run to the end of their term.</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
