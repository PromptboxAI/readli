"use client";

import { useState, useTransition } from "react";
import type { IssuedGift, IssuedStatus } from "@/lib/admin/complimentary";
import { revealCodeAction, revokeAndReplaceAction, type RowResult } from "../actions";

const STATUS: Record<IssuedStatus, { label: string; tone: string }> = {
  unclaimed: { label: "Unclaimed", tone: "bg-sunshine" },
  claimed: { label: "Claimed", tone: "bg-mint" },
  revoked: { label: "Revoked", tone: "bg-ink/10" },
  expired: { label: "Expired", tone: "bg-ink/10" },
};

const chip = "inline-flex min-h-11 items-center rounded-xl bg-ivory px-3 font-bold ring-2 ring-ink/20 hover:ring-ink";
const short = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Downloads({ id }: { id: string }) {
  const files = [
    ["certificate.pdf", "Certificate PDF"],
    ["qr.png", "QR PNG"],
    ["qr.svg", "QR SVG"],
  ] as const;
  return (
    <>
      <div className="hidden flex-wrap gap-2 sm:flex">
        {files.map(([f, label]) => (
          <a key={f} href={`/api/admin/complimentary/${id}/${f}`} className={chip} download>
            {label}
          </a>
        ))}
      </div>
      <details className="relative sm:hidden">
        <summary className={`${chip} cursor-pointer list-none`}>Download ▾</summary>
        <div className="absolute z-10 mt-1 flex w-48 flex-col gap-1 rounded-2xl bg-surface p-2 shadow-lg ring-2 ring-ink/10">
          {files.map(([f, label]) => (
            <a key={f} href={`/api/admin/complimentary/${id}/${f}`} className="rounded-lg px-3 py-2.5 font-bold hover:bg-ink/5" download>
              {label}
            </a>
          ))}
        </div>
      </details>
    </>
  );
}

function Row({ batchId, gift }: { batchId: string; gift: IssuedGift }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<RowResult>(null);
  const [copied, setCopied] = useState(false);
  const open = gift.status === "unclaimed";
  const shown = result && "code" in result ? result : null;

  function reveal(copy: boolean) {
    start(async () => {
      const r = await revealCodeAction(batchId, gift.id);
      setResult(r);
      if (copy && r && "link" in r && r.link) {
        try {
          await navigator.clipboard.writeText(r.link);
          setCopied(true);
        } catch {
          /* Clipboard blocked: the link is shown to copy by hand. */
        }
      }
    });
  }

  function revoke() {
    if (!window.confirm(`Revoke ${gift.certificate}? Its link, QR code and certificate stop working, and a replacement with a new code is issued.`)) return;
    start(async () => setResult(await revokeAndReplaceAction(batchId, gift.id)));
  }

  return (
    <li className="flex flex-col gap-3 border-b border-ink/10 p-4 last:border-b-0 sm:p-5" data-testid="issued-row">
      <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[7rem_10rem_9rem_1fr_auto]">
        <span className={`font-display text-lg font-semibold ${gift.status === "revoked" ? "text-muted line-through" : ""}`}>{gift.certificate}</span>
        <span className="font-mono">{gift.last4 ? `••••-••••-${gift.last4}` : "Not stored"}</span>
        <span className={`w-fit rounded-full px-3 py-1 text-sm font-bold ${STATUS[gift.status].tone}`}>
          {STATUS[gift.status].label}
          {gift.status === "claimed" && gift.redeemedAt ? ` ${short(gift.redeemedAt)}` : ""}
        </span>
        <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
          {gift.status === "revoked" ? (
            <span className="text-sm text-muted">{gift.replacedBy ? `Replaced by ${gift.replacedBy}.` : "Revoked."} Its link and QR code no longer work.</span>
          ) : gift.hasArtwork ? (
            <>
              <Downloads id={gift.id} />
              {open && (
                <button type="button" className={chip} onClick={() => reveal(true)} disabled={pending}>
                  {copied ? "Link copied" : "Copy link"}
                </button>
              )}
            </>
          ) : (
            <span className="text-sm text-muted">Only a scrambled copy was kept, so this code can&apos;t be shown or printed again.</span>
          )}
        </div>
        {open && (
          <button type="button" onClick={revoke} disabled={pending} className="col-span-2 min-h-11 justify-self-start font-bold text-coral-deep underline sm:col-span-1 sm:justify-self-end">
            Revoke and replace
          </button>
        )}
      </div>
      {open && gift.hasArtwork && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {shown ? (
            <span className="font-mono text-base" data-testid="revealed-code">
              {shown.code}
            </span>
          ) : (
            <button type="button" className="min-h-11 font-bold underline" onClick={() => reveal(false)} disabled={pending}>
              Show full code
            </button>
          )}
          <span className="text-muted">(recorded in the audit trail)</span>
        </div>
      )}
      {result && "error" in result && (
        <p role="alert" className="rounded-xl bg-coral/30 px-3 py-2">
          {result.error}
        </p>
      )}
      {result && "message" in result && !("code" in result) && (
        <p role="status" className="rounded-xl bg-mint/40 px-3 py-2">
          {result.message}
        </p>
      )}
    </li>
  );
}

export function IssuedTable({ batchId, gifts }: { batchId: string; gifts: IssuedGift[] }) {
  return (
    <section aria-label="Issued memberships" className="overflow-hidden rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10">
      <div className="hidden grid-cols-[7rem_10rem_9rem_1fr_auto] gap-3 border-b-2 border-ink/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.06em] text-muted sm:grid">
        <span>Certificate</span>
        <span>Code</span>
        <span>Status</span>
        <span>Artwork</span>
        <span />
      </div>
      <ul>
        {gifts.map((g) => (
          <Row key={g.id} batchId={batchId} gift={g} />
        ))}
      </ul>
    </section>
  );
}
