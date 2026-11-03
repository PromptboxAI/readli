/**
 * Set when a parent chooses "Finish setting up later", for the rest of that browser session. Until then, and
 * again in every new session, Family Home sends an unfinished family back into setup.
 */
export const SETUP_LATER_COOKIE = "readli_setup_later";

/** The same for a storyteller who leaves their setup before recording: My Voice and invitation steps stop sending them back. */
export const VOICE_SETUP_LATER_COOKIE = "readli_voice_setup_later";
