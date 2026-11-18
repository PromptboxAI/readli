/**
 * Revenue records for the admin finance report (revenue_events, owned by the admin reporting work).
 * One row per paid invoice line, per paid one-time checkout and per refund. Pure: the webhook writes
 * the rows, and the unique (provider, provider_ref) key makes retried events harmless.
 */

export interface RevenueRow {
  household_id: string | null;
  payer_id: string | null;
  kind: "subscription" | "narrator_slot" | "credit_pack" | "gift" | "sponsorship";
  amount_cents: number;
  currency: string;
  billing_interval: "month" | "year" | null;
  quantity: number;
  period_start: string | null;
  period_end: string | null;
  provider: "stripe";
  provider_ref: string;
  livemode: boolean;
  occurred_at: string;
  /** Sponsorship rows only, so other rows still insert before the sponsorship migration runs. */
  sponsorship_id?: string | null;
}

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const iso = (s: unknown): string | null => (num(s) === null ? null : new Date((s as number) * 1000).toISOString());
const ref = (v: unknown): string | null => str(v) ?? str(o(v).id);

/** Readli's lookup keys say what a price is for (src/lib/billing/catalog.ts). */
function recurringKind(lookupKey: string | null): { kind: "subscription" | "narrator_slot" | "sponsorship"; interval: "month" | "year" } | null {
  if (!lookupKey) return null;
  if (lookupKey.startsWith("readli_sponsored_family_monthly_")) return { kind: "sponsorship", interval: "month" };
  if (lookupKey.startsWith("readli_extra_slot_")) return { kind: "narrator_slot", interval: "month" };
  if (lookupKey.startsWith("readli_family_annual_")) return { kind: "subscription", interval: "year" };
  if (lookupKey.startsWith("readli_family_monthly_")) return { kind: "subscription", interval: "month" };
  return null;
}

/** Household and payer from wherever this API version put the subscription's metadata. */
function invoiceMetadata(invoice: Obj, line: Obj): Obj {
  for (const m of [o(line.metadata), o(o(invoice.subscription_details).metadata), o(o(o(invoice.parent).subscription_details).metadata)]) {
    if (str(m.household_id) || str(m.sponsorship_id)) return m;
  }
  return {};
}

function lineLookupKey(line: Obj): string | null {
  return str(o(line.price).lookup_key) ?? str(o(o(o(line.pricing).price_details).price).lookup_key) ?? str(o(line.metadata).readli_lookup_key);
}

export function revenueRows(event: { type: string; livemode?: boolean; created?: number; data?: { object?: Obj } }): RevenueRow[] {
  const obj = o(event.data?.object);
  const livemode = event.livemode === true;
  const when = iso(event.created) ?? new Date().toISOString();
  const currency = str(obj.currency) ?? "usd";

  if (event.type === "invoice.paid") {
    const lines = (o(obj.lines).data as Obj[] | undefined) ?? [];
    const paidAt = iso(o(obj.status_transitions).paid_at) ?? when;
    return lines.flatMap<RevenueRow>((line) => {
      const kind = recurringKind(lineLookupKey(line));
      const id = str(line.id);
      const amount = num(line.amount);
      if (!kind || !id || amount === null || amount <= 0) return [];
      const meta = invoiceMetadata(obj, line);
      const period = o(line.period);
      const sponsored = kind.kind === "sponsorship";
      return [
        {
          // A sponsor pays for families they don't belong to: the row is the sponsor's, never a household's.
          household_id: sponsored ? null : str(meta.household_id),
          payer_id: str(sponsored ? meta.sponsor_id : meta.adult_id),
          kind: kind.kind,
          amount_cents: amount,
          currency,
          billing_interval: kind.interval,
          quantity: num(line.quantity) ?? 1,
          period_start: iso(period.start),
          period_end: iso(period.end),
          provider: "stripe" as const,
          provider_ref: id,
          livemode,
          occurred_at: paidAt,
          ...(sponsored ? { sponsorship_id: str(meta.sponsorship_id) } : {}),
        },
      ];
    });
  }

  if (event.type === "checkout.session.completed" && obj.mode === "payment" && obj.payment_status === "paid") {
    const meta = o(obj.metadata);
    if (meta.readli_kind === "sponsorship") return sponsorshipPayment(obj, meta, livemode, when, currency);
    const item = str(meta.item) ?? "";
    const kind = item.startsWith("credit_pack:") ? "credit_pack" : str(meta.gift_id) || item.startsWith("gift") ? "gift" : null;
    const id = ref(obj.payment_intent) ?? str(obj.id);
    const amount = num(obj.amount_total);
    if (!kind || !id || !amount) return [];
    return [
      {
        household_id: str(meta.household_id),
        payer_id: str(meta.adult_id),
        kind,
        amount_cents: amount,
        currency,
        billing_interval: null,
        quantity: 1,
        period_start: null,
        period_end: null,
        provider: "stripe",
        provider_ref: id,
        livemode,
        occurred_at: when,
      },
    ];
  }

  if (event.type === "charge.refunded") {
    const meta = o(obj.metadata);
    const item = str(meta.item) ?? "";
    const refunds = (o(obj.refunds).data as Obj[] | undefined) ?? [];
    const sponsorship = meta.readli_kind === "sponsorship";
    const oneTime = item.startsWith("credit_pack:") ? "credit_pack" : str(meta.gift_id) || item.startsWith("gift") ? "gift" : null;
    return refunds.flatMap<RevenueRow>((r) => {
      const id = str(r.id);
      const amount = num(r.amount);
      if (!id || !amount || (str(r.status) && r.status !== "succeeded")) return [];
      if (sponsorship) {
        return [{ ...sponsorshipRow(meta, livemode, -amount, str(r.currency) ?? currency, id, iso(r.created) ?? when), period_start: null, period_end: null }];
      }
      return [
        {
          household_id: str(meta.household_id),
          payer_id: str(meta.adult_id),
          // A refund on a subscription invoice has no service period, so it never counts toward MRR.
          kind: oneTime ?? "subscription",
          amount_cents: -amount,
          currency: str(r.currency) ?? currency,
          billing_interval: oneTime ? null : "month",
          quantity: 1,
          period_start: null,
          period_end: null,
          provider: "stripe" as const,
          provider_ref: id,
          livemode,
          occurred_at: iso(r.created) ?? when,
        },
      ];
    });
  }

  return [];
}

/** The sponsor's first payment: the year or first month, with the paid access it covers. */
function sponsorshipPayment(obj: Obj, meta: Obj, livemode: boolean, when: string, currency: string): RevenueRow[] {
  const id = ref(obj.payment_intent) ?? str(obj.id);
  const amount = num(obj.amount_total);
  if (!id || !amount) return [];
  return [sponsorshipRow(meta, livemode, amount, currency, id, when)];
}

function sponsorshipRow(meta: Obj, livemode: boolean, amount: number, currency: string, providerRef: string, occurredAt: string): RevenueRow {
  return {
    household_id: null,
    payer_id: str(meta.sponsor_id),
    kind: "sponsorship",
    amount_cents: amount,
    currency,
    billing_interval: meta.plan === "annual" ? "year" : "month",
    quantity: 1,
    period_start: str(meta.deliver_at),
    period_end: str(meta.paid_through),
    provider: "stripe",
    provider_ref: providerRef,
    livemode,
    occurred_at: occurredAt,
    sponsorship_id: str(meta.sponsorship_id),
  };
}
