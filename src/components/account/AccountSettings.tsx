"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import type { DeletionBlocker } from "@/lib/account/privacy";

const DELETE_CONFIRMATION = "DELETE";
const input = "min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink";
const panel = "flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10";

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

/** A signed-in grown-up's name, a copy of their data, and deleting their account. */
export function AccountSettings({ name, email, blockers }: { name: string; email: string | null; blockers: DeletionBlocker[] }) {
  const id = useId();
  const router = useRouter();
  const [draft, setDraft] = useState(name);
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"name" | "delete" | null>(null);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("name");
    setSaved(false);
    setNameError(null);
    const res = await fetch("/api/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: draft }) });
    setBusy(null);
    if (!res.ok) return setNameError(await errorText(res));
    setSaved(true);
    router.refresh();
  };

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("delete");
    setDeleteError(null);
    const res = await fetch("/api/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm }) });
    if (!res.ok) {
      setBusy(null);
      setDeleteError(await errorText(res));
      router.refresh();
      return;
    }
    window.location.assign("/");
  };

  return (
    <>
      <form onSubmit={saveName} className={panel} aria-labelledby={`${id}-name-h`}>
        <h2 id={`${id}-name-h`} className="font-display text-2xl font-semibold">
          Your name
        </h2>
        <p>This is how your family sees you in Readli.{email ? ` You sign in as ${email}.` : ""}</p>
        <label htmlFor={`${id}-name`} className="font-semibold">
          Name
        </label>
        <input id={`${id}-name`} className={input} value={draft} maxLength={60} required onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className={`${buttonSecondary} self-start`} disabled={busy !== null || draft.trim() === name}>
          Save name
        </button>
        {saved && <p role="status" className="font-semibold">Saved.</p>}
        {nameError && (
          <p role="alert" className="font-semibold text-coral-deep">
            {nameError}
          </p>
        )}
      </form>

      <section className={panel} aria-labelledby={`${id}-data-h`}>
        <h2 id={`${id}-data-h`} className="font-display text-2xl font-semibold">
          Download my data
        </h2>
        <p>
          Get a copy of what Readli keeps about you: your profile, families, the kids profiles you look after, your voices and who
          you shared them with, and your consents. Voice recordings and narration audio aren&apos;t in the file.
        </p>
        <a href="/api/account/export" download className={`${buttonSecondary} self-start`}>
          Download my data
        </a>
      </section>

      <form onSubmit={remove} className={`${panel} ring-coral-deep/40`} aria-labelledby={`${id}-delete-h`}>
        <h2 id={`${id}-delete-h`} className="font-display text-2xl font-semibold">
          Delete my account
        </h2>
        <p>This can&apos;t be undone. Deleting your account:</p>
        <ul className="list-disc pl-6">
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
            <input id={`${id}-confirm`} className={input} value={confirm} autoComplete="off" onChange={(e) => setConfirm(e.target.value)} />
            <button type="submit" className={`${buttonPrimary} self-start`} disabled={busy !== null || confirm !== DELETE_CONFIRMATION}>
              {busy === "delete" ? "Deleting…" : "Delete my account"}
            </button>
          </>
        )}
        {deleteError && (
          <p role="alert" className="font-semibold text-coral-deep">
            {deleteError}
          </p>
        )}
      </form>
    </>
  );
}
