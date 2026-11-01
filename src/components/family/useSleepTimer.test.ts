import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSleepTimer } from "./useSleepTimer";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
});

const chapters = [1, 1, 2, 2];

describe("useSleepTimer", () => {
  it("cycles 15, 30, 45, end of chapter and off in a book with chapters", () => {
    const { result } = renderHook(() => useSleepTimer("t", () => {}, () => {}));
    const labels: (string | null)[] = [];
    for (let i = 0; i < 5; i++) {
      act(() => result.current.cycle(true));
      labels.push(result.current.label);
    }
    expect(labels).toEqual(["15m", "30m", "45m", "Chapter", null]);
  });

  it("stops at the end of the chapter, not before, and turns itself off", () => {
    const stop = vi.fn();
    const notify = vi.fn();
    const { result } = renderHook(() => useSleepTimer("t", stop, notify));
    for (let i = 0; i < 4; i++) act(() => result.current.cycle(true));
    expect(result.current.label).toBe("Chapter");

    let stopped = false;
    act(() => void (stopped = result.current.chapterEnd(chapters, 0)));
    expect(stopped).toBe(false);
    expect(stop).not.toHaveBeenCalled();

    act(() => void (stopped = result.current.chapterEnd(chapters, 1)));
    expect(stopped).toBe(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("end of the chapter"));
    expect(result.current.label).toBeNull();
    expect(window.localStorage.getItem("t")).toBeNull();
  });

  it("lets the last chapter finish the book on its own", () => {
    const stop = vi.fn();
    const { result } = renderHook(() => useSleepTimer("t", stop, () => {}));
    for (let i = 0; i < 4; i++) act(() => result.current.cycle(true));
    let stopped = true;
    act(() => void (stopped = result.current.chapterEnd(chapters, 3)));
    expect(stopped).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    expect(result.current.label).toBeNull();
  });

  it("keeps end of chapter across a reload the same evening, but not the next day", () => {
    window.localStorage.setItem("t", JSON.stringify({ minutes: "chapter", until: null, setAt: Date.now() - 60_000 }));
    expect(renderHook(() => useSleepTimer("t", () => {}, () => {})).result.current.label).toBe("Chapter");
    cleanup();
    window.localStorage.setItem("t", JSON.stringify({ minutes: "chapter", until: null, setAt: Date.now() - 13 * 60 * 60_000 }));
    expect(renderHook(() => useSleepTimer("t", () => {}, () => {})).result.current.label).toBeNull();
  });

  it("stops the story when a minutes timer runs out", () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    const notify = vi.fn();
    const { result } = renderHook(() => useSleepTimer("t", stop, notify));
    act(() => result.current.cycle(false));
    expect(result.current.label).toBe("15m");
    act(() => vi.advanceTimersByTime(15 * 60_000 + 1000));
    expect(stop).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith("The sleep timer paused the story. Night night!");
    expect(result.current.label).toBeNull();
  });
});
