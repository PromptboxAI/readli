import { createHash } from "crypto";
import { META_PIXEL_ID } from "@/lib/marketing/meta-pixel";
import { clientAddress } from "./rate-limit";

/**
 * Meta Conversions API (Kevin, 2026-10-25): the server's copy of the pixel's conversion events, so
 * Meta still counts them when an ad blocker stops the pixel, and the events only the server sees
 * (a confirmed account, a paid checkout). Each shares its event name and event_id with the pixel's
 * copy, so Meta counts the action once.
 *
 * Only grown-up account actions are sent, never anything about children or voices. User data is the
 * hashed email (not on Lead), a hashed Readli id, IP address, browser, and Meta's own _fbp/_fbc cookies.
 * Nothing is sent for a browser that opted out on /privacy/choices or sends Global Privacy Control.
 *
 * Needs META_CAPI_TOKEN (Vercel). Sends from production; elsewhere only when META_TEST_EVENT_CODE is
 * set, and then every event goes to Events Manager's Test Events tab instead of the live data.
 */

const GRAPH_VERSION = "v24.0";

export type CapiEventName = "Lead" | "CompleteRegistration" | "InitiateCheckout" | "Subscribe" | "Purchase" | "StartTrial";

/** What Readli knows about the browser behind an action, captured while that browser's request is open. */
export interface Attribution {
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  /** The page the action happened on. */
  sourceUrl?: string;
}

export interface CapiEvent {
  name: CapiEventName;
  eventId: string;
  /** Seconds since 1970; defaults to now. */
  time?: number;
  attribution: Attribution;
  /** Plain values; hashed here before they leave Readli. */
  email?: string | null;
  externalId?: string | null;
  customData?: Record<string, string | number>;
}

type Env = Record<string, string | undefined>;

export function capiEnabled(env: Env = process.env): boolean {
  if (!env.META_CAPI_TOKEN) return false;
  return env.VERCEL_ENV === "production" || Boolean(env.META_TEST_EVENT_CODE);
}

const OPT_OUT_COOKIE = "readli_ads_opt_out";

function cookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** The same opt-outs the pixel honours: the /privacy/choices cookie and Global Privacy Control. */
export function requestOptedOut(req: Request): boolean {
  return req.headers.get("sec-gpc") === "1" || cookie(req, OPT_OUT_COOKIE) === "1";
}

/** The browser details for an action, or null when that browser opted out. */
export function attributionFrom(req: Request, sourceUrl?: string): Attribution | null {
  if (requestOptedOut(req)) return null;
  const ip = clientAddress(req);
  return {
    ip: ip === "unknown" ? undefined : ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
    fbp: cookie(req, "_fbp"),
    fbc: cookie(req, "_fbc"),
    sourceUrl: sourceUrl ?? req.headers.get("referer") ?? undefined,
  };
}

/**
 * Attribution kept in Stripe Checkout metadata, so the webhook (which has no browser) can send
 * Subscribe and Purchase later. Absent when the browser opted out, which also stops those events.
 */
export function attributionMetadata(a: Attribution | null): Record<string, string> {
  if (!a) return {};
  const cut = (v: string | undefined) => (v ? v.slice(0, 500) : undefined);
  const entries = Object.entries({ meta_ads: "1", meta_ip: a.ip, meta_ua: cut(a.userAgent), meta_fbp: a.fbp, meta_fbc: a.fbc, meta_src: cut(a.sourceUrl) });
  return Object.fromEntries(entries.filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""));
}

export function attributionFromMetadata(m: Record<string, unknown>): Attribution | null {
  if (m.meta_ads !== "1") return null;
  const s = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  return { ip: s(m.meta_ip), userAgent: s(m.meta_ua), fbp: s(m.meta_fbp), fbc: s(m.meta_fbc), sourceUrl: s(m.meta_src) };
}

/** A pixel event_id from the browser: short and plain, or ignored. */
export function eventIdFrom(v: unknown): string | null {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(v) ? v : null;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function capiPayload(e: CapiEvent, now = Date.now()): Record<string, unknown> {
  const a = e.attribution;
  const email = e.email?.trim().toLowerCase();
  const user_data = Object.fromEntries(
    Object.entries({
      em: email ? [sha256(email)] : undefined,
      external_id: e.externalId ? [sha256(e.externalId)] : undefined,
      client_ip_address: a.ip,
      client_user_agent: a.userAgent,
      fbp: a.fbp,
      fbc: a.fbc,
    }).filter(([, v]) => v !== undefined),
  );
  return {
    event_name: e.name,
    event_time: e.time ?? Math.floor(now / 1000),
    event_id: e.eventId,
    action_source: "website",
    ...(a.sourceUrl ? { event_source_url: a.sourceUrl } : {}),
    user_data,
    ...(e.customData ? { custom_data: e.customData } : {}),
  };
}

/** Sends one event. Never throws: a Meta outage must not break sign-in, the demo or billing. */
export async function sendCapiEvent(e: CapiEvent, env: Env = process.env, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!capiEnabled(env)) return false;
  const body: Record<string, unknown> = { data: [capiPayload(e)], access_token: env.META_CAPI_TOKEN };
  if (env.META_TEST_EVENT_CODE) body.test_event_code = env.META_TEST_EVENT_CODE;
  try {
    const res = await fetchImpl(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error("meta capi rejected", e.name, res.status, (await res.text().catch(() => "")).slice(0, 300));
    return res.ok;
  } catch (err) {
    console.error("meta capi failed", e.name, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * The conversion a Stripe event stands for, from a completed Checkout that carried attribution: a paid
 * Readli Family checkout is Subscribe, a free first period is StartTrial (unused while checkout has no
 * trial), and a paid one-time checkout (credits) is Purchase. Value is what Stripe actually charged.
 * Subscribe's event_id matches the thank-you page's pixel event.
 */
export function stripeConversion(event: { type: string; created?: number; data?: { object?: Record<string, unknown> } }): CapiEvent | null {
  if (event.type !== "checkout.session.completed") return null;
  const s = event.data?.object ?? {};
  const meta = (s.metadata && typeof s.metadata === "object" ? s.metadata : {}) as Record<string, unknown>;
  const attribution = attributionFromMetadata(meta);
  if (!attribution || typeof s.id !== "string") return null;
  const cents = typeof s.amount_total === "number" ? s.amount_total : 0;
  const currency = typeof s.currency === "string" ? s.currency.toUpperCase() : "USD";
  const details = (s.customer_details && typeof s.customer_details === "object" ? s.customer_details : {}) as Record<string, unknown>;
  const email = typeof details.email === "string" ? details.email : null;
  const externalId = typeof meta.adult_id === "string" ? meta.adult_id : null;
  const base = { time: event.created, attribution, email, externalId };
  const item = typeof meta.item === "string" ? meta.item : undefined;
  if (s.mode === "subscription") {
    const subscriptionId = typeof s.subscription === "string" ? s.subscription : undefined;
    if (cents === 0 && s.status === "complete") {
      return { ...base, name: "StartTrial", eventId: `trial_${s.id}`, customData: { value: 0, currency, ...(item ? { content_name: item } : {}) } };
    }
    if (s.payment_status !== "paid") return null;
    return {
      ...base,
      name: "Subscribe",
      eventId: `subscribe_${s.id}`,
      customData: { value: cents / 100, currency, ...(subscriptionId ? { subscription_id: subscriptionId } : {}), ...(item ? { content_name: item } : {}) },
    };
  }
  if (s.mode === "payment" && s.payment_status === "paid") {
    return { ...base, name: "Purchase", eventId: `purchase_${s.id}`, customData: { value: cents / 100, currency, ...(item ? { content_name: item } : {}) } };
  }
  return null;
}
