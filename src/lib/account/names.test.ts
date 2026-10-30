import { describe, expect, it } from "vitest";
import { chosenName } from "./names";

describe("chosenName", () => {
  it("keeps a name the grown-up chose", () => {
    expect(chosenName("Kevin Godfrey", "kevingodfrey.home@gmail.com")).toBe("Kevin Godfrey");
    expect(chosenName("  Grandma June ", null)).toBe("Grandma June");
  });

  it("keeps a name they gave even when it matches their email", () => {
    expect(chosenName("Kevin", "kevin@promptbox.com", true)).toBe("Kevin");
    expect(chosenName("kevin", "kevin@promptbox.com", true)).toBe("kevin");
    expect(chosenName("Kevin", "kevin@promptbox.com")).toBeNull();
    expect(chosenName("Grown-up", null, true)).toBeNull();
  });

  it("treats the stand-in made from the email address as no name", () => {
    expect(chosenName("kevingodfrey.home", "kevingodfrey.home@gmail.com")).toBeNull();
    expect(chosenName("KevinGodfrey.Home", "kevingodfrey.home@gmail.com")).toBeNull();
    expect(chosenName("sara@example.com", "sara@example.com")).toBeNull();
    expect(chosenName("Grown-up", null)).toBeNull();
    expect(chosenName("", "a@b.co")).toBeNull();
    expect(chosenName(null, "a@b.co")).toBeNull();
  });
});
