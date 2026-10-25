import { describe, expect, it } from "vitest";
import { backoffMinutes, frequencyAllows, sendWindow, validTimeZone } from "./policy";

describe("email send rules", () => {
  it("send now inside 9am to 7pm local time, else at the next 9am", () => {
    // 15:00 UTC is 11:00 in New York (EDT).
    const midday = new Date("2026-10-24T15:00:00Z");
    expect(sendWindow(midday, "America/New_York")).toEqual(midday);
    // 03:00 UTC is 23:00 the evening before in New York; next window is 09:00 EDT = 13:00 UTC.
    expect(sendWindow(new Date("2026-10-25T03:00:00Z"), "America/New_York").toISOString()).toBe("2026-10-25T13:00:00.000Z");
    // Same instant in Los Angeles is 20:00; next window is 09:00 PDT = 16:00 UTC.
    expect(sendWindow(new Date("2026-10-25T03:00:00Z"), "America/Los_Angeles").toISOString()).toBe("2026-10-25T16:00:00.000Z");
  });

  it("falls back to US Eastern for a missing or made-up time zone", () => {
    const at = new Date("2026-10-25T03:00:00Z");
    expect(sendWindow(at, null)).toEqual(sendWindow(at, "America/New_York"));
    expect(sendWindow(at, "Mars/Olympus")).toEqual(sendWindow(at, "America/New_York"));
    expect(validTimeZone("Europe/London")).toBe(true);
    expect(validTimeZone("Mars/Olympus")).toBe(false);
  });

  it("allow one optional email a day and three a week", () => {
    const now = new Date("2026-10-24T12:00:00Z");
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
    expect(frequencyAllows([], now)).toEqual({ ok: true });
    expect(frequencyAllows([hoursAgo(25)], now)).toEqual({ ok: true });
    expect(frequencyAllows([hoursAgo(2)], now)).toEqual({ ok: false, retryAt: new Date(hoursAgo(2).getTime() + 86_400_000) });
    const week = [hoursAgo(30), hoursAgo(60), hoursAgo(100)];
    expect(frequencyAllows(week, now)).toEqual({ ok: false, retryAt: new Date(hoursAgo(100).getTime() + 7 * 86_400_000) });
  });

  it("back off up to a day between retries", () => {
    expect(backoffMinutes(1)).toBe(10);
    expect(backoffMinutes(20)).toBe(24 * 60);
  });
});
