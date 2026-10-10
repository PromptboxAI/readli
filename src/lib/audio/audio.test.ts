import { describe, expect, it } from "vitest";
import { fileExtension, pickMimeType } from "./mime";
import { createLevelTracker, evaluateLevels } from "./qc";

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
    // 70s speech at 0.3, 20s gaps at 0.01
    expect(feed([[0.3, 1400], [0.01, 400]])).toMatchObject({ ok: true, issues: [] });
  });
  it("flags silence", () => {
    expect(feed([[0.005, 1200]]).issues).toEqual(["silent"]);
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
});
