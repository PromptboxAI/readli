import { describe, expect, it } from "vitest";
import { signedInVoiceSignup, voiceRecordPath, voiceSignupBack } from "./voice-signup";

const demo = { fromTry: true, cleanUp: false, takeKept: true };
const never = (path: string) => expect(path).not.toMatch(/billing|checkout|signup\/family|^\/family(\?|$)/);

describe("Save My Voice Free routes", () => {
  it("goes from signing in to saving the demo take", () => {
    expect(voiceRecordPath(demo)).toBe("/voice/record?from=try");
    expect(voiceRecordPath({ ...demo, cleanUp: true })).toBe("/voice/record?from=try&cleanup=1");
  });

  it("says so when the demo take has expired, and records afresh", () => {
    expect(voiceRecordPath({ ...demo, takeKept: false })).toBe("/voice/record?from=try&expired=1");
  });

  it("records with the teleprompter when there was no demo", () => {
    expect(voiceRecordPath({ fromTry: false, cleanUp: false, takeKept: false })).toBe("/voice/record");
  });

  it("sends signed-in grown-ups on without the form", () => {
    // An account interrupted before saving its voice picks up where it left off.
    expect(signedInVoiceSignup(demo, false)).toBe("/voice/record?from=try");
    // An existing Readli Voice user from the demo can still save that take; their voice keeps working until they keep it.
    expect(signedInVoiceSignup(demo, true)).toBe("/voice/record?from=try");
    // Not from the demo, someone with a voice goes to My Voice (a parent's /voice opens Family's My voice).
    expect(signedInVoiceSignup({ fromTry: false, cleanUp: false, takeKept: false }, true)).toBe("/voice");
    expect(signedInVoiceSignup({ fromTry: false, cleanUp: false, takeKept: false }, false)).toBe("/voice/record");
  });

  it("never leads a free Voice signup to checkout, Family signup or a family dashboard", () => {
    for (const fromTry of [true, false])
      for (const takeKept of [true, false])
        for (const hasVoice of [true, false]) {
          never(voiceRecordPath({ fromTry, cleanUp: false, takeKept }));
          never(signedInVoiceSignup({ fromTry, cleanUp: false, takeKept }, hasVoice));
        }
  });

  it("goes back to the demo stories, or to choosing an account", () => {
    expect(voiceSignupBack({ fromTry: true, cleanUp: true })).toBe("/try?resume=1&cleanup=1");
    expect(voiceSignupBack({ fromTry: false, cleanUp: false })).toBe("/signup");
  });
});
