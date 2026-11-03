"use client";

import { useEffect, useState } from "react";
import { findDownload } from "@/lib/offline/manifest";
import { downloadStory, DOWNLOADS_CHANGED, offlineSupported, readDownloads, removeDownload } from "./offline";
import { Icon } from "./PlayerParts";

type State = { kind: "idle" } | { kind: "saving"; percent: number } | { kind: "saved" } | { kind: "failed" };

/**
 * Keeps this story, in the storyteller reading it, on this device for listening without a connection
 * (in the car, on a plane). Shown only when the whole story is prepared in that voice. Tapping a saved
 * story asks before removing it. A download plays offline for a week after the device last checked in,
 * and is removed when that storyteller can't be heard any more.
 */
export function DownloadButton({
  childId,
  book,
  voiceId,
  narrator,
  className,
}: {
  childId: string;
  book: { slug: string; title: string };
  voiceId: string;
  narrator: string;
  className: string;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(offlineSupported());
    const sync = () => setState((s) => (s.kind === "saving" ? s : findDownload(readDownloads(), childId, book.slug, voiceId) ? { kind: "saved" } : { kind: "idle" }));
    sync();
    window.addEventListener(DOWNLOADS_CHANGED, sync);
    return () => window.removeEventListener(DOWNLOADS_CHANGED, sync);
  }, [childId, book.slug, voiceId]);

  if (!supported) return null;

  const save = async () => {
    setState({ kind: "saving", percent: 0 });
    try {
      await downloadStory(childId, book, voiceId, (f) => setState({ kind: "saving", percent: Math.round(f * 100) }));
      setState({ kind: "saved" });
    } catch {
      await removeDownload({ childId, bookSlug: book.slug, voiceId });
      setState({ kind: "failed" });
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${book.title}, read by ${narrator}, from this device? You can download it again any time you're online.`)) return;
    await removeDownload({ childId, bookSlug: book.slug, voiceId });
    setState({ kind: "idle" });
  };

  if (state.kind === "saving") {
    return (
      <span className={className} role="status" data-testid="download-progress">
        <Icon name="download" className="size-6 motion-safe:animate-bounce" />
        {state.percent}%
      </span>
    );
  }
  if (state.kind === "saved") {
    return (
      <button type="button" onClick={remove} className={className} data-testid="download-saved" aria-label={`Saved on this device. Remove ${book.title} from this device`}>
        <Icon name="saved" className="size-6" />
        Saved
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={save}
      className={className}
      data-testid="download-button"
      aria-label={state.kind === "failed" ? "Couldn't download. Try again" : `Download ${book.title}, read by ${narrator}, to listen without internet`}
    >
      <Icon name="download" className="size-6" />
      {state.kind === "failed" ? "Try again" : "Download"}
    </button>
  );
}
