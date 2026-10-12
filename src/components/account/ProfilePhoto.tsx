"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { buttonPrimary, buttonQuiet } from "@/components/brand/buttons";
import { StorytellerAvatar } from "@/components/family/StorytellerAvatar";

const MAX_BYTES = 5 * 1024 * 1024;

/** Add, replace or remove a grown-up's profile photo. Nothing is uploaded until they agree to how it's used. */
export function ProfilePhoto({ name, tint, avatarUrl }: { name: string; tint: string; avatarUrl: string | null }) {
  const id = useId();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (init: RequestInit) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/photo", init);
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Something went wrong. Please try again.");
      return;
    }
    setFile(null);
    setConsent(false);
    router.refresh();
  };

  const upload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("Please choose a photo smaller than 5 MB.");
    const form = new FormData();
    form.set("photo", file);
    form.set("consent", consent ? "yes" : "no");
    void send({ method: "POST", body: form });
  };

  return (
    <form id="photo" onSubmit={upload} className="flex scroll-mt-6 flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="font-display text-2xl font-semibold">
        Your photo
      </h2>
      <div className="flex items-center gap-4">
        <StorytellerAvatar name={name} avatarUrl={avatarUrl} tint={tint} size="lg" />
        <p>
          {avatarUrl
            ? "Your family sees this photo next to your name and your voice."
            : "Your family sees your initials until you add a photo. A photo is optional."}
        </p>
      </div>
      <label htmlFor={`${id}-file`} className="font-semibold">
        {avatarUrl ? "Choose a new photo" : "Choose a photo"}
      </label>
      <input
        id={`${id}-file`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="text-base"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          This is a photo of me, I&apos;m an adult, and I agree that Readli shows it to the people in my families. No photos of children.
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={buttonPrimary} disabled={busy || !file || !consent}>
          Save photo
        </button>
        {avatarUrl && (
          <button type="button" className={buttonQuiet} disabled={busy} onClick={() => void send({ method: "DELETE" })}>
            Remove photo
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </form>
  );
}
