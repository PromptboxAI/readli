import { describe, expect, it } from "vitest";
import { settingsBack, settingsLink } from "./settings-nav";

describe("settingsBack", () => {
  it("goes back to the page that opened Settings, named for it", () => {
    expect(settingsBack("/family")).toEqual({ href: "/family", label: "Home" });
    expect(settingsBack("/family/books/peter-rabbit")).toEqual({ href: "/family/books/peter-rabbit", label: "Books" });
    expect(settingsBack("/family/kids")).toEqual({ href: "/family/kids", label: "Family" });
    expect(settingsBack("/")).toEqual({ href: "/", label: "Home" });
    expect(settingsBack("/rewards")).toEqual({ href: "/rewards", label: "Back" });
  });

  it("goes Home for anything missing, foreign or circular", () => {
    for (const from of [undefined, null, "", "https://evil.example", "//evil.example", "/family?x=1", "/family/settings", "/family/settings/plan", ["/family"], "family"]) {
      expect(settingsBack(from), String(from)).toEqual({ href: "/family", label: "Home" });
    }
  });
});

describe("settingsLink", () => {
  it("carries the current page, except from inside Settings", () => {
    expect(settingsLink("/family/settings", "/family")).toBe("/family/settings?from=%2Ffamily");
    expect(settingsLink("/family/settings/plan", "/family/settings")).toBe("/family/settings/plan");
    expect(settingsLink("/family/settings", null)).toBe("/family/settings");
  });
});
