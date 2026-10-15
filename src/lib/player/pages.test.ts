import { describe, expect, it } from "vitest";
import { nextSleep, pageCount, pageOf, pageRange, parseMode } from "./pages";

describe("player pages", () => {
  it("groups sentences into pages of four", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(4)).toBe(1);
    expect(pageCount(9)).toBe(3);
    expect(pageOf(0)).toBe(0);
    expect(pageOf(3)).toBe(0);
    expect(pageOf(4)).toBe(1);
    expect(pageRange(2, 9)).toEqual([8, 9]);
    expect(pageRange(0, 9)).toEqual([0, 4]);
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
});
