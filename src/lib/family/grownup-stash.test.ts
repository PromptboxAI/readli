import { describe, expect, it } from "vitest";
import { failedTry, isPinResumed, lockedNow, openStash, pinResumedValue, sealStash, STASH_TRIES, type GrownUpStash } from "./grownup-stash";

const KEY = "test-secret";
const stash: GrownUpStash = { user: "u1", token: "refresh-abc", kind: "account", failures: 0, lockedUntil: null, expiresAt: 2_000 };

describe("grown-up sign-in set aside for Kids Mode", () => {
  it("opens only with the server key, unaltered and unexpired", () => {
    const sealed = sealStash(stash, KEY);
    expect(sealed).not.toContain("refresh-abc");
    expect(openStash(sealed, KEY, 1_000)).toEqual(stash);
    expect(openStash(sealed, "other-key", 1_000)).toBeNull();
    expect(openStash(sealed, KEY, 2_000)).toBeNull();
    const [iv, tag, body] = sealed.split(".");
    const flipped = body![0] === "A" ? `B${body!.slice(1)}` : `A${body!.slice(1)}`;
    expect(openStash([iv, tag, flipped].join("."), KEY, 1_000)).toBeNull();
    expect(openStash(undefined, KEY)).toBeNull();
  });

  it("locks after too many wrong PINs, for a while", () => {
    let s = stash;
    for (let i = 1; i < STASH_TRIES; i++) {
      s = failedTry(s, 0);
      expect(lockedNow(s, 0)).toBe(false);
    }
    s = failedTry(s, 0);
    expect(lockedNow(s, 0)).toBe(true);
    expect(lockedNow(s, 15 * 60_000)).toBe(false);
  });

  it("marks a PIN-resumed sign-in for this grown-up only", () => {
    const mark = pinResumedValue("u1", KEY);
    expect(isPinResumed(mark, "u1", KEY)).toBe(true);
    expect(isPinResumed(mark, "u2", KEY)).toBe(false);
    expect(isPinResumed(undefined, "u1", KEY)).toBe(false);
  });
});
