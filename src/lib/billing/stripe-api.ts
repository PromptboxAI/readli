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

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  trial_end?: number | null;
  pending_update?: unknown;
  metadata?: Record<string, string>;
  items: { data: { id: string; quantity?: number; current_period_end?: number; price: { id: string; lookup_key?: string | null; recurring?: { interval?: string } | null } }[] };
}

export class StripeApi {
  private readonly config: BillingConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: BillingConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  private async call<T>(method: "GET" | "POST", path: string, params: Params = {}, idempotencyKey?: string): Promise<T> {
    if (this.config.mode === "off" || !this.config.secretKey) throw new StripeError(503, "Payments are switched off.");
    const body = encodeForm(params);
    const url = `https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`;
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
    if (!res.ok) throw new StripeError(res.status, json.error?.message ?? `Stripe ${res.status}`);
    return json;
  }

  /** The active Stripe price for a catalog item, created on first use from the plan settings. */
  async priceFor(item: CatalogItem): Promise<string> {
    const found = await this.call<{ data: { id: string }[] }>("GET", "prices", { lookup_keys: [item.lookupKey], active: true });
    if (found.data[0]) return found.data[0].id;
    const created = await this.call<{ id: string }>("POST", "prices", {
      currency: "usd",
      unit_amount: item.amountCents,
      lookup_key: item.lookupKey,
      product_data: { name: item.name, metadata: { readli_item: item.id } },
      recurring: item.interval ? { interval: item.interval } : undefined,
      metadata: { readli_item: item.id },
    });
    return created.id;
  }

  async createCheckoutSession(params: Params): Promise<{ id: string; url: string }> {
    return this.call("POST", "checkout/sessions", params);
  }

  /** A customer's subscriptions in every state, for the lifecycle job's billing check before deleting anything. */
  async subscriptionStatuses(customer: string): Promise<string[]> {
    const list = await this.call<{ data: { status: string }[] }>("GET", "subscriptions", { customer, status: "all", limit: 20 });
    return list.data.map((s) => s.status);
  }

  /** The Stripe card fingerprint of a payment method, if it is a card. Used only to spot a reused trial card. */
  async cardFingerprint(paymentMethod: string): Promise<string | null> {
    const pm = await this.call<{ card?: { fingerprint?: string } }>("GET", `payment_methods/${encodeURIComponent(paymentMethod)}`);
    return pm.card?.fingerprint ?? null;
  }

  async subscription(id: string): Promise<StripeSubscription> {
    return this.call<StripeSubscription>("GET", `subscriptions/${encodeURIComponent(id)}`);
  }

  /** Changes a subscription's items (Readli's plan change flow). The idempotency key makes a retried click safe. */
  async updateSubscription(id: string, params: Params, idempotencyKey: string): Promise<StripeSubscription> {
    return this.call<StripeSubscription>("POST", `subscriptions/${encodeURIComponent(id)}`, params, idempotencyKey);
  }

  /** Stripe's hosted page where a parent updates their card, changes slots or cancels. */
  async createPortalSession(customer: string, returnUrl: string): Promise<{ url: string }> {
    return this.call("POST", "billing_portal/sessions", { customer, return_url: returnUrl });
  }
}
