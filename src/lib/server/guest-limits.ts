/**
 * Cost limits for the free /try demo, per guest session (one browser, about 21 hours).
 * Recording again is never blocked (recordings cost nothing to keep). Each recording gets its own set of
 * stories; noise clean-up switches re-make the voice from the same recording and re-read stories already
 * heard for free, so they're capped per recording. Provider voices have an overall backstop.
 */
export const MAX_CLEANUP_SWITCHES_PER_RECORDING = 4;
export const MAX_VOICES_PER_GUEST = 25;

export const TOO_MANY_CLEANUP_SWITCHES =
  "You've switched noise clean-up 4 times on this recording, which is the most the free demo allows. You can still hear stories with the setting you have now.";
export const TOO_MANY_VOICES =
  "You've tried the free demo with a lot of recordings today, which is the most it allows. Make a free Readli Voice account to keep recording and keep your voice.";
