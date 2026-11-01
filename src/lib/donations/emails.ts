import { COMPANY } from "@/lib/content/company";
import type { EmailMessage } from "@/lib/email/outbox";
import { readliEmail } from "@/lib/email/templates";
import { eventDateLabel } from "./program";

/**
 * Readli Gives Back emails (spec section 7). Applicants have no Readli account, so these go to the
 * address on the request and link to its private status page, where the certificate is downloaded.
 * Only that address ever gets the link, which is how the applicant's email is confirmed.
 */

export const SUPPORT_EMAIL = COMPANY.email;
const APPLICANT_REASON = "You're getting this because you asked Readli Gives Back for a donation.";

export interface RequestFacts {
  reference: string;
  orgName: string;
  eventName: string;
  eventDate: string;
  contactName: string;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export function requestReceivedEmail(r: RequestFacts, statusUrl: string): EmailMessage {
  return readliEmail({
    subject: `We received your Readli Gives Back request (${r.reference})`,
    name: firstName(r.contactName),
    title: "Thank you for helping make a difference!",
    paragraphs: [
      `We've received your request for ${r.orgName}'s ${r.eventName} on ${eventDateLabel(r.eventDate)}.`,
      `Your reference number is ${r.reference}. We'll email you again once our eligibility review is complete, and you can check where it's up to at any time.`,
      "Applying is free. There is no national limit on donations, so your request isn't competing with anyone else's.",
    ],
    cta: { label: "Check your request", url: statusUrl },
    reason: APPLICANT_REASON,
  });
}

export function approvedEmail(r: RequestFacts, statusUrl: string, claimByLabel: string, retailValue: string): EmailMessage {
  return readliEmail({
    subject: `Your Readli donation is approved (${r.reference})`,
    name: firstName(r.contactName),
    title: "Congratulations, your donation is approved!",
    paragraphs: [
      `Readli is proud to donate a 12-month Readli Family membership (retail value ${retailValue}) to ${r.eventName}.`,
      "Your printable 8.5 × 11 in certificate is ready. It has a unique, single-use redemption code and a QR code. Print it for your raffle basket or auction table.",
      `The winning family activates it at readli.ai/redeem by ${claimByLabel}. They don't need a credit card, and it won't renew as a paid plan.`,
      "Please keep the certificate somewhere safe until the event: anyone with the code can redeem it.",
    ],
    cta: { label: "Download your certificate", url: statusUrl },
    reason: APPLICANT_REASON,
  });
}

export function infoNeededEmail(r: RequestFacts, statusUrl: string, message: string): EmailMessage {
  return readliEmail({
    subject: `A quick question about your Readli donation request (${r.reference})`,
    name: firstName(r.contactName),
    title: "We need a little more information",
    paragraphs: [
      `Thanks for your request for ${r.eventName}. Before we can approve it, we need one more thing from you:`,
      message,
      "You can reply on your request page, and attach a document such as a school letter or a note from the charity the event supports.",
    ],
    cta: { label: "Reply to us", url: statusUrl },
    reason: APPLICANT_REASON,
  });
}

export function notApprovedEmail(r: RequestFacts, statusUrl: string, reason: string): EmailMessage {
  return readliEmail({
    subject: `About your Readli donation request (${r.reference})`,
    name: firstName(r.contactName),
    title: "We weren't able to approve this request",
    paragraphs: [
      `Thank you for thinking of Readli for ${r.eventName}. After reviewing your request, we can't donate to this event.`,
      reason,
      `If something has changed or you think we've misunderstood, email ${SUPPORT_EMAIL} with your reference number (${r.reference}) and we'll take another look.`,
    ],
    cta: { label: "View your request", url: statusUrl },
    reason: APPLICANT_REASON,
  });
}

export function winnerWelcomeEmail(opts: { name: string; endsLabel: string; eventName: string | null; base: string; preferencesUrl: string }): EmailMessage {
  return readliEmail({
    subject: "Your Readli Family membership is on",
    name: opts.name,
    title: "Welcome to a whole year of stories",
    paragraphs: [
      `Your complimentary Readli Family membership${opts.eventName ? ` from ${opts.eventName}` : ""} is active until ${opts.endsLabel}. No card is on file, and nothing renews or charges you when it ends.`,
      "To get started: add your children's profiles, record your own voice in about a minute, and invite a grandparent or another loved one to read in theirs. Every storyteller needs their own permission and yours before your kids hear them.",
      "Then set up your kids' tablet so they can pick a story and listen at bedtime.",
    ],
    cta: { label: "Set up your family", url: `${opts.base}/family` },
    reason: "You're getting this because you redeemed a Readli Gives Back certificate.",
    preferencesUrl: opts.preferencesUrl,
  });
}

/** To the Readli admins: a request is waiting in Admin → Readli Gives Back. */
export function adminReviewEmail(r: RequestFacts, opts: { kind: "new" | "reply"; flags: string[]; about: string | null; adminUrl: string }): EmailMessage {
  const isReply = opts.kind === "reply";
  return readliEmail({
    subject: isReply ? `Donation request reply to review: ${r.orgName} (${r.reference})` : `New donation request: ${r.orgName} (${r.reference})`,
    name: "",
    title: isReply ? "An applicant answered your question" : "A new Readli Gives Back request is waiting",
    paragraphs: [
      `${r.orgName}, ${r.eventName} on ${eventDateLabel(r.eventDate)}. From ${r.contactName}.`,
      ...(opts.about && !isReply ? [`About the fundraiser: ${opts.about.length > 600 ? `${opts.about.slice(0, 600)}…` : opts.about}`] : []),
      opts.flags.length ? `Things to check: ${opts.flags.join(" ")}` : "No automatic checks were flagged.",
    ],
    cta: { label: isReply ? "Review the reply" : "Review and approve", url: opts.adminUrl },
    reason: "You're getting this because you're a Readli admin.",
  });
}
