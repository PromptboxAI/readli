"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { INVITATION_STATUS_LABELS, type InvitationStatus } from "@/lib/invitations/invitations";

export interface InvitationItem {
  id: string;
  name: string;
  relationship: string;
  email: string;
  status: InvitationStatus;
  sentCount: number;
  expiresAt: string;
  canResend: boolean;
  canRevoke: boolean;
}

const TONE: Record<InvitationStatus, string> = {
  accepted: "bg-mint",
  opened: "bg-sky",
  pending: "bg-sunshine",
  expired: "bg-ink/10",
  declined: "bg-ink/10",
  revoked: "bg-ink/10",
};

const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The contributor's invitations with resend and withdraw. "Opened" means the preview page was visited, not an email pixel. */
export function InvitationList({ items }: { items: InvitationItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(id: string, action: "resend" | "revoke") {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/invitations/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "That didn't work. Please try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const counts = items.reduce<Record<string, number>>((c, i) => ((c[i.status] = (c[i.status] ?? 0) + 1), c), {});
  return (
    <section className="flex flex-col gap-4" data-testid="invitation-list">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">Your invitations</h2>
        <p className="text-sm text-muted">
          {(["accepted", "opened", "pending", "expired", "declined"] as const)
            .filter((s) => counts[s])
            .map((s) => `${counts[s]} ${INVITATION_STATUS_LABELS[s].toLowerCase()}`)
            .join(" · ") || "None yet"}
        </p>
      </div>
      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((i) => (
            <li key={i.id} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-display text-lg font-semibold">{i.name || i.email}</span>
                <span className="truncate text-sm text-muted">{[i.relationship, i.name ? i.email : "", i.status === "pending" || i.status === "opened" ? `link works until ${date(i.expiresAt)}` : ""].filter(Boolean).join(" · ")}</span>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${TONE[i.status]}`}>{INVITATION_STATUS_LABELS[i.status]}</span>
              <div className="flex gap-2">
                {i.canResend && (
                  <button type="button" className="min-h-11 rounded-full px-3 font-semibold underline underline-offset-4 disabled:opacity-50" disabled={busy === i.id} onClick={() => act(i.id, "resend")}>
                    Resend
                  </button>
                )}
                {i.canRevoke && (
                  <button type="button" className="min-h-11 rounded-full px-3 font-semibold underline underline-offset-4 disabled:opacity-50" disabled={busy === i.id} onClick={() => act(i.id, "revoke")}>
                    Withdraw
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-coral-deep">
          {error}
        </p>
      )}
      <p className="text-sm text-muted">&quot;Opened&quot; means they visited your preview page. We don&apos;t put tracking pixels in emails.</p>
    </section>
  );
}
