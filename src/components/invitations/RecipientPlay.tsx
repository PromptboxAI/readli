"use client";

import { PlayButton } from "./PlayButton";

type RecipientEvent = "audio_completed" | "family_cta" | "connect_cta";

/** Notes a step on the invitation page. Best effort: a lost event never blocks the recipient. */
export function recipientEvent(token: string, event: RecipientEvent) {
  return fetch("/api/invitations/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, event }), keepalive: true }).catch(() => undefined);
}

/** The invitation page's Play button: plays the approved preview with no account, and notes a listen to the end. */
export function RecipientPlay({ token, label }: { token: string; label: string }) {
  return <PlayButton large label={label} endpoint="/api/invitations/play" body={{ token }} testId="play-preview" onEnded={() => void recipientEvent(token, "audio_completed")} />;
}

/** A link on the invitation page that notes which path the recipient chose. */
export function RecipientLink({ token, event, href, className, testId, children }: { token: string; event: RecipientEvent; href: string; className?: string; testId?: string; children: React.ReactNode }) {
  return (
    <a href={href} className={className} data-testid={testId} onClick={() => void recipientEvent(token, event)}>
      {children}
    </a>
  );
}
