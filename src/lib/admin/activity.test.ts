import { describe, expect, it } from "vitest";
import { describeAction } from "./activity";

describe("admin activity", () => {
  it("describes support actions with what they touched", () => {
    expect(describeAction("narration_prepared_free", { book: "the-secret-garden", chapter: 1, sentences: 3 })).toBe(
      "Prepared narration at Readli's cost (the secret garden, chapter 1, 3 sentences)",
    );
    expect(describeAction("email_changed", { from: "a@x.com", to: "b@x.com" })).toBe("Changed a sign-in email (a@x.com to b@x.com)");
    expect(describeAction("something_new", {})).toBe("something new");
  });
});
