"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

/** The shortest passage: the quickest listen, and the one we start with. */
const shortest = (b: PickerBook | undefined) => b?.passages.reduce((a, p) => (p.text.length < a.text.length ? p : a), b.passages[0]!)?.id ?? null;
const excerpt = (text: string) => (text.length > 140 ? `${text.slice(0, 140).replace(/\s+\S*$/, "")}…` : text);

/**
 * Step one of sharing: the story families hear first. A recommended book and a short passage are
 * picked already, and made in the contributor's voice the first time they arrive, so they only listen
 * and approve. "Choose Another Story" opens every book. The approved clip is what every invitation
 * plays; a new approval replaces it. Approving goes on to the invitation form.
 */
export function PreviewPicker({ books, featured, approved, draft, sendHref }: { books: PickerBook[]; featured: string[]; approved: Preview | null; draft: Preview | null; sendHref: string }) {
  const router = useRouter();
  const start = books.find((b) => b.slug === (draft?.book ?? approved?.book ?? featured[0])) ?? books[0];
  const [book, setBook] = useState<string | null>(start?.slug ?? null);
  const [passage, setPassage] = useState<string | null>(draft?.passageId ?? approved?.passageId ?? shortest(start));
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState<"making" | "approving" | null>(null);
  const [error, setError] = useState("");
  const chosen = books.find((b) => b.slug === book);
  const titleOf = (slug: string) => books.find((b) => b.slug === slug)?.title ?? "your story";
  // The clip for what's selected now: a draft to approve, or the approved one.
  const current = draft && draft.passageId === passage ? draft : approved && approved.passageId === passage ? approved : null;
  // Three covers: the featured ones, with a story chosen from the full list taking the last place.
  const top = featured.slice(0, 3);
  const shown = (book && !top.includes(book) ? [...top.slice(0, 2), book] : top).map((s) => books.find((b) => b.slug === s)).filter((b): b is PickerBook => Boolean(b));

  async function post(url: string, body: Record<string, unknown>) {
    setError("");
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) throw new Error(data?.error?.message ?? "Something went wrong. Please try again.");
    return data;
  }

  const make = async (passageId: string | null = passage) => {
    if (!passageId) return;
    setBusy("making");
    try {
      await post("/api/invitations/preview", { passageId });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const approve = async (previewId: string) => {
    setBusy("approving");
    try {
      if (approved?.id !== previewId) await post("/api/invitations/preview/approve", { previewId });
      router.push(sendHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(null);
    }
  };

  // The first visit makes the recommended passage straight away, so there's something to hear.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || draft || approved) return;
    started.current = true;
    void make();
    // Only ever on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (b: PickerBook) => {
    setBook(b.slug);
    setPassage(shortest(b));
    setError("");
  };

  return (
    <section className="flex max-w-3xl flex-col gap-5" data-testid="preview-picker">
      <p className="text-lg">Your family hears this story first. We picked a favorite to start.</p>
      {!all && (
        <ul className="grid grid-cols-3 gap-3 sm:max-w-md">
          {shown.map((b) => (
            <li key={b.slug}>
              <button
                type="button"
                onClick={() => pick(b)}
                aria-pressed={book === b.slug}
                className={`flex w-full flex-col items-center gap-1 rounded-2xl p-1.5 ${book === b.slug ? "bg-surface ring-[3px] ring-coral-deep" : "bg-surface ring-2 ring-ink/10"}`}
              >
                {b.coverUrl && <Image src={b.coverUrl} alt="" width={160} height={213} className="aspect-[3/4] w-full rounded-xl object-cover" />}
                <span className="line-clamp-2 text-center text-sm font-semibold leading-tight">{b.slug === featured[0] ? "Recommended" : b.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {all && (
        <div className="flex flex-col gap-4" data-testid="all-stories">
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {books.map((b) => (
              <li key={b.slug}>
                <button
                  type="button"
                  onClick={() => pick(b)}
                  aria-pressed={book === b.slug}
                  className={`flex w-full flex-col gap-1 rounded-2xl p-1.5 text-left ${book === b.slug ? "bg-surface ring-[3px] ring-coral-deep" : "bg-surface ring-2 ring-ink/10"}`}
                >
                  {b.coverUrl && <Image src={b.coverUrl} alt="" width={160} height={213} className="aspect-[3/4] w-full rounded-xl object-cover" />}
                  <span className="line-clamp-2 text-sm font-semibold leading-tight">{b.title}</span>
                </button>
              </li>
            ))}
          </ul>
          {chosen && chosen.passages.length > 1 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-display text-lg font-semibold">Which part of {chosen.title}?</legend>
              {chosen.passages.map((p) => (
                <label key={p.id} className={`flex items-start gap-3 rounded-2xl bg-surface p-3 ${passage === p.id ? "ring-[3px] ring-coral-deep" : "ring-2 ring-ink/10"}`}>
                  <input type="radio" name="passage" className="mt-1 size-5 shrink-0 accent-coral-deep" checked={passage === p.id} onChange={() => setPassage(p.id)} />
                  <span className="text-sm leading-relaxed">{excerpt(p.text)}</span>
                </label>
              ))}
            </fieldset>
          )}
        </div>
      )}

      {chosen && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-sky/40 p-4 sm:p-6" data-testid="story-preview">
          <div>
            <p className="font-display text-xl font-semibold">{chosen.title}</p>
            <p className="text-sm italic">“{excerpt(chosen.passages.find((p) => p.id === passage)?.text ?? "")}”</p>
          </div>
          {busy === "making" ? (
            <p role="status" className="rounded-2xl bg-surface p-4 font-display font-semibold">
              Reading it in your voice…
            </p>
          ) : current ? (
            <PlayButton label={`Hear yourself read ${titleOf(current.book)}`} endpoint={`/api/invitations/preview/${current.id}`} testId="play-own-preview" />
          ) : (
            <button type="button" className={`${buttonSecondary} w-full sm:w-fit`} onClick={() => void make()} disabled={!passage} data-testid="make-preview">
              Hear it in my voice
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className={buttonPrimary} disabled={!current || busy !== null} onClick={() => current && void approve(current.id)} data-testid="approve-preview">
          {busy === "approving" ? "Saving…" : approved && current?.id === approved.id ? "Use This Preview" : "Approve This Preview"}
        </button>
        {!all && (
          <button type="button" className={buttonSecondary} disabled={busy !== null} onClick={() => setAll(true)}>
            Choose Another Story
          </button>
        )}
      </div>
      <p className="text-sm text-muted">Only a preview you approve is ever shared. Your original recordings never are.</p>
    </section>
  );
}
