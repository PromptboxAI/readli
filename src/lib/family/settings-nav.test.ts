import { describe, expect, it } from "vitest";
import { backFrom, settingsBack, settingsLink } from "./settings-nav";

describe("settingsBack", () => {
  it("goes back to the page that opened Settings, named for it", () => {
    expect(settingsBack("/home")).toEqual({ href: "/home", label: "Home" });
    expect(settingsBack("/family")).toEqual({ href: "/family", label: "My Family" });
    expect(settingsBack("/family/books/peter-rabbit")).toEqual({ href: "/family/books/peter-rabbit", label: "Books" });
    expect(settingsBack("/family/kids")).toEqual({ href: "/family/kids", label: "My Family" });
    expect(settingsBack("/")).toEqual({ href: "/home", label: "Home" });
    expect(settingsBack("/", "/voice")).toEqual({ href: "/voice", label: "Home" });
    expect(settingsBack(undefined, "/voice")).toEqual({ href: "/voice", label: "Home" });
    expect(settingsBack("/rewards")).toEqual({ href: "/rewards", label: "Back" });
  });

  it("goes Home for anything missing, foreign or circular", () => {
    for (const from of [undefined, null, "", "https://evil.example", "//evil.example", "/family?x=1", "/family/settings", "/family/settings/plan", ["/family"], "family"]) {
      expect(settingsBack(from), String(from)).toEqual({ href: "/home", label: "Home" });
    }
  });
});

describe("backFrom", () => {
  const myFamily = { href: "/family", label: "My Family" };

  it("returns to the Settings page that opened a family page", () => {
    expect(backFrom("/family/settings/plan", myFamily)).toEqual({ href: "/family/settings/plan", label: "Plan & credits" });
    expect(backFrom("/family/settings", myFamily)).toEqual({ href: "/family/settings", label: "Settings" });
    expect(backFrom("/home", myFamily)).toEqual({ href: "/home", label: "Home" });
  });

  it("falls back for anything missing, foreign or unknown", () => {
    for (const from of [undefined, null, "", "https://evil.example", "//evil.example", "/rewards", ["/family/settings/plan"]]) {
      expect(backFrom(from, myFamily), String(from)).toEqual(myFamily);
    }
  });
});

describe("settingsLink", () => {
  it("carries the current page, except from inside Settings", () => {
    expect(settingsLink("/family/settings", "/home")).toBe("/family/settings?from=%2Fhome");
    expect(settingsLink("/family/settings/plan", "/family/settings")).toBe("/family/settings/plan");
    expect(settingsLink("/family/settings", null)).toBe("/family/settings");
  });
});
