"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { buttonSmall, buttonSmallPrimary, buttonSmallQuiet } from "@/components/brand/buttons";
import { StorytellerAvatar } from "@/components/family/StorytellerAvatar";

const MAX_BYTES = 5 * 1024 * 1024;
/** A profile photo is shown at most a few hundred pixels wide, so this is plenty. */
const MAX_SIDE = 1024;

/**
 * Phone photos are often several megabytes, which is slow to send and can exceed the host's request
 * size limit. Shrink to a 1024px JPEG in the browser first; if the browser can't read the image, send
 * the original and let the server decide.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

async function errorText(res: Response, fallback = "Something went wrong. Please try again.") {
  const body = await res.json().catch(() => null);
  return (body?.error?.message as string | undefined) ?? fallback;
}

/**
 * How a grown-up appears to their family: photo and name together, with the email they sign in with.
 * A new photo isn't uploaded until they agree to how it's used.
 */
export function ProfileCard({ name, email, tint, avatarUrl }: { name: string; email: string | null; tint: string; avatarUrl: string | null }) {
  const id = useId();
  const router = useRouter();
  const [draft, setDraft] = useState(name);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"name" | "photo" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const start = (what: "name" | "photo") => {
    setBusy(what);
    setStatus(null);
    setError(null);
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    start("name");
    const res = await fetch("/api/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: draft }) });
    setBusy(null);
    if (!res.ok) return setError(await errorText(res));
    setStatus("Name saved.");
    router.refresh();
  };

  const sendPhoto = async (init: RequestInit, done: string) => {
    const res = await fetch("/api/account/photo", init);
    setBusy(null);
    if (!res.ok) return setError(await errorText(res, res.status === 413 ? "That photo is too big to send. Please choose a smaller one." : undefined));
    setFile(null);
    setConsent(false);
    setStatus(done);
    router.refresh();
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    start("photo");
    const photo = await shrink(file);
    if (photo.size > MAX_BYTES) {
      setBusy(null);
      return setError("Please choose a photo smaller than 5 MB.");
    }
    const form = new FormData();
    form.set("photo", photo, "photo.jpg");
    form.set("consent", consent ? "yes" : "no");
    await sendPhoto({ method: "POST", body: form }, "Photo saved.");
  };

  return (
    <section id="profile" className="flex scroll-mt-24 flex-col gap-4 rounded-3xl bg-surface p-5 ring-2 ring-ink/10" aria-labelledby={`${id}-h`} data-testid="profile-card">
      <h2 id={`${id}-h`} className="sr-only">
        Profile
      </h2>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <StorytellerAvatar name={draft || name} avatarUrl={preview ?? avatarUrl} tint={tint} size="lg" />
          {/* The native file input is hidden behind a real button, so it looks and feels clickable everywhere. */}
          <label className={`${buttonSmallQuiet} cursor-pointer focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-ink`}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                setError(null);
                setStatus(null);
                setFile(e.target.files?.[0] ?? null);
              }}
            />
            {file ? "Choose another" : avatarUrl ? "Change photo" : "Add a photo"}
          </label>
          {avatarUrl && !file && (
            <button type="button" className={`${buttonSmallQuiet} min-h-8 text-sm text-muted`} disabled={busy !== null} onClick={() => (start("photo"), void sendPhoto({ method: "DELETE" }, "Photo removed."))}>
              Remove
            </button>
          )}
        </div>
        <form onSubmit={saveName} className="flex w-full min-w-0 flex-col gap-2">
          <label htmlFor={`${id}-name`} className="text-sm font-bold tracking-wider text-muted uppercase">
            Your name
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-name`}
              className="min-h-11 w-full min-w-0 rounded-2xl border-[3px] border-ink/20 bg-ivory px-4 text-lg focus:border-ink"
              value={draft}
              maxLength={60}
              required
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className={buttonSmall} disabled={busy !== null || draft.trim() === name}>
              {busy === "name" ? "Saving…" : "Save"}
            </button>
          </div>
          {email && <p className="text-sm text-muted">Signed in as {email}</p>}
          <p className="text-sm text-muted">Your family sees this name and photo next to your voice. {avatarUrl ? "" : "A photo is optional."}</p>
        </form>
      </div>
      {file && (
        <form onSubmit={(e) => void upload(e)} className="flex flex-col gap-3 rounded-2xl bg-ivory p-4" data-testid="photo-consent">
          <p className="truncate text-sm text-muted">{file.name}</p>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>This is a photo of me, I&apos;m an adult, and I agree that Readli shows it to the people in my families. No photos of children.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={buttonSmallPrimary} disabled={busy !== null || !consent}>
              {busy === "photo" ? "Saving…" : "Save photo"}
            </button>
            <button type="button" className={buttonSmallQuiet} disabled={busy !== null} onClick={() => setFile(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <p role="status" aria-live="polite" className={status ? "font-semibold" : "sr-only"}>
        {status}
      </p>
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </section>
  );
}
