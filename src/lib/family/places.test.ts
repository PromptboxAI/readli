import { describe, expect, it } from "vitest";
import { heardAt, isNewer } from "./places";

const server = new Date("2026-10-24T12:00:00.000Z");

describe("when a saved place was heard", () => {
  it("uses how long ago the device heard it, not the device's clock", () => {
    // The device's clock is a day fast; the place was heard 90 seconds before it was sent.
    const fast = Date.parse("2026-10-25T12:00:00Z");
    expect(heardAt({ listenedAt: fast - 90_000, sentAt: fast }, server)).toBe("2026-10-24T11:58:30.000Z");
  });

  it("treats a save without times as heard now, and never in the future or more than 30 days ago", () => {
    expect(heardAt({}, server)).toBe(server.toISOString());
    expect(heardAt({ listenedAt: "x", sentAt: 1 }, server)).toBe(server.toISOString());
    expect(heardAt({ listenedAt: 5_000, sentAt: 1_000 }, server)).toBe(server.toISOString());
    expect(heardAt({ listenedAt: 0, sentAt: 365 * 86_400_000 }, server)).toBe("2026-09-24T12:00:00.000Z");
  });

  it("replaces only a place heard earlier", () => {
    expect(isNewer("2026-10-24T12:00:01Z", "2026-10-24T12:00:00Z")).toBe(true);
    expect(isNewer("2026-10-24T11:59:59Z", "2026-10-24T12:00:00Z")).toBe(false);
    expect(isNewer("2026-10-24T11:59:59Z", null)).toBe(true);
  });
});
