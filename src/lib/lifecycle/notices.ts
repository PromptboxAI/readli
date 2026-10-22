import { formatPrice } from "@/lib/family/plan";

/**
 * The recovery-window emails (Kevin, 2026-10-11, decision 8): Day 0 when the plan ends, Day 20 with ten
 * days remaining, Day 28 as the final reminder with two days remaining, and a short confirmation once
 * the household's data has actually been removed. Every one names the real deadline, and none carries
 * marketing.
 */
export type RecoveryNotice = "day0" | "day20" | "day28";

export const NOTICE_ORDER: RecoveryNotice[] = ["day0", "day20", "day28"];

/** Days left before deletion when each notice goes out (day0 goes out as soon as the window starts). */
export const NOTICE_DAYS_LEFT = { day20: 10, day28: 2 } as const;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function days(n: number): string {
  const w = WORDS[n] ?? String(n);
  return `${w} ${n === 1 ? "day" : "days"}`;
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export interface NoticeFacts {
  familyName: string;
  endedAt: string;
  deletesAt: string;
  familyMonthlyPriceCents: number;
  archiveMonthlyPriceCents: number;
  billingUrl: string;
  /** Whole days until deletion when the email is queued (normally ten for Day 20 and two for Day 28). */
  daysLeft: number;
}

export function recoveryEmail(kind: RecoveryNotice, f: NoticeFacts): { subject: string; body: string } {
  const ended = longDate(f.endedAt);
  const deletes = longDate(f.deletesAt);
  const choices = [
    `To keep everything, choose a plan before ${deletes}:`,
    `- Readli Family (${formatPrice(f.familyMonthlyPriceCents)} a month): keep listening and make new stories.`,
    `- Readli Family Archive (${formatPrice(f.archiveMonthlyPriceCents)} a month): keep every story, kids profile and permission, and keep listening. No new stories.`,
    `Choose a plan: ${f.billingUrl}`,
  ].join("\n");
  const kept = "We're keeping your family's stories, kids profiles and listening progress for you, but nobody can listen until you choose a plan.";
  switch (kind) {
    case "day0":
      return {
        subject: `Your Readli plan has ended. Your stories are saved until ${deletes}`,
        body: `Hi ${f.familyName},\n\nYour Readli plan ended on ${ended}. You have until ${deletes} to restore Readli Family or start the Archive. ${kept}\n\n${choices}\n\nIf you don't choose a plan, your family's stories, kids profiles and listening progress will be deleted on ${deletes}.\n\nThe Readli team`,
      };
    case "day20":
      return {
        subject: `${cap(days(f.daysLeft))} left to keep your Readli stories`,
        body: `Hi ${f.familyName},\n\nYour Readli plan ended on ${ended}, and there are ${days(f.daysLeft)} remaining before your family's stories are deleted on ${deletes}. ${kept}\n\n${choices}\n\nThe Readli team`,
      };
    case "day28":
      return {
        subject: `Final reminder: ${days(f.daysLeft)} left to keep your Readli stories`,
        body: `Hi ${f.familyName},\n\nThis is your final reminder: ${days(f.daysLeft)} remaining. Your family's stories will be deleted on ${deletes} unless you choose a plan.\n\n${choices}\n\nThe Readli team`,
      };
  }
}

/** Sent once the Day-30 removal has actually happened. */
export function deletedEmail(f: { familyName: string; deletedAt: string; billingUrl: string }): { subject: string; body: string } {
  return {
    subject: "Your Readli family data has been removed",
    body: `Hi ${f.familyName},\n\nAs we told you earlier, your family's saved stories, kids profiles and listening progress were removed from Readli on ${longDate(f.deletedAt)}. Your account and payment records are unaffected. You can start a new plan any time at ${f.billingUrl}.\n\nThe Readli team`,
  };
}
