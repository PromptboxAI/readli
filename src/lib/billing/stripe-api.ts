import type { BillingConfig } from "./config";
import type { CatalogItem } from "./catalog";

/**
 * The few Stripe API calls Readli makes, over fetch so we don't need the Stripe SDK. Server only.
 * Callers check payments are on first; this refuses to run while they're off.
 */
type Scalar = string | number | boolean | null | undefined;
interface Params {
  [key: string]: Scalar | Params | Params[] | string[];
}

/** Stripe's form encoding: nested objects as a[b]=..., arrays as a[0]=... */
export function encodeForm(params: Params, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === "object") parts.push(encodeForm(v, `${name}[${i}]`));
        else parts.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(v))}`);
      });
    } else if (typeof value === "object") {
      parts.push(encodeForm(value, name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

export class StripeError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class StripeApi {
  private readonly config: BillingConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: BillingConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  private async call<T>(method: "GET" | "POST" | "DELETE", path: string, params: Params = {}, idempotencyKey?: string): Promise<T> {
    if (this.config.mode === "off" || !this.config.secretKey) throw new StripeError(503, "Payments are switched off.");
    const body = encodeForm(params);
    const url = `https://api.stripe.com/v1/${path}${method !== "POST" && body ? `?${body}` : ""}`;
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        authorization: `Bearer ${this.config.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: method === "POST" ? body : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) {
      const message = json.error?.message ?? `Stripe ${res.status}`;
      console.error(`Stripe ${method} /v1/${path} failed (${res.status}): ${message}`);
      throw new StripeError(res.status, message);
    }
    return json;
  }

  /**
   * The active Stripe price for a catalog item, created on first use from the plan settings. Its product
   * carries the configured tax code, and a product made before the code was set is given it here.
   */
  async priceFor(item: CatalogItem): Promise<string> {
    const taxCode = this.config.productTaxCode;
    const found = await this.call<{ data: { id: string; product?: string | { id: string; tax_code?: string | { id: string } | null } }[] }>("GET", "prices", {
      lookup_keys: [item.lookupKey],
      active: true,
      ...(taxCode ? { expand: ["data.product"] } : {}),
    });
    const price = found.data[0];
    if (price) {
      const product = typeof price.product === "object" ? price.product : null;
      const current = typeof product?.tax_code === "object" ? product.tax_code?.id : product?.tax_code;
      if (taxCode && product && current !== taxCode) await this.call("POST", `products/${encodeURIComponent(product.id)}`, { tax_code: taxCode });
      return price.id;
    }
    const created = await this.call<{ id: string }>("POST", "prices", {
      currency: "usd",
      unit_amount: item.amountCents,
      lookup_key: item.lookupKey,
      product_data: { name: item.name, metadata: { readli_item: item.id }, tax_code: taxCode },
      recurring: item.interval ? { interval: item.interval } : undefined,
      metadata: { readli_item: item.id },
    });
    return created.id;
  }

  async createCheckoutSession(params: Params): Promise<{ id: string; url: string }> {
    return this.call("POST", "checkout/sessions", params);
  }

  /** Stripe's hosted page where a parent updates their card, changes slots or cancels. */
  async createPortalSession(customer: string, returnUrl: string): Promise<{ url: string }> {
    return this.call("POST", "billing_portal/sessions", { customer, return_url: returnUrl });
  }

  async getSubscription(id: string): Promise<StripeSubscription> {
    return this.call("GET", `subscriptions/${encodeURIComponent(id)}`);
  }

  /**
   * Gives a subscriber free time without a charge or a credit: Stripe bills nothing until `trialEnd`
   * (seconds), then the plan carries on as before. The key makes a retry a no-op.
   */
  async pauseBillingUntil(id: string, trialEnd: number, idempotencyKey: string): Promise<StripeSubscription> {
    return this.call("POST", `subscriptions/${encodeURIComponent(id)}`, { trial_end: trialEnd, proration_behavior: "none" }, idempotencyKey);
  }

  async getPaymentIntent(id: string): Promise<{ id: string; payment_method?: string | { id: string } | null; customer?: string | { id: string } | null }> {
    return this.call("GET", `payment_intents/${encodeURIComponent(id)}`);
  }

  async createSubscription(params: Params, idempotencyKey: string): Promise<StripeSubscription> {
    return this.call("POST", "subscriptions", params, idempotencyKey);
  }

  async updateSubscription(id: string, params: Params, idempotencyKey?: string): Promise<StripeSubscription> {
    return this.call("POST", `subscriptions/${encodeURIComponent(id)}`, params, idempotencyKey);
  }

  /** Ends a subscription now, with no final invoice. */
  async cancelSubscription(id: string): Promise<StripeSubscription> {
    return this.call("DELETE", `subscriptions/${encodeURIComponent(id)}`);
  }

  /** A full refund of a payment. The key makes a retry a no-op. */
  async refundPayment(paymentIntent: string, metadata: Record<string, string>, idempotencyKey: string): Promise<{ id: string; status: string }> {
    return this.call("POST", "refunds", { payment_intent: paymentIntent, metadata }, idempotencyKey);
  }
}

export interface StripeSubscription {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  trial_end?: number | null;
  items?: { data?: { current_period_end?: number }[] };
}
