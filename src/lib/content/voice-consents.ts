/**
 * What a grown-up agrees to before Readli makes their account voice. The exact wording is stored
 * on the consent receipt, so change the version whenever a line changes.
 */
export const VOICE_CONSENT_VERSION = "family-voice-2026-10";

export const VOICE_CONSENTS = [
  "This is my own voice, and I'm the only person recording it.",
  "Readli can make a private digital version of my voice to read stories.",
  "Families can only use it after I share it with them, and their parents approve it for each child.",
  "I can stop sharing, replace or delete my voice at any time.",
] as const;

/** The four points as the one sentence a grown-up ticks. Same wording, so the same consent version. */
export const VOICE_CONSENT_SENTENCE = VOICE_CONSENTS.join(" ");
