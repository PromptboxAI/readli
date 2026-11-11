import { describe, expect, it } from "vitest";
import { ANDROID_PACKAGE, assetLinks } from "./asset-links";

const KEY = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0").toUpperCase()).join(":");
const OTHER = KEY.replace(/^00/, "FF");

describe("assetLinks", () => {
  it("vouches for nothing until a signing key is configured", () => {
    expect(assetLinks(undefined)).toEqual([]);
    expect(assetLinks("")).toEqual([]);
  });

  it("lists each valid key once for the Readli package, whatever the spacing or case", () => {
    const statement = assetLinks(` ${KEY.toLowerCase()},\n${OTHER}, ${KEY} `)[0]!;
    expect(statement.relation).toEqual(["delegate_permission/common.handle_all_urls"]);
    expect(statement.target).toEqual({ namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: [KEY, OTHER] });
  });

  it("ignores anything that isn't a full SHA-256 fingerprint", () => {
    expect(assetLinks("AB:CD, not-a-key")).toEqual([]);
  });
});
