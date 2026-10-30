"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { buttonSmall, buttonSmallPrimary, buttonSmallQuiet } from "@/components/brand/buttons";
import type { DeletionBlocker } from "@/lib/account/privacy";

const DELETE_CONFIRMATION = "DELETE";

async function errorText(res: Response) {
  const body = await res.json().catch(() => null);
  return (body?.error?.message as string | undefined) ?? "Something went wrong. Please try again.";
}

function blockerText(b: DeletionBlocker): string {
  if (b.kind === "only_guardian") {
    return `You're the only parent or guardian for kids profiles in ${b.householdName}. Another grown-up there needs to look after every kids profile first, or remove the kids profiles.`;
  }
  return `Your gift for ${b.recipientName} still renews every month. Stop the renewals first.`;
}

/** A copy of a grown-up's data and deleting their account, as two rows. Deleting opens its warning first. */
export function AccountSettings({ blockers }: { blockers: DeletionBlocker[] }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm }) });
    if (!res.ok) {
      setBusy(false);
      setError(await errorText(res));
      router.refresh();
      return;
    }
    window.location.assign("/");
  };

  return (
    <section className="divide-y-2 divide-ink/5 rounded-3xl bg-surface ring-2 ring-ink/10" aria-labelledby={`${id}-h`} data-testid="your-data">
      <h2 id={`${id}-h`} className="sr-only">
        Your data
      </h2>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Download my data</p>
          <p className="text-sm text-muted">Your profile, families, kids profiles, voices, sharing and consents. Recordings and audio aren&apos;t included.</p>
        </div>
        <a href="/api/account/export" download className={buttonSmall}>
          Download
        </a>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Delete my account</p>
            <p className="text-sm text-muted">Removes your voice, recordings and every story made in it. This can&apos;t be undone.</p>
          </div>
          {!open && (
            <button type="button" className={`${buttonSmall} border-coral-deep text-coral-deep`} onClick={() => setOpen(true)}>
              Delete…
            </button>
          )}
        </div>
        {open && (
          <form onSubmit={remove} className="flex flex-col gap-3 rounded-2xl bg-ivory p-4 ring-2 ring-coral-deep/30">
            <p>Deleting your account:</p>
            <ul className="list-disc pl-6 text-sm">
              <li>removes your voice from our voice service, so no one can hear a story in your voice again,</li>
              <li>deletes your recordings and every story made in your voice,</li>
              <li>deletes families only you belong to, with their kids profiles,</li>
              <li>removes you from families you share, which carry on without you.</li>
            </ul>
            {blockers.length > 0 ? (
              <div role="status" className="flex flex-col gap-2 rounded-2xl bg-sunshine/50 p-3" data-testid="deletion-blockers">
                <p className="font-semibold">Before you can delete your account:</p>
                <ul className="list-disc pl-6">
                  {blockers.map((b) => (
                    <li key={b.kind === "only_guardian" ? b.householdId : b.giftId}>{blockerText(b)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <label htmlFor={`${id}-confirm`} className="font-semibold">
                  Type {DELETE_CONFIRMATION} to confirm
                </label>
                <input
                  id={`${id}-confirm`}
                  className="min-h-11 w-full max-w-xs rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink"
                  value={confirm}
                  autoComplete="off"
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {blockers.length === 0 && (
                <button type="submit" className={buttonSmallPrimary} disabled={busy || confirm !== DELETE_CONFIRMATION}>
                  {busy ? "Deleting…" : "Delete my account"}
                </button>
              )}
              <button type="button" className={buttonSmallQuiet} disabled={busy} onClick={() => (setOpen(false), setConfirm(""))}>
                Keep my account
              </button>
            </div>
          </form>
        )}
        {error && (
          <p role="alert" className="font-semibold text-coral-deep">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
