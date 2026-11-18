import { describe, expect, it } from "vitest";
import { isDeviceCookie } from "./devices";
import { cookieSecret, decodeTemporaryKids, encodeTemporaryKids, isTemporaryKidsCookie } from "./session";

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

describe("cookie signing key", () => {
  it("uses GUEST_COOKIE_SECRET when it's set", () => {
    expect(cookieSecret({ NODE_ENV: "production", GUEST_COOKIE_SECRET: "real" } as NodeJS.ProcessEnv)).toBe("real");
  });

  it("allows the stand-in key only in dev and stub mode", () => {
    expect(cookieSecret({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe("readli-dev-only-secret");
    expect(cookieSecret({ NODE_ENV: "production", VOICE_PROVIDER: "stub" } as NodeJS.ProcessEnv)).toBe("readli-dev-only-secret");
  });

  it("refuses to sign anything in production without a key, so passes can't be forged with the published stand-in", () => {
    expect(() => cookieSecret({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(/GUEST_COOKIE_SECRET/);
  });
});
