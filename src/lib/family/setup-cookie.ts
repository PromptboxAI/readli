/**
 * Set when a parent chooses "Finish setting up later", for the rest of that browser session. Until then, and
 * again in every new session, Family Home sends an unfinished family back into setup.
 */
export const SETUP_LATER_COOKIE = "readli_setup_later";

/** The same for a storyteller who leaves their setup before recording: My Voice and invitation steps stop sending them back. */
export const VOICE_SETUP_LATER_COOKIE = "readli_voice_setup_later";

/**
 * These choices belong to the account that made them, not the browser: the cookie holds that account's id, so
 * someone else signing up or in on the same browser starts fresh.
 */
export function chosenBy(value: string | undefined, userId: string): boolean {
  return Boolean(value) && value === userId;
}

/** Set when a grown-up typed their name on the gift page, so setup's welcome greets them with it instead of asking again. */
export const NAMED_COOKIE = "readli_named";
