import { describe, expect, it } from "vitest";
import { isDeviceCookie } from "./devices";
import { decodeTemporaryKids, encodeTemporaryKids, isTemporaryKidsCookie } from "./session";

describe("temporary Kids Mode pass", () => {
  const now = Date.UTC(2026, 9, 13, 20);
  const pass = { scope: "account", openedBy: "user-1", childId: "kid-1", expiresAt: now + 3_600_000 };

  it("round-trips and is never mistaken for a kids device", () => {
    const value = encodeTemporaryKids(pass, "k");
    expect(isTemporaryKidsCookie(value)).toBe(true);
    expect(isDeviceCookie(value)).toBe(false);
    expect(decodeTemporaryKids(value, now, "k")).toEqual(pass);
  });

  it("ends when it expires", () => {
    expect(decodeTemporaryKids(encodeTemporaryKids(pass, "k"), pass.expiresAt, "k")).toBeNull();
  });

  it("rejects an altered child, grown-up or expiry, and a different secret", () => {
    const value = encodeTemporaryKids(pass, "k");
    expect(decodeTemporaryKids(value.replace("kid-1", "kid-2"), now, "k")).toBeNull();
    expect(decodeTemporaryKids(value.replace("user-1", "user-2"), now, "k")).toBeNull();
    expect(decodeTemporaryKids(value.replace(String(pass.expiresAt), String(pass.expiresAt + 9e9)), now, "k")).toBeNull();
    expect(decodeTemporaryKids(value, now, "other")).toBeNull();
    expect(decodeTemporaryKids("t1~garbage", now, "k")).toBeNull();
  });
});
