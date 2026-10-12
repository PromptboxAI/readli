import type { BillingConfig } from "./config";
import type { CatalogItem } from "./catalog";

/**
 * The few Stripe API calls Readli makes, over fetch so we don't need the Stripe SDK. Server only.
 * Callers check payments are on first; this refuses to run while they're off.
 */
type Scalar = string | number | boolean | null | undefined;
export interface Params {
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
  /** The subscription schedule driving a scheduled plan change, if any. */
  schedule?: string | null;
  metadata?: Record<string, string>;
  items: { data: { id: string; quantity?: number; current_period_end?: number; price: { id: string; lookup_key?: string | null; recurring?: { interval?: string } | null } }[] };
}

export interface StripeSchedule {
  id: string;
  status: string;
  subscription?: string | null;
  current_phase?: { start_date: number; end_date: number } | null;
  phases: { start_date: number; end_date: number; items: { price: string | { id: string }; quantity?: number }[]; metadata?: Record<string, string> }[];
}

/** The parts of Stripe's invoice preview Readli shows before a plan change. */
export interface StripeInvoicePreview {
  amount_due: number;
  total: number;
  lines: {
    data: {
      amount: number;
      proration?: boolean;
      parent?: { subscription_item_details?: { proration?: boolean } | null } | null;
      period?: { start: number; end: number };
    }[];
  };
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

  /** What a subscription change would bill, without changing anything. */
  async previewInvoice(params: Params): Promise<StripeInvoicePreview> {
    return this.call<StripeInvoicePreview>("POST", "invoices/create_preview", params);
  }

  async schedule(id: string): Promise<StripeSchedule> {
    return this.call<StripeSchedule>("GET", `subscription_schedules/${encodeURIComponent(id)}`);
  }

  /** Puts a subscription under a schedule (its current phase copied), or returns the one it already has. */
  async scheduleFor(sub: StripeSubscription, idempotencyKey: string): Promise<StripeSchedule> {
    if (sub.schedule) return this.schedule(sub.schedule);
    return this.call<StripeSchedule>("POST", "subscription_schedules", { from_subscription: sub.id }, idempotencyKey);
  }

  async updateSchedule(id: string, params: Params, idempotencyKey: string): Promise<StripeSchedule> {
    return this.call<StripeSchedule>("POST", `subscription_schedules/${encodeURIComponent(id)}`, params, idempotencyKey);
  }

  /** Drops a scheduled change: the subscription carries on as it is. */
  async releaseSchedule(id: string): Promise<StripeSchedule> {
    return this.call<StripeSchedule>("POST", `subscription_schedules/${encodeURIComponent(id)}/release`, {});
  }

  /**
   * Ends a subscription now (account deletion). With prorate, unused paid time becomes credit on the
   * customer's balance, which Readli then reviews for a refund rather than letting it lapse.
   */
  async cancelSubscription(id: string, opts: { prorate: boolean }): Promise<StripeSubscription> {
    return this.call<StripeSubscription>("DELETE", `subscriptions/${encodeURIComponent(id)}`, opts.prorate ? { prorate: true, invoice_now: true } : {});
  }

  /** The customer's balance in cents: negative is credit Readli owes them. */
  async customerBalance(customer: string): Promise<number> {
    const c = await this.call<{ balance?: number; deleted?: boolean }>("GET", `customers/${encodeURIComponent(customer)}`);
    return c.balance ?? 0;
  }

  /** Stripe's hosted page where a parent updates their card, changes slots or cancels. */
  /** Refunds part or all of a one-time payment, once per idempotency key. */
  async refund(paymentIntent: string, amountCents: number, idempotencyKey: string, metadata: Record<string, string>): Promise<{ id: string; status: string }> {
    return this.call("POST", "refunds", { payment_intent: paymentIntent, amount: amountCents, reason: "requested_by_customer", metadata }, idempotencyKey);
  }

  async createPortalSession(customer: string, returnUrl: string): Promise<{ url: string }> {
    return this.call("POST", "billing_portal/sessions", { customer, return_url: returnUrl });
  }
}
