import { describe, expect, it } from "vitest";
import { applyCheck, audioKey, expired, findDownload, parseManifest, type OfflineEntry } from "./manifest";

const entry = (over: Partial<OfflineEntry> = {}): OfflineEntry => ({
  childId: "maya",
  bookSlug: "cinderella",
  voiceId: "voice-sara",
  revision: "r1",
  title: "Cinderella",
  expiresAt: "2026-11-10T00:00:00Z",
  savedAt: "2026-11-03T00:00:00Z",
  chapters: [],
  ...over,
});
const now = Date.parse("2026-11-05T00:00:00Z");

describe("offline downloads on the device", () => {
  it("plays a child's download in the voice asked for until its week is up", () => {
    const list = [entry(), entry({ childId: "leo" }), entry({ voiceId: "voice-ben", bookSlug: "thumbelina" })];
    expect(findDownload(list, "maya", "cinderella", "voice-sara", now)).toBe(list[0]);
    expect(findDownload(list, "maya", "cinderella", "voice-ben", now)).toBeNull();
    expect(findDownload(list, "maya", "cinderella", "voice-sara", Date.parse("2026-11-10T00:00:01Z"))).toBeNull();
    expect(expired(list, Date.parse("2026-11-11T00:00:00Z")).removed).toHaveLength(3);
  });

  it("renews what the server keeps and removes what it doesn't, for that child only", () => {
    const list = [entry(), entry({ bookSlug: "thumbelina" }), entry({ childId: "leo" })];
    const { list: next, removed } = applyCheck(list, "maya", [{ voiceId: "voice-sara", bookSlug: "cinderella", revision: "r1", expiresAt: "2026-11-12T00:00:00Z" }]);
    expect(next.map((e) => [e.childId, e.bookSlug, e.expiresAt])).toEqual([
      ["maya", "cinderella", "2026-11-12T00:00:00Z"],
      ["leo", "cinderella", "2026-11-10T00:00:00Z"],
    ]);
    expect(removed.map((e) => e.bookSlug)).toEqual(["thumbelina"]);
  });

  it("keeps audio under a local address and survives a damaged list", () => {
    expect(audioKey(entry(), 2)).toBe("/offline-audio/maya/voice-sara/cinderella/r1/2");
    expect(parseManifest("not json")).toEqual([]);
    expect(parseManifest(JSON.stringify([entry(), null, 3]))).toHaveLength(1);
  });
});
