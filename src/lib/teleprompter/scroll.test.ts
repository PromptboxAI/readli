import { describe, expect, it } from "vitest";
import { activeIndex, clampWpm, remainingSeconds, scrollDelta } from "./scroll";

describe("scroll math", () => {
  it("advances one word per (60/wpm) seconds", () => {
    // 120 wpm = 2 words/s; 40px per word; 50ms frame -> 0.1 word -> 4px
    expect(scrollDelta(120, 40, 50)).toBeCloseTo(4);
  });

  it("caps long frames so text never jumps after the tab was hidden", () => {
    expect(scrollDelta(120, 40, 5_000)).toBeCloseTo(scrollDelta(120, 40, 100));
  });

  it("does nothing for empty input", () => {
    expect(scrollDelta(120, 0, 16)).toBe(0);
    expect(scrollDelta(120, 40, 0)).toBe(0);
  });

  it("clamps and rounds speed", () => {
    expect(clampWpm(10)).toBe(80);
    expect(clampWpm(500)).toBe(200);
    expect(clampWpm(133)).toBe(130);
  });

  it("estimates remaining time", () => {
    expect(remainingSeconds(260, 130)).toBe(120);
    expect(remainingSeconds(0, 130)).toBe(0);
  });

  it("finds the sentence on the reading line", () => {
    const tops = [350, 420, 500, 600];
    expect(activeIndex(tops, 0, 1000)).toBe(0);
    expect(activeIndex(tops, 80, 1000)).toBe(1);
    expect(activeIndex(tops, 10_000, 1000)).toBe(3);
  });
});
