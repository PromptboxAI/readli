import { PRIZE_KINDS, type ComplimentaryKind } from "@/lib/admin/complimentary-kinds";

/**
 * Words for complimentary memberships, shared by the admin preview, the winner's page and the
 * certificate (Kevin, 2026-10-22). The sponsor, the event and the recipient are separate facts: an
 * event is never called the sender, and a missing recipient name is never filled with a placeholder.
 */
export interface ComplimentaryFacts {
  months: number;
  occasion: string | null;
  sponsorName: string;
  sponsorIsReadli: boolean;
  eventName: string | null;
  recipientName: string | null;
}

/** "a year", "3 months", "a month". */
export function termPhrase(months: number): string {
  return months === 12 ? "a year" : months === 1 ? "a month" : `${months} months`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function isPrize(occasion: string | null): boolean {
  return occasion !== null && (PRIZE_KINDS as readonly string[]).includes(occasion as ComplimentaryKind);
}

/** "You've won a year of Readli Family!" for prizes, "Enjoy a year of Readli Family!" otherwise. */
export function complimentaryHeadline(f: Pick<ComplimentaryFacts, "months" | "occasion">): string {
  return isPrize(f.occasion) ? `You've won ${termPhrase(f.months)} of Readli Family!` : `Enjoy ${termPhrase(f.months)} of Readli Family!`;
}

/** The certificate's title: "A year of Readli Family". */
export function certificateHeadline(months: number): string {
  return `${capitalize(termPhrase(months))} of Readli Family`;
}

function forEvent(eventName: string): string {
  return /^the\s/i.test(eventName) ? `for ${eventName}` : `for the ${eventName}`;
}

/** "Donated by Readli for the Mount Elementary Basket Dinner." or "Presented by Oak Street PTA." */
export function presentedLine(f: Pick<ComplimentaryFacts, "sponsorName" | "sponsorIsReadli" | "eventName">, period = true): string {
  const who = f.sponsorIsReadli ? "Donated by Readli" : `Presented by ${f.sponsorName}`;
  const line = f.eventName ? `${who} ${forEvent(f.eventName)}` : who;
  return period ? `${line}.` : line;
}

/** A short line naming the person, only when the admin named them. */
export function recipientLine(recipientName: string | null): string | null {
  const name = recipientName?.trim();
  return name ? `For ${name}` : null;
}

export function claimByLabel(claimBy: string | null): string | null {
  if (!claimBy) return null;
  return new Date(claimBy).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
