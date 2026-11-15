import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { signupSource } from "./finish-sign-in";

describe("signupSource", () => {
  it("reads the from a signup form put on where sign-in is headed", () => {
    expect(signupSource("/home?from=pricing")).toBe("pricing");
  });

  it("is null without one, or with anything that isn't a short label", () => {
    expect(signupSource("/home")).toBeNull();
    expect(signupSource("/signup/family?billing=annual")).toBeNull();
    expect(signupSource("/home?from=<script>")).toBeNull();
    expect(signupSource(`/home?from=${"a".repeat(40)}`)).toBeNull();
  });
});
