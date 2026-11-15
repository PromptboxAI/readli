// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { forgetTryVoice, rememberTryVoice, rememberedTryVoice } from "./try-resume";

describe("try-resume", () => {
  afterEach(() => window.sessionStorage.clear());

  it("remembers the voice's clean-up setting for this tab", () => {
    expect(rememberedTryVoice()).toBeNull();
    rememberTryVoice(true, 1_000);
    expect(rememberedTryVoice(2_000)).toBe(true);
    rememberTryVoice(false, 1_000);
    expect(rememberedTryVoice(2_000)).toBe(false);
  });

  it("forgets once the guest session would have ended, or when asked", () => {
    rememberTryVoice(true, 0);
    expect(rememberedTryVoice(22 * 3_600_000)).toBeNull();
    rememberTryVoice(true, 0);
    forgetTryVoice();
    expect(rememberedTryVoice(1)).toBeNull();
  });

  it("ignores anything it didn't write", () => {
    window.sessionStorage.setItem("readli.tryVoice", "not json");
    expect(rememberedTryVoice()).toBeNull();
    window.sessionStorage.setItem("readli.tryVoice", JSON.stringify({ cleanUp: "yes", at: 0 }));
    expect(rememberedTryVoice(1)).toBeNull();
  });
});
