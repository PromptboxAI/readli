/**
 * Server-only payments configuration. Never import from client components: it reads the provider keys.
 *
 * Payments are on only when all of these hold:
 * - PAYMENTS_ENABLED=true (Kevin switches it on; off by default everywhere).
 * - STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set.
 * - The key is a test key, or PAYMENTS_LIVE=true explicitly allows a live one.
 */
export type PaymentsMode = "off" | "test" | "live";

export type PaymentsOffReason = "switched_off" | "missing_keys" | "unknown_key" | "live_not_allowed";

export interface BillingConfig {
  provider: "stripe";
  mode: PaymentsMode;
  /** Why payments are off; absent when they're on. */
  offReason?: PaymentsOffReason;
  secretKey?: string;
  webhookSecret?: string;
  /** The Stripe product tax code put on every Readli product (STRIPE_PRODUCT_TAX_CODE). Managed Payments requires one. */
  productTaxCode?: string;
}

export function billingConfig(env: NodeJS.ProcessEnv = process.env): BillingConfig {
  const off = (offReason: PaymentsOffReason): BillingConfig => ({ provider: "stripe", mode: "off", offReason });
  if (env.PAYMENTS_ENABLED !== "true") return off("switched_off");
  const secretKey = env.STRIPE_SECRET_KEY;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) return off("missing_keys");
  const live = /^(sk|rk)_live_/.test(secretKey);
  if (!live && !/^(sk|rk)_test_/.test(secretKey)) return off("unknown_key");
  if (live && env.PAYMENTS_LIVE !== "true") return off("live_not_allowed");
  const taxCode = env.STRIPE_PRODUCT_TAX_CODE?.trim();
  const productTaxCode = taxCode && /^txcd_\d{8}$/.test(taxCode) ? taxCode : undefined;
  return { provider: "stripe", mode: live ? "live" : "test", secretKey, webhookSecret, ...(productTaxCode ? { productTaxCode } : {}) };
}

export function paymentsOn(config: BillingConfig = billingConfig()): boolean {
  return config.mode !== "off";
}

/**
 * The saved Stripe customer, only when it was made in the mode payments run in now. A customer from
 * test mode doesn't exist in live mode (and the other way round), so after the switch to live a family
 * that only ever paid in test mode checks out as a new customer.
 */
export function customerForMode(row: { customer_ref?: string | null; livemode?: boolean | null } | null | undefined, mode: PaymentsMode): string | undefined {
  if (!row?.customer_ref || mode === "off") return undefined;
  return Boolean(row.livemode) === (mode === "live") ? row.customer_ref : undefined;
}
