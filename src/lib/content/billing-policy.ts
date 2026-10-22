/**
 * Readli's billing and refund policy (Kevin, 2026-10-12, "Final Credit Refund, Data Retention and Provider
 * Configuration Decisions"): no voluntary refund program. One wording for the Terms, the in-app purchase
 * screens and Stripe Checkout, so what a customer sees before paying matches the Terms.
 */

/** A refund that is owed (a duplicate charge, a billing error or one the law requires) starts within this many business days. */
export const REFUND_START_BUSINESS_DAYS = 5;
/** Notice before a recurring price increase applies to an existing subscription. */
export const PRICE_INCREASE_NOTICE_DAYS = 30;
/** The trial reminder goes out this many days before a Readli Family trial ends (Stripe's trial_will_end). */
export const TRIAL_REMINDER_DAYS = 3;
/** Days after a plan ends in which a household can come back and keep its stories and credits. */
export const RECOVERY_DAYS = 30;

export const CREDIT_PACK_REFUND_NOTICE = `Credits don't expire while your plan is active, and they aren't refundable, including when you cancel. If your plan ends, unused credits stay on your account for ${RECOVERY_DAYS} days in case you come back, and are then removed unless the law requires otherwise. If narration fails or isn't delivered, its credits come back automatically. Duplicate charges and billing errors are always corrected.`;

export const SUBSCRIPTION_REFUND_NOTICE =
  "Your plan renews automatically until you cancel, which you can do at any time in billing. Subscription payments aren't refundable, and there's no prorated refund when a plan ends, except where the law requires it or to correct a duplicate charge or billing error.";

export const REFUND_TIMING = `When a refund is owed, Readli starts it within ${REFUND_START_BUSINESS_DAYS} business days; your bank or card issuer may take longer to return the money.`;

/** Shown on Stripe Checkout above the pay button (Stripe allows up to 1,200 characters). */
export function checkoutNotice(mode: "subscription" | "payment", trialDays: number): string {
  const trial = trialDays > 0 ? `Your ${trialDays}-day free trial ends on its own and becomes a paid plan unless you cancel first. We email you ${TRIAL_REMINDER_DAYS} days before it ends. ` : "";
  return `${mode === "subscription" ? `${trial}${SUBSCRIPTION_REFUND_NOTICE}` : CREDIT_PACK_REFUND_NOTICE} ${REFUND_TIMING} Terms: https://readli.ai/terms`;
}
