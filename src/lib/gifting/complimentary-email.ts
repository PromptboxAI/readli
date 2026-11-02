import type { EmailMessage } from "@/lib/email/outbox";
import { readliEmail } from "@/lib/email/templates";
import { claimByLabel, complimentaryHeadline, presentedLine, termPhrase } from "./complimentary-copy";

/**
 * The email a named adult gets when an admin issues them a complimentary membership with an email
 * address (Kevin, 2026-11-02). They usually have no account yet, so it carries the one-time claim link
 * and no email settings link.
 */
export interface ComplimentaryEmailFacts {
  recipientName: string | null;
  months: number;
  occasion: string | null;
  sponsorName: string;
  sponsorIsReadli: boolean;
  eventName: string | null;
  message: string | null;
  claimBy: string | null;
  claimUrl: string;
}

const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] ?? "";

export function complimentaryMembershipEmail(f: ComplimentaryEmailFacts): EmailMessage {
  const from = f.sponsorIsReadli ? "Readli" : f.sponsorName;
  const claimBy = claimByLabel(f.claimBy);
  return readliEmail({
    subject: `${from} gave you ${termPhrase(f.months)} of Readli Family`,
    name: firstName(f.recipientName),
    title: complimentaryHeadline({ months: f.months, occasion: f.occasion }),
    paragraphs: [
      presentedLine(f),
      ...(f.message ? [`"${f.message}"`] : []),
      "Readli reads classic children's books aloud at bedtime, and your family can add the voices of the people who love them.",
      "Claim it with the button below. You won't need a card, and nothing renews when it ends.",
      ...(claimBy ? [`Please claim it by ${claimBy}. The link works once, so keep this email to yourself.`] : ["The link works once, so keep this email to yourself."]),
    ],
    cta: { label: "Claim your membership", url: f.claimUrl },
    reason: `You're getting this because ${from} gave you a complimentary Readli Family membership.`,
  });
}
