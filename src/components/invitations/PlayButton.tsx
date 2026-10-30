"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Plays audio from a short-lived link fetched only when pressed, so nothing loads (or counts as a
 * listen) until a person asks for it.
 */
export function PlayButton({
  label,
  endpoint,
  body,
  testId,
  large = false,
  onEnded,
}: {
  label: string;
  endpoint: string;
  body?: Record<string, unknown>;
  testId?: string;
  /** The invitation page's centerpiece: a bigger button and label. */
  large?: boolean;
  /** Called once when the clip plays to the end. */
  onEnded?: () => void;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [error, setError] = useState("");
  useEffect(() => () => audio.current?.pause(), []);

  async function toggle() {
    if (state === "playing") {
      audio.current?.pause();
      return setState("idle");
    }
    setState("loading");
    setError("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "This preview isn't available.");
      audio.current?.pause();
      const a = new Audio(data.url);
      audio.current = a;
      a.onended = () => {
        setState("idle");
        onEnded?.();
      };
      await a.play();
      setState("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "This preview isn't available.");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={`flex items-center gap-4 rounded-3xl bg-surface ring-2 ring-ink/10 ${large ? "p-3 sm:p-4" : "p-4"}`}>
        <button
          type="button"
          onClick={toggle}
          data-testid={testId}
          aria-label={state === "playing" ? `Pause ${label}` : `Play ${label}`}
          className={`grid shrink-0 place-items-center rounded-full bg-coral-deep text-white shadow-[0_4px_0_#8f2a1e] disabled:opacity-50 ${large ? "size-16 sm:size-20" : "size-14"}`}
          disabled={state === "loading"}
        >
          {state === "playing" ? (
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-1 size-6" aria-hidden="true">
              <path d="M6 4l14 8-14 8z" fill="currentColor" />
            </svg>
          )}
        </button>
        <span className={`min-w-0 flex-1 font-display font-semibold ${large ? "text-lg leading-snug sm:text-xl" : ""}`}>{state === "loading" ? "Loading…" : label}</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-coral-deep">
          {error}
        </p>
      )}
    </div>
  );
}
