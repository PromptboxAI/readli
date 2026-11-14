import { READLI_TIME_ZONE } from "@/lib/time";

/**
 * The gift season Readli is in today, if any (SleepyTale review, 2026-11). The holiday season runs from
 * November 1 to December 25 in Readli's time zone; the rest of the year the gift page stays evergreen.
 * A gift can be scheduled up to SPONSORED.maxDeliveryDays ahead, so "Christmas morning" is always reachable
 * inside the window.
 */
export interface GiftSeason {
  id: "holidays";
  /** Short line for banners, e.g. "Giving Readli this Christmas?". */
  banner: string;
  /** The delivery day to suggest, as YYYY-MM-DD. */
  deliverOn: string;
  deliverLabel: string;
}

function localParts(at: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: READLI_TIME_ZONE, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: n("year"), month: n("month"), day: n("day") };
}

export function giftSeason(at: Date = new Date()): GiftSeason | null {
  const { year, month, day } = localParts(at);
  if (month === 11 || (month === 12 && day <= 25)) {
    return { id: "holidays", banner: "Giving Readli this Christmas?", deliverOn: `${year}-12-25`, deliverLabel: "Christmas morning" };
  }
  return null;
}
