import { formatPrice } from "@/lib/family/plan";
import { longDate } from "@/lib/lifecycle/notices";

/**
 * Plain-text transactional emails that aren't recovery notices (those live in lifecycle/notices.ts).
 * Short, factual, no marketing. Each returns a subject and body ready for the outbox.
 */
export type Email = { subject: string; body: string };

export function familyInviteEmail(f: { inviterName: string; familyName: string; inviteeName: string; link: string; expiresAt: string }): Email {
  return {
    subject: `${f.inviterName} invited you to join ${f.familyName} on Readli`,
    body: `Hi ${f.inviteeName},\n\n${f.inviterName} invited you to join ${f.familyName} on Readli, where kids hear stories read in the voices of the people who love them.\n\nAccept the invitation: ${f.link}\n\nThe link works until ${longDate(f.expiresAt)}. Joining doesn't record your voice or sign you up for anything else; you choose that later.\n\nThe Readli team`,
  };
}

export function giftDeliveryEmail(f: { giverName: string; recipientName: string; planName: string; redeemUrl: string; message: string | null }): Email {
  return {
    subject: `${f.giverName} sent you a Readli gift`,
    body: `Hi ${f.recipientName},\n\n${f.giverName} gave your family ${f.planName}.${f.message ? `\n\n"${f.message}"` : ""}\n\nRedeem it here: ${f.redeemUrl}\n\nThe Readli team`,
  };
}

export function giftRedeemedEmail(f: { giverName: string; recipientName: string; redeemedAt: string }): Email {
  return {
    subject: `${f.recipientName} redeemed your Readli gift`,
    body: `Hi ${f.giverName},\n\n${f.recipientName} redeemed your Readli gift on ${longDate(f.redeemedAt)}.\n\nThe Readli team`,
  };
}

export function paymentFailedEmail(f: { familyName: string; billingUrl: string; retryAt: string | null }): Email {
  return {
    subject: "We couldn't take your Readli payment",
    body: `Hi ${f.familyName},\n\nYour latest Readli payment didn't go through.${f.retryAt ? ` We'll try again on ${longDate(f.retryAt)}.` : ""} You can update your card here: ${f.billingUrl}\n\nThe Readli team`,
  };
}

export function recordingsDeletedEmail(f: { name: string; deletedAt: string; files: number }): Email {
  return {
    subject: "Your Readli voice recordings have been deleted",
    body: `Hi ${f.name},\n\nAs you asked, we deleted your original voice recordings (${f.files} ${f.files === 1 ? "file" : "files"}) from Readli's storage on ${longDate(f.deletedAt)}. Stories already made for your family stay available as described in the Voice Recording & AI Training Agreement.\n\nThe Readli team`,
  };
}

/**
 * The one reminder before a Readli Family trial turns into a paid plan (Kevin, 2026-10-12, decision 4):
 * when the trial ends, when the first charge is, exactly how much, monthly or yearly, and a direct link
 * to cancel or manage billing. Nothing promotional.
 */
export function trialEndingEmail(f: { familyName: string; trialEndsAt: string; amountCents: number; interval: "month" | "year"; billingUrl: string }): Email {
  const every = f.interval === "year" ? "yearly" : "monthly";
  return {
    subject: `Your Readli free trial ends on ${longDate(f.trialEndsAt)}`,
    body: `Hi ${f.familyName},\n\nYour Readli Family free trial ends on ${longDate(f.trialEndsAt)}.\n\nUnless you cancel before then, your ${every} Readli Family plan starts that day and we'll charge ${formatPrice(f.amountCents)} to the card you gave us on ${longDate(f.trialEndsAt)}, your next billing date. After that the plan renews ${every} until you cancel.\n\nTo cancel or change your plan, go to ${f.billingUrl}. Cancelling during the trial costs nothing.\n\nThe Readli team`,
  };
}
