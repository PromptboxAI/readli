"use client";

import { useEffect, useRef } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { trackVoiceEvent } from "@/lib/voice/track";

/** The Loom walkthrough, set once the video is ready. A share link is turned into its embed link. */
export function tutorialEmbedUrl(url = process.env.NEXT_PUBLIC_RECORDING_TUTORIAL_URL): string | null {
  if (!url) return null;
  const loom = url.match(/^https:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  return loom ? `https://www.loom.com/embed/${loom[1]}` : null;
}

const TIPS: { heading: string; points: string[] }[] = [
  {
    heading: "Read the whole story, about 1 to 2 minutes",
    points: [
      "That's the amount of audio Readli needs to copy a voice well. Reading for longer doesn't make it better.",
      "Keep reading until the end of the script. Finish unlocks when you get there.",
    ],
  },
  {
    heading: "Use your natural storytime voice",
    points: [
      "Read the way you would at bedtime: warm, with gentle expression and natural pauses.",
      "Stay in one voice all the way through. Skip new accents, whispering, shouting and character voices, because your Readli voice copies all of it.",
      "A flat, careful reading voice makes a flat-sounding Readli voice.",
    ],
  },
  {
    heading: "Set up your room and microphone",
    points: [
      "Pick a quiet room with soft things in it, like a bedroom. Bare kitchens and bathrooms echo.",
      "Turn off TVs, music and fans, and make sure nobody else is talking.",
      "Keep the phone or mic at the same distance the whole time, about a hand's width from your mouth.",
      "Speak clearly at a steady volume. If the mic level flashes red, move back a little.",
    ],
  },
  {
    heading: "If it doesn't sound like you",
    points: [
      "Record again somewhere quieter, reading with a bit more of your natural expression.",
      "Try it with noise clean-up switched the other way. Clean-up helps noisy rooms, but it can change a clean recording.",
      "Some very distinctive voices are hard to copy from a short recording. A later Readli upgrade will train on a longer one.",
    ],
  },
];

export function RecordingTipsContent({ headingId }: { headingId?: string }) {
  const embed = tutorialEmbedUrl();
  return (
    <div className="flex flex-col gap-5">
      <h2 id={headingId} className="font-display text-2xl font-semibold sm:text-3xl">
        Tips for a better voice recording
      </h2>
      {embed ? (
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-ink/10">
          <iframe
            src={embed}
            title="How to record your Readli voice (video)"
            className="absolute inset-0 size-full"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : (
        <div className="grid aspect-video place-items-center rounded-2xl bg-lavender/50 p-4 text-center" data-testid="tutorial-placeholder">
          <p className="font-display text-lg font-semibold">A short video walkthrough is coming soon.</p>
        </div>
      )}
      {TIPS.map((t) => (
        <section key={t.heading} className="flex flex-col gap-2">
          <h3 className="font-display text-lg font-semibold">{t.heading}</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {t.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * The same guidance as /help/recording-tips, in a sheet over the recorder so a take in progress is
 * never lost. With onRecordAgain it also offers a fresh take.
 */
export function RecordingTipsDialog({
  open,
  onClose,
  onRecordAgain,
  where,
}: {
  open: boolean;
  onClose: () => void;
  onRecordAgain?: () => void;
  where: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      trackVoiceEvent("tips_opened", { where });
    } else if (!open && el.open) el.close();
  }, [open, where]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="recording-tips-heading"
      className="m-auto max-h-[92dvh] w-[min(42rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[var(--radius-panel)] bg-surface p-5 text-ink backdrop:bg-ink/50 sm:p-8"
      data-testid="recording-tips"
    >
      <RecordingTipsContent headingId="recording-tips-heading" />
      <div className="sticky bottom-0 -mx-5 mt-6 flex flex-wrap gap-3 bg-surface px-5 pt-3 pb-1 sm:-mx-8 sm:px-8">
        {onRecordAgain ? (
          <>
            <button
              type="button"
              className={buttonPrimary}
              onClick={() => {
                onClose();
                onRecordAgain();
              }}
            >
              Record again
            </button>
            <button type="button" className={buttonSecondary} onClick={onClose}>
              Not now
            </button>
          </>
        ) : (
          <button type="button" className={buttonPrimary} onClick={onClose}>
            Back to recording
          </button>
        )}
      </div>
    </dialog>
  );
}

/** "Tips for a better voice recording", shown before the take. */
export function TipsLink({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="w-fit text-left text-sm font-semibold text-coral-deep underline underline-offset-4" onClick={onOpen}>
      Tips for a better voice recording
    </button>
  );
}

/** "Doesn't sound like you? Here's how to improve it", shown beside a generated result. */
export function ImproveLink({ onOpen, where }: { onOpen: () => void; where: string }) {
  return (
    <button
      type="button"
      className="w-fit text-left text-sm font-semibold underline underline-offset-4"
      onClick={() => {
        trackVoiceEvent("doesnt_sound_like_me", { where });
        onOpen();
      }}
    >
      Doesn&apos;t sound like you? Here&apos;s how to improve it
    </button>
  );
}
