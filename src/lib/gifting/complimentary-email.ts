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

/**
 * The note an event organizer gets when an admin emails a named adult their membership and adds the
 * organizer's address (Kevin, 2026-11-03). It says who it went to and nothing more: the claim link works
 * once, so it stays only in the recipient's email.
 */
export interface OrganizerNoticeFacts {
  recipientName: string | null;
  recipientEmail: string;
  months: number;
  sponsorName: string;
  sponsorIsReadli: boolean;
  eventName: string | null;
  claimBy: string | null;
  siteUrl: string;
}

export function complimentaryOrganizerEmail(f: OrganizerNoticeFacts): EmailMessage {
  const who = f.recipientName?.trim() ? `${f.recipientName.trim()} (${f.recipientEmail})` : f.recipientEmail;
  const claimBy = claimByLabel(f.claimBy);
  const what = `${termPhrase(f.months)} of Readli Family`;
  return readliEmail({
    subject: `We sent ${f.recipientName?.trim() || f.recipientEmail} their Readli membership`,
    name: "",
    title: "Their membership is on its way",
    paragraphs: [
      `We just emailed ${who} a complimentary membership: ${what}.`,
      presentedLine(f),
      claimBy ? `They have until ${claimBy} to claim it.` : "They can claim it from that email whenever they're ready.",
      "Their claim link works once, so it's only in their email. If they can't find it, ask them to check their spam or Promotions folder, or reply here and we'll help.",
    ],
    cta: { label: "About Readli", url: f.siteUrl },
    reason: "You're getting this because you were listed as the organizer when this membership was sent.",
  });
}

/**
 * Unknown-winner memberships (raffle, auction, basket) emailed to the person handing them out, usually
 * the event organizer (Kevin, 2026-11-03). Each membership is its own card with its code and one-time
 * link, so they can print it, forward it or read the code out to the winner.
 */
export interface BatchEmailFacts {
  months: number;
  occasion: string | null;
  sponsorName: string;
  sponsorIsReadli: boolean;
  eventName: string | null;
  claimBy: string | null;
  claimPage: string;
  memberships: { certificate: string; code: string; url: string }[];
}

export function complimentaryBatchEmail(f: BatchEmailFacts): EmailMessage {
  const n = f.memberships.length;
  const what = `${termPhrase(f.months)} of Readli Family`;
  const claimBy = claimByLabel(f.claimBy);
  return readliEmail({
    subject: n === 1 ? `Your Readli membership to give away: ${what}` : `Your ${n} Readli memberships to give away`,
    name: "",
    title: n === 1 ? "Here's the membership to give away" : `Here are ${n} memberships to give away`,
    paragraphs: [
      `${presentedLine(f)} Each one is ${what}, with no card needed and nothing that renews.`,
      n === 1
        ? "Give the winner the link or the code below. The link works once, so only share it with them."
        : "Give each winner one link or one code below. Each one works once, so give every winner a different one.",
      `They can also type the code at ${f.claimPage}.${claimBy ? ` Please have them claim it by ${claimBy}.` : ""}`,
    ],
    books: f.memberships.map((m) => ({ title: m.certificate, byline: `Code ${m.code}`, url: m.url, imageUrl: null })),
    cta: { label: "How claiming works", url: f.claimPage },
    reason: "You're getting this because a Readli admin sent you these memberships to hand out.",
  });
}
