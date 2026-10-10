"use client";

import { useId } from "react";

const field = "min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink";

/** Adult account basics. Email or Google, per the Phase 4 sign-in decision. */
export function AccountFields({ namePlaceholder = "Sara" }: { namePlaceholder?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="flex min-h-12 items-center justify-center gap-3 rounded-full border-[3px] border-ink bg-surface px-6 font-display text-lg font-semibold" disabled aria-describedby={`${id}-g`}>
        <span aria-hidden="true" className="font-bold">
          G
        </span>
        Continue with Google
      </button>
      <p id={`${id}-g`} className="-mt-2 text-center text-sm text-muted">
        Google sign-in arrives with family accounts.
      </p>
      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-ink/15" />
        or with email
        <span className="h-px flex-1 bg-ink/15" />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-name`} className="font-semibold">
          Your name
        </label>
        <input id={`${id}-name`} className={field} placeholder={namePlaceholder} autoComplete="name" required />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-email`} className="font-semibold">
          Email
        </label>
        <input id={`${id}-email`} type="email" className={field} autoComplete="email" required />
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" required className="mt-1 size-5 accent-coral-deep" />
        <span>I&apos;m 18 or older.</span>
      </label>
    </div>
  );
}
