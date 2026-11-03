import { describe, expect, it } from "vitest";
import { storytellerHref, storytellerStep, storytellerStepAfter, storytellerStepBefore } from "./storyteller-setup";

describe("storyteller setup", () => {
  it("opens on the welcome page for someone without a voice", () => {
    expect(storytellerStep(undefined, { voice: false, shared: false })).toBe("welcome");
  });

  it("opens on the first step still to do once there's a voice", () => {
    expect(storytellerStep(undefined, { voice: true, shared: false })).toBe("share");
    expect(storytellerStep(undefined, { voice: true, shared: true })).toBe("listen");
  });

  it("shows the step asked for and ignores unknown ones", () => {
    expect(storytellerStep("listen", { voice: false, shared: false })).toBe("listen");
    expect(storytellerStep("kids", { voice: false, shared: false })).toBe("welcome");
  });

  it("goes welcome, voice, share, listen, done and back again", () => {
    const order = ["welcome"];
    while (order.at(-1) !== "done") order.push(storytellerStepAfter(order.at(-1) as never));
    expect(order).toEqual(["welcome", "voice", "share", "listen", "done"]);
    expect(storytellerStepBefore("voice")).toBe("welcome");
    expect(storytellerStepBefore("welcome")).toBeNull();
    expect(storytellerStepBefore("done")).toBe("listen");
    expect(storytellerHref("share")).toBe("/voice/setup?step=share");
  });
});
