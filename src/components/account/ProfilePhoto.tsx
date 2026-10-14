"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
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

/** Add, replace or remove a grown-up's profile photo. Nothing is uploaded until they agree to how it's used. */
export function ProfilePhoto({ name, tint, avatarUrl }: { name: string; tint: string; avatarUrl: string | null }) {
  const id = useId();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const send = async (init: RequestInit) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/photo", init);
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const fallback = res.status === 413 ? "That photo is too big to send. Please choose a smaller one." : "Something went wrong. Please try again.";
      setError(body?.error?.message ?? fallback);
      return;
    }
    setFile(null);
    setConsent(false);
    router.refresh();
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    const photo = await shrink(file);
    if (photo.size > MAX_BYTES) {
      setBusy(false);
      return setError("Please choose a photo smaller than 5 MB.");
    }
    const form = new FormData();
    form.set("photo", photo, "photo.jpg");
    form.set("consent", consent ? "yes" : "no");
    await send({ method: "POST", body: form });
  };

  return (
    <form id="photo" onSubmit={(e) => void upload(e)} className="flex scroll-mt-6 flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="font-display text-2xl font-semibold">
        Your photo
      </h2>
      <div className="flex items-center gap-4">
        <StorytellerAvatar name={name} avatarUrl={preview ?? avatarUrl} tint={tint} size="lg" />
        <p>
          {preview
            ? "Here's how your photo will look. Tick the box below, then save it."
            : avatarUrl
              ? "Your family sees this photo next to your name and your voice."
              : "Your family sees your initials until you add a photo. A photo is optional."}
        </p>
      </div>
      {/* The native file input is hidden behind a real button, so it looks and feels clickable everywhere. */}
      <label className={`${buttonSecondary} cursor-pointer self-start focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-ink`}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            setError(null);
            setFile(e.target.files?.[0] ?? null);
          }}
        />
        {file ? "Choose a different photo" : avatarUrl ? "Choose a new photo" : "Choose a photo"}
      </label>
      {file && <p className="truncate text-sm text-muted">{file.name}</p>}
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          This is a photo of me, I&apos;m an adult, and I agree that Readli shows it to the people in my families. No photos of children.
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={buttonPrimary} disabled={busy || !file || !consent}>
          {busy ? "Saving…" : "Save photo"}
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
