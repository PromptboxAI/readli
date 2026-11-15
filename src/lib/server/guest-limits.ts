/**
 * Cost limits for the free /try demo, per guest session (one browser, about 21 hours).
 * Each recording gets its own set of stories; noise clean-up switches re-make the voice from the same
 * recording and re-read stories already heard for free, so they're capped per recording.
 */
export const MAX_RECORDINGS_PER_GUEST = 3;
export const MAX_CLEANUP_SWITCHES_PER_RECORDING = 4;

export const TOO_MANY_RECORDINGS =
  "You've recorded 3 times today, which is the most the free demo allows. Make a free Readli Voice account to record again and keep your voice.";
export const TOO_MANY_CLEANUP_SWITCHES =
  "You've switched noise clean-up 4 times on this recording, which is the most the free demo allows. You can still hear stories with the setting you have now.";
