"use client";

import { useEffect, useRef, useState } from "react";
import { buttonSmall, buttonSmallPrimary } from "@/components/brand/buttons";

type Action = (form: FormData) => Promise<void>;

interface Props {
  id: string;
  reference: string;
  orgName: string;
  /** Pending or waiting on the applicant: only these can be declined. */
  canDecline: boolean;
  /** Approved requests carry a certificate, so they can't be deleted. */
  canDelete: boolean;
  show: string;
  q: string;
  declineAction: Action;
  deleteAction: Action;
}

/** The three-dot menu on a donation request row: Decline (with a reason the applicant sees) and Delete (spam or junk). */
export function RequestRowMenu({ id, reference, orgName, canDecline, canDelete, show, q, declineAction, deleteAction }: Props) {
  // The table scrolls sideways, which would clip a dropdown, so the menu is placed on the page (fixed) under the button.
  const [open, setOpen] = useState<{ top: number; right: number } | null>(null);
  const [confirm, setConfirm] = useState<"decline" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(null);
    };
    const dismiss = () => setOpen(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  useEffect(() => {
    if (confirm) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirm]);

  if (!canDecline && !canDelete) return null;

  const pick = (which: "decline" | "delete") => {
    setOpen(null);
    setBusy(false);
    setConfirm(which);
  };

  const hidden = (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="from" value="list" />
      <input type="hidden" name="show" value={show} />
      <input type="hidden" name="q" value={q} />
    </>
  );

  return (
    <div ref={wrap}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={Boolean(open)}
        aria-label={`Actions for ${reference}`}
        onClick={(e) => {
          if (open) return setOpen(null);
          const b = e.currentTarget.getBoundingClientRect();
          setOpen({ top: b.bottom + 4, right: window.innerWidth - b.right });
        }}
        className="inline-flex size-9 items-center justify-center rounded-full text-xl leading-none font-bold hover:bg-ink/10"
        data-testid="donation-row-menu"
      >
        <span aria-hidden>⋯</span>
      </button>
      {open && (
        <ul role="menu" style={{ top: open.top, right: open.right }} className="fixed z-30 flex min-w-40 flex-col rounded-2xl bg-surface p-1.5 shadow-lg ring-2 ring-ink/10">
          {canDecline && (
            <li role="none">
              <button type="button" role="menuitem" onClick={() => pick("decline")} className="w-full rounded-xl px-3 py-2 text-left font-semibold hover:bg-ink/5">
                Decline…
              </button>
            </li>
          )}
          {canDelete && (
            <li role="none">
              <button type="button" role="menuitem" onClick={() => pick("delete")} className="w-full rounded-xl px-3 py-2 text-left font-semibold text-coral-deep hover:bg-coral/15">
                Delete…
              </button>
            </li>
          )}
        </ul>
      )}
      <dialog
        ref={dialog}
        onClose={() => setConfirm(null)}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[var(--radius-panel)] bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
        aria-labelledby={`menu-h-${id}`}
      >
        {confirm === "decline" && (
          <form action={declineAction} onSubmit={() => setBusy(true)} className="flex flex-col gap-3 p-5 sm:p-6">
            {hidden}
            <h2 id={`menu-h-${id}`} className="font-display text-xl font-semibold">
              Decline {reference}?
            </h2>
            <p className="text-sm">
              {orgName} gets an email with your reason and a way to ask us to reconsider. For spam, use Delete instead, which sends nothing.
            </p>
            <label htmlFor={`reason-${id}`} className="text-sm font-semibold">
              A short, kind reason
            </label>
            <textarea id={`reason-${id}`} name="reason" required maxLength={2000} autoFocus className="min-h-24 rounded-2xl bg-surface p-3 ring-2 ring-ink/20" />
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={buttonSmall} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className={buttonSmallPrimary} disabled={busy}>
                {busy ? "Declining…" : "Decline and email"}
              </button>
            </div>
          </form>
        )}
        {confirm === "delete" && (
          <form action={deleteAction} onSubmit={() => setBusy(true)} className="flex flex-col gap-3 p-5 sm:p-6">
            {hidden}
            <h2 id={`menu-h-${id}`} className="font-display text-xl font-semibold">
              Delete {reference}?
            </h2>
            <p className="text-sm">
              This removes the request from {orgName}, its uploaded files and its activity for good. No email is sent. The deletion is kept in the admin activity log.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={buttonSmall} onClick={() => setConfirm(null)} autoFocus>
                Cancel
              </button>
              <button className={buttonSmallPrimary} disabled={busy}>
                {busy ? "Deleting…" : "Delete for good"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
