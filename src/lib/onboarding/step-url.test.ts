import { describe, expect, it } from "vitest";
import { withStep } from "./step-url";

describe("withStep", () => {
  it("adds the step and keeps the rest of the query", () => {
    expect(withStep("/family/setup", { checkout: "success", session_id: "cs_1", from: "start" }, "kids")).toBe("/family/setup?checkout=success&session_id=cs_1&from=start&step=kids");
  });
  it("replaces an empty step and drops repeated values", () => {
    expect(withStep("/start", { step: "", tag: ["a", "b"] }, "voice")).toBe("/start?step=voice");
  });
});
