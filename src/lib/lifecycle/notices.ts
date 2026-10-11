import { formatPrice } from "@/lib/family/plan";

/**
 * The recovery-window emails (Kevin, 2026-10-11): when paid access ends, nine days before deletion,
 * two days before, and on the day of the scheduled deletion. Every one names the actual dates.
 */
export type RecoveryNotice = "day0" | "day21" | "day28" | "day30";

export const NOTICE_ORDER: RecoveryNotice[] = ["day0", "day21", "day28", "day30"];

/** Days left before deletion when each notice goes out (day0 goes out as soon as the window starts). */
export const NOTICE_DAYS_LEFT: Record<RecoveryNotice, number> = { day0: Infinity, day21: 9, day28: 2, day30: 0 };

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
  const kept = "We're keeping your family's stories, kids profiles and storyteller permissions for you, but nobody can listen until you choose a plan.";
  switch (kind) {
    case "day0":
      return {
        subject: `Your Readli plan has ended. Your stories are saved until ${deletes}`,
        body: `Hi ${f.familyName},\n\nYour Readli plan ended on ${ended}. ${kept}\n\n${choices}\n\nIf you don't choose a plan, your family's stories will be deleted on ${deletes}.\n\nThe Readli team`,
      };
    case "day21":
      return {
        subject: `Nine days left to keep your Readli stories`,
        body: `Hi ${f.familyName},\n\nYour Readli plan ended on ${ended}, and there are nine days remaining before your family's stories are deleted on ${deletes}. ${kept}\n\n${choices}\n\nThe Readli team`,
      };
    case "day28":
      return {
        subject: `Final reminder: two days left to keep your Readli stories`,
        body: `Hi ${f.familyName},\n\nThis is your final reminder: two days remaining. Your family's stories will be deleted on ${deletes} unless you choose a plan.\n\n${choices}\n\nThe Readli team`,
      };
    case "day30":
      return {
        subject: `Your Readli stories are scheduled for deletion today`,
        body: `Hi ${f.familyName},\n\nYour Readli plan ended on ${ended}, and your family's stories are scheduled for deletion today, ${deletes}. If you choose a plan now, we'll keep them.\n\nChoose a plan: ${f.billingUrl}\n\nThe Readli team`,
      };
  }
}
