"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { PlayButton } from "./PlayButton";

export interface PickerBook {
  slug: string;
  title: string;
  author: string;
  coverUrl: string | null;
  passages: { id: string; text: string }[];
}

interface Preview {
  id: string;
  book: string;
  passageId: string;
}

/**
 * The contributor picks a book and a passage, hears it read in their own Readli voice, and approves
 * it. The approved clip is what every invitation plays; a new approval replaces it.
 */
export function PreviewPicker({ books, approved, draft, generationsLeft }: { books: PickerBook[]; approved: Preview | null; draft: Preview | null; generationsLeft: number }) {
  const router = useRouter();
  const [choosing, setChoosing] = useState(!approved);
  const [book, setBook] = useState<string | null>(draft?.book ?? null);
  const [passage, setPassage] = useState<string | null>(draft?.passageId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const titleOf = (slug: string) => books.find((b) => b.slug === slug)?.title ?? "your story";
  const chosen = books.find((b) => b.slug === book);

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong. Please try again.");
      router.refresh();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (approved && !choosing) {
    return (
      <section className="flex flex-col gap-3" data-testid="approved-preview">
        <h2 className="font-display text-2xl font-semibold">What they&apos;ll hear</h2>
        <PlayButton label={`${titleOf(approved.book)}, in your voice`} endpoint={`/api/invitations/preview/${approved.id}`} />
        <p className="text-sm">
          Your approved preview, made with your Readli voice. Your original recordings are never shared.{" "}
          <button type="button" className="font-semibold underline underline-offset-4" onClick={() => setChoosing(true)}>
            Choose a different passage
          </button>
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4" data-testid="preview-picker">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-semibold">Choose what they&apos;ll hear</h2>
        <p>Pick a book, then a short passage. We&apos;ll read it in your Readli voice so you can listen before anyone else does.</p>
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
        {books.map((b) => (
          <li key={b.slug}>
            <button
              type="button"
              onClick={() => (setBook(b.slug), setPassage(b.passages[0]?.id ?? null))}
              aria-pressed={book === b.slug}
              className={`flex w-full flex-col gap-1 rounded-2xl p-1.5 text-left ${book === b.slug ? "bg-sunshine ring-[3px] ring-ink" : "bg-surface ring-2 ring-ink/10"}`}
            >
              {b.coverUrl && <Image src={b.coverUrl} alt="" width={160} height={213} className="aspect-[3/4] w-full rounded-xl object-cover" />}
              <span className="line-clamp-2 text-sm font-semibold leading-tight">{b.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {chosen && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-display text-xl font-semibold">A passage from {chosen.title}</legend>
          {chosen.passages.map((p) => (
            <label key={p.id} className={`flex items-start gap-3 rounded-2xl p-4 ${passage === p.id ? "bg-sunshine/60 ring-2 ring-ink" : "bg-surface ring-2 ring-ink/10"}`}>
              <input type="radio" name="passage" className="mt-1 size-5 accent-coral-deep" checked={passage === p.id} onChange={() => setPassage(p.id)} />
              <span className="text-sm leading-relaxed">{p.text}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="button" className={buttonPrimary} disabled={!passage || busy || generationsLeft < 1} onClick={() => post("/api/invitations/preview", { passageId: passage })} data-testid="make-preview">
          {busy ? "Reading it in your voice…" : draft ? "Read this one instead" : "Read it in my voice"}
        </button>
        {approved && (
          <button type="button" className={buttonSecondary} onClick={() => setChoosing(false)}>
            Keep my current preview
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        {generationsLeft > 0 ? `You can make ${generationsLeft} more ${generationsLeft === 1 ? "preview" : "previews"} this month.` : "You've made all your previews for this month."}
      </p>
      {draft && (
        <div className="flex flex-col gap-3 rounded-3xl bg-mint/50 p-4" data-testid="draft-preview">
          <p className="font-display text-lg font-semibold">Listen before you approve</p>
          <PlayButton label={`${titleOf(draft.book)}, in your voice`} endpoint={`/api/invitations/preview/${draft.id}`} />
          <button type="button" className={`${buttonPrimary} w-fit`} disabled={busy} onClick={async () => (await post("/api/invitations/preview/approve", { previewId: draft.id })) && setChoosing(false)}>
            Approve this preview
          </button>
          <p className="text-sm">Only approved previews are ever shared. You can replace it later.</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-coral-deep">
          {error}
        </p>
      )}
    </section>
  );
}
