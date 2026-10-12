/**
 * Readli's billing and refund policy (Kevin, 2026-10-12, "Final Business Policy Decisions", 1 to 4).
 * One wording for the Terms, the in-app purchase screens and Stripe Checkout, so what a customer sees
 * before paying matches the Terms. Counsel must review before launch.
 */

/** Days after purchase in which an unused credit pack can be refunded on request. */
export const PACK_REFUND_DAYS = 14;
/** Approved monetary refunds are started within this many business days. */
export const REFUND_START_BUSINESS_DAYS = 5;
/** Notice before a recurring price increase applies to an existing subscription. */
export const PRICE_INCREASE_NOTICE_DAYS = 30;
/** The trial reminder goes out this many days before a Readli Family trial ends (Stripe's trial_will_end). */
export const TRIAL_REMINDER_DAYS = 3;

export const CREDIT_PACK_REFUND_NOTICE = `Purchased credits don't expire while your account is active. You can ask for a refund of a credit pack within ${PACK_REFUND_DAYS} days of buying it if none of its credits have been used. After that, credits aren't refunded unless the law requires it, and unused credits end when your plan ends for good or you delete your account. If narration fails or is cancelled before it's delivered, its credits come back automatically.`;

export const SUBSCRIPTION_REFUND_NOTICE =
  "Your plan renews automatically until you cancel, which you can do at any time in billing. Subscription payments and unused credits aren't refunded once a paid period starts, including when you cancel or delete your account, except where the law requires it or for billing errors and duplicate charges.";

export const REFUND_TIMING = `Readli starts an approved refund within ${REFUND_START_BUSINESS_DAYS} business days; your bank or card issuer may take longer to return the money.`;

/** Shown on Stripe Checkout above the pay button (Stripe allows up to 1,200 characters). */
export function checkoutNotice(mode: "subscription" | "payment", trialDays: number): string {
  const trial = trialDays > 0 ? `Your ${trialDays}-day free trial ends on its own and becomes a paid plan unless you cancel first. We email you ${TRIAL_REMINDER_DAYS} days before it ends. ` : "";
  return `${mode === "subscription" ? `${trial}${SUBSCRIPTION_REFUND_NOTICE}` : CREDIT_PACK_REFUND_NOTICE} ${REFUND_TIMING} Terms: https://readli.ai/terms`;
}
