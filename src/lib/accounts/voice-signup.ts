/**
 * Routes for Save My Voice Free, the free Readli Voice signup that follows the /try demo. It never
 * leads to Stripe, Family signup or a family dashboard: a signed-in grown-up goes to make their voice
 * (from the demo take while it lasts), and once it's kept, to My Voice to invite their family.
 */

/** My Voice, saying the voice was just saved, with Invite your family up top. */
export const VOICE_SAVED = "/voice?saved=1";

export interface VoiceSignupFrom {
  /** Came from the /try demo. */
  fromTry: boolean;
  /** The noise clean-up setting the demo stories were heard with. */
  cleanUp: boolean;
  /** The demo take is still kept for this browser (24 hours after recording). */
  takeKept: boolean;
}

/** Where signing in continues to: making the voice, from the demo take when it's still there. */
export function voiceRecordPath({ fromTry, cleanUp, takeKept }: VoiceSignupFrom): string {
  const next = `next=${encodeURIComponent(VOICE_SAVED)}`;
  if (fromTry && takeKept) return `/voice/record?from=try&${next}${cleanUp ? "&cleanup=1" : ""}`;
  // The demo take is gone (or there never was one): the record page says so and records afresh.
  return fromTry ? `/voice/record?from=try&expired=1&${next}` : `/voice/record?${next}`;
}

/** The way back from signup: to the demo stories in the voice already made, or to choosing an account. */
export function voiceSignupBack({ fromTry, cleanUp }: Pick<VoiceSignupFrom, "fromTry" | "cleanUp">): string {
  return fromTry ? `/try?resume=1${cleanUp ? "&cleanup=1" : ""}` : "/signup";
}

/**
 * Someone already signed in skips the form. From the demo they always go on to save that voice (a new
 * account interrupted before saving picks up where it left off; an existing voice keeps working until
 * they keep the new one). Otherwise a grown-up who already has a voice goes to My Voice.
 */
export function signedInVoiceSignup(from: VoiceSignupFrom, hasVoice: boolean): string {
  if (!from.fromTry && hasVoice) return "/voice";
  return voiceRecordPath(from);
}
