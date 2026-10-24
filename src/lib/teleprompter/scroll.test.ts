import { describe, expect, it } from "vitest";
import { activeIndex, clampWpm, remainingSeconds, scrollDelta, scrollToText, textHeight, textToScroll } from "./scroll";

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
    expect(clampWpm(133)).toBe(135);
    expect(clampWpm(145 + 10)).toBe(155);
  });

  it("estimates remaining time", () => {
    expect(remainingSeconds(260, 130)).toBe(120);
    expect(remainingSeconds(0, 130)).toBe(0);
  });

  it("finds the sentence on the reading line", () => {
    const tops = [150, 220, 300, 400];
    expect(activeIndex(tops, 0, 1000)).toBe(0);
    expect(activeIndex(tops, 80, 1000)).toBe(1);
    expect(activeIndex(tops, 10_000, 1000)).toBe(3);
  });

  describe("paragraph gaps", () => {
    // Two 100px paragraphs with a 30px gap between them.
    const blocks = [
      { top: 0, height: 100 },
      { top: 130, height: 100 },
    ];

    it("skips the gap: the end of one paragraph leads straight into the next", () => {
      expect(textHeight(blocks)).toBe(200);
      expect(textToScroll(blocks, 50)).toBe(50);
      expect(textToScroll(blocks, 100)).toBe(100);
      expect(textToScroll(blocks, 100.5)).toBe(130.5);
      expect(textToScroll(blocks, 150)).toBe(180);
    });

    it("reads a manual scroll back into text position, treating the gap as the next paragraph", () => {
      expect(scrollToText(blocks, 180)).toBe(150);
      expect(scrollToText(blocks, 115)).toBe(100);
      expect(scrollToText(blocks, 250)).toBe(220);
    });

    it("round-trips outside the gaps", () => {
      for (const p of [0, 40, 99, 101, 199]) expect(scrollToText(blocks, textToScroll(blocks, p))).toBeCloseTo(p);
    });
  });
});
