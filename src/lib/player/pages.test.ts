import { describe, expect, it } from "vitest";
import { clock, nextSleep, pageCount, pageOf, pageRange, parseMode, sentenceAt, timeline } from "./pages";

describe("player pages", () => {
  it("groups sentences into pages of two", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(2)).toBe(1);
    expect(pageCount(9)).toBe(5);
    expect(pageOf(0)).toBe(0);
    expect(pageOf(1)).toBe(0);
    expect(pageOf(2)).toBe(1);
    expect(pageRange(4, 9)).toEqual([8, 9]);
    expect(pageRange(0, 9)).toEqual([0, 2]);
  });

  it("cycles the sleep timer off, 15, 30, 45 and back to off", () => {
    expect(nextSleep(null)).toBe(15);
    expect(nextSleep(15)).toBe(30);
    expect(nextSleep(30)).toBe(45);
    expect(nextSleep(45)).toBeNull();
  });

  it("defaults to Listen mode", () => {
    expect(parseMode(null)).toBe("listen");
    expect(parseMode("nonsense")).toBe("listen");
    expect(parseMode("read")).toBe("read");
  });

  it("lays sentences on a time bar and finds the one at any point", () => {
    const starts = timeline([4, 6, 5]);
    expect(starts).toEqual([0, 4, 10, 15]);
    expect(sentenceAt(starts, 0)).toBe(0);
    expect(sentenceAt(starts, 3.9)).toBe(0);
    expect(sentenceAt(starts, 4)).toBe(1);
    expect(sentenceAt(starts, 14)).toBe(2);
    expect(sentenceAt(starts, 99)).toBe(2);
    expect(sentenceAt(timeline([]), 5)).toBe(0);
  });

  it("writes times like an audiobook", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(24.4)).toBe("0:24");
    expect(clock(185)).toBe("3:05");
    expect(clock(3729)).toBe("1:02:09");
    expect(clock(-3)).toBe("0:00");
  });
});
