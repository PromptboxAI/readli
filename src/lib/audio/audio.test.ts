import { describe, expect, it } from "vitest";
import { fileExtension, pickMimeType } from "./mime";
import { blockingIssues, createLevelTracker, evaluateLevels } from "./qc";

describe("pickMimeType", () => {
  it("prefers Opus WebM", () => {
    expect(pickMimeType(() => true)).toBe("audio/webm;codecs=opus");
  });
  it("falls back to MP4 on Safari", () => {
    expect(pickMimeType((t) => t.startsWith("audio/mp4"))).toBe("audio/mp4;codecs=mp4a.40.2");
  });
  it("returns null when nothing is supported", () => {
    expect(pickMimeType(() => false)).toBeNull();
  });
  it("maps extensions", () => {
    expect(fileExtension("audio/mp4")).toBe("m4a");
    expect(fileExtension("audio/webm;codecs=opus")).toBe("webm");
  });
});

function feed(frames: Array<[level: number, count: number]>, frameMs = 50) {
  const t = createLevelTracker();
  for (const [level, count] of frames) for (let i = 0; i < count; i++) t.push(level, frameMs);
  return evaluateLevels(t.stats());
}

describe("advisory QC", () => {
  it("accepts a clean minute of speech", () => {
    // 70s speech at 0.3 with 20s of short pauses at 0.01
    const take = Array.from({ length: 20 }, () => [[0.3, 70], [0.01, 20]] as Array<[number, number]>).flat();
    expect(feed(take)).toMatchObject({ ok: true, issues: [] });
  });
  it("flags silence", () => {
    expect(feed([[0.005, 1200]]).issues).toEqual(["silent"]);
  });
  it("counts a quiet phone read with natural word gaps as a full minute of speech", () => {
    // 65s read: words peaking at 0.04 (no auto gain) with 150ms gaps between them and a 600ms breath each sentence
    const sentence = [...Array.from({ length: 8 }, () => [[0.04, 7], [0.01, 3]] as Array<[number, number]>).flat(), [0.01, 12]] as Array<[number, number]>;
    const take = Array.from({ length: 14 }, () => sentence).flat();
    const qc = feed(take);
    expect(qc.issues).not.toContain("too_short");
    expect(qc.speechMs).toBeGreaterThan(50_000);
  });
  it("does not bridge long pauses", () => {
    expect(feed([[0.3, 20], [0.01, 40], [0.3, 20]]).speechMs).toBe(2000);
  });
  it("flags short takes", () => {
    expect(feed([[0.3, 400], [0.01, 100]]).issues).toContain("too_short");
  });
  it("flags clipping", () => {
    expect(feed([[0.3, 1400], [0.99, 60]]).issues).toContain("clipping");
  });
  it("flags a noisy room", () => {
    expect(feed([[0.3, 1400], [0.05, 600]]).issues).toContain("noisy");
  });
  it("flags one long silent stretch, but not the same silence spread across short pauses", () => {
    expect(feed([[0.3, 700], [0.005, 240], [0.3, 700]]).issues).toContain("long_pause"); // 12s gap
    const spread = Array.from({ length: 12 }, () => [[0.3, 120], [0.005, 20]] as Array<[number, number]>).flat();
    expect(feed(spread).issues).not.toContain("long_pause");
  });
  it("only silence and too little speech block a take", () => {
    expect(blockingIssues({ issues: ["silent", "clipping"] })).toEqual(["silent"]);
    expect(blockingIssues({ issues: ["noisy", "long_pause", "too_quiet"] })).toEqual([]);
  });
});
