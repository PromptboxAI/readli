import { coverSrc, type DemoBook } from "@/lib/content/demo-books";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";
import { formatClock } from "@/lib/teleprompter/recorder-machine";
import type { GuestTake } from "@/lib/voice/guest-handoff";

/** The opening words of the story every visitor reads on /try. */
const OPENING = DEMO_SCRIPT.paragraphs[0]!.split(",").slice(0, 2).join(",");

function hoursLeft(expiresAt: string, now: number): number {
  return Math.max(1, Math.ceil((Date.parse(expiresAt) - now) / 3_600_000));
}

/**
 * What the visitor is saving: the recording they made on /try (its length, the story they read, how
 * long it's kept) and the last book they heard in that voice. Says so plainly when it has expired.
 */
export function DemoRecordingCard({ take, book, now = Date.now() }: { take: GuestTake | null; book: DemoBook | null; now?: number }) {
  if (!take) {
    return (
      <div className="flex gap-4 rounded-2xl bg-sunshine/50 p-4" data-testid="demo-recording-expired">
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface text-2xl">
          🎙️
        </span>
        <p className="text-sm">
          <span className="block font-display text-base font-semibold">Your demo recording has expired</span>
          Demo recordings are kept for 24 hours. After you sign in, you&apos;ll read the short story once more, about a minute.
        </p>
      </div>
    );
  }
  const hours = hoursLeft(take.expiresAt, now);
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-mint/50 p-4" data-testid="demo-recording">
      {book ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small static cover, like the demo's own
        <img src={coverSrc(book)} alt="" width={48} height={64} className="h-16 w-12 shrink-0 rounded-lg object-cover shadow" />
      ) : (
        <span aria-hidden="true" className="grid h-16 w-12 shrink-0 place-items-center rounded-lg bg-surface text-2xl">
          🎙️
        </span>
      )}
      <p className="min-w-0 text-sm">
        <span className="block font-display text-base font-semibold">
          Your recording · {formatClock(take.durationMs)}
        </span>
        You read &ldquo;{OPENING}&hellip;&rdquo;
        {book && (
          <>
            {" "}
            and heard <cite className="font-semibold not-italic">{book.title}</cite> in your voice.
          </>
        )}{" "}
        <span className="text-muted">Kept for about {hours} more {hours === 1 ? "hour" : "hours"}.</span>
      </p>
    </div>
  );
}
