import { describe, expect, it } from "vitest";
import { EXAMPLE_FAMILY, initials } from "./example-family";

describe("example family", () => {
  it("has at least seven grown-ups across generations, with every invite status shown", () => {
    const adults = EXAMPLE_FAMILY.filter((m) => m.status !== "listener");
    expect(adults.length).toBeGreaterThanOrEqual(7);
    expect(new Set(adults.map((m) => m.status))).toEqual(new Set(["ready_shared", "invited", "not_invited"]));
    expect(new Set(EXAMPLE_FAMILY.map((m) => m.y)).size).toBe(3);
  });

  it("keeps ids unique and avatars on the canvas", () => {
    expect(new Set(EXAMPLE_FAMILY.map((m) => m.id)).size).toBe(EXAMPLE_FAMILY.length);
    for (const m of EXAMPLE_FAMILY) {
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(1000);
    }
  });

  it("builds initials without the relationship title", () => {
    expect(initials("Grandma June")).toBe("J");
    expect(initials("Mom")).toBe("M");
  });
});
