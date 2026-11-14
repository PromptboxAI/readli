import { describe, expect, it } from "vitest";
import { giftSeason } from "./season";

describe("giftSeason", () => {
  it("is the holidays from November 1 to Christmas Day, Eastern time", () => {
    expect(giftSeason(new Date("2026-11-01T05:00:00Z"))?.deliverOn).toBe("2026-12-25");
    expect(giftSeason(new Date("2026-12-25T23:00:00Z"))?.id).toBe("holidays");
  });

  it("is off the rest of the year", () => {
    // 11:30pm on October 31 in New York is already November 1 in UTC.
    expect(giftSeason(new Date("2026-11-01T03:30:00Z"))).toBeNull();
    expect(giftSeason(new Date("2026-12-26T12:00:00Z"))).toBeNull();
    expect(giftSeason(new Date("2027-06-01T12:00:00Z"))).toBeNull();
  });
});
