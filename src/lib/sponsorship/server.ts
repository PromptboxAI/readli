import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupKey, type CatalogItem } from "@/lib/billing/catalog";
import type { StripeApi } from "@/lib/billing/stripe-api";
import { queueEmails, type QueuedEmail } from "@/lib/email/outbox";
import { preferencesUrl } from "@/lib/email/preferences";
import { readliEmail } from "@/lib/email/templates";
import { emailHash, hashInvitationToken, track } from "@/lib/invitations/server";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import type { SponsorshipChange } from "./events";
import {
  accessEnd,
  canOfferPlace,
  cancelOutcome,
  chargeCopy,
  chargeSchedule,
  creditSplit,
  giftMonth,
  LIVE_SEATS,
  priceCents,
  removalDate,
  shortDate,
  SPONSORED,
  SponsorshipError,
  zonedTime,
  type CancelOutcome,
  type GiveRequest,
  type Recipient,
  type SeatStatus,
  type SponsorPlan,
  type SponsorshipFacts,
  type SponsorshipStatus,
} from "./rules";

/**
 * Sponsorships against the database and Stripe (service role). Sponsors are charged at checkout; access
 * starts on the delivery date. Families join through their own invitation (accept_sponsored_invitation),
 * never through the free Readli Voice invitation, and each family's parents keep every approval.
 */

type Row = Record<string, unknown>;

export interface SponsorshipContext {
  db: SupabaseClient;
  /** Null while payments are off; anything that needs Stripe refuses then. */
  stripe: StripeApi | null;
  /** Encrypts invitation addresses and signs email links. */
  secret: string;
  /** Site origin for links in email and Stripe's return pages. */
  base: string;
  livemode: boolean;
  now?: () => Date;
}

export const SPONSOR_HOME = "/gift/family";
export const SPONSOR_CONSENT_VERSION = "sponsored-voice-share-2026-10";
export const SPONSOR_CONSENT = "I agree to share my Readli voice with each family I chose. Their parents decide whether each child hears it, and I can stop sharing at any time.";

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

const clock = (ctx: SponsorshipContext) => (ctx.now ?? (() => new Date()))();
const date = (v: unknown): Date | null => (typeof v === "string" && v ? new Date(v) : null);

export function sponsorshipFacts(row: Row): SponsorshipFacts {
  return {
    plan: row.plan as SponsorPlan,
    status: row.status as SponsorshipStatus,
    startsAt: date(row.starts_at),
    paidThrough: date(row.paid_through),
    endsAt: date(row.ends_at),
    deliveredAt: date(row.delivered_at),
  };
}

/** The Stripe prices: the year and the first month are one-time payments; renewals are a monthly price. */
export function sponsorPrice(kind: "year" | "first_month" | "monthly"): CatalogItem {
  const cents = kind === "year" ? SPONSORED.annualCents : SPONSORED.monthlyCents;
  const names = { year: "Readli Family gift (one year)", first_month: "Readli Family gift (first month)", monthly: "Readli Family gift (monthly)" };
  return { id: `sponsored_family_${kind}` as CatalogItem["id"], name: names[kind], amountCents: cents, interval: kind === "monthly" ? "month" : null, lookupKey: lookupKey(`sponsored_family_${kind}`, cents) };
}

/** The feature switch (feature_flags.sponsored_family). Off unless the row says on. */
export async function sponsoredFamilyOn(db: SupabaseClient): Promise<boolean> {
  const rows = await q(db.from("feature_flags").select("enabled").eq("key", "sponsored_family"), "read sponsored_family flag");
  return rows[0]?.enabled === true;
}

async function sponsorshipFor(ctx: SponsorshipContext, id: string, sponsorId?: string): Promise<Row> {
  let query = ctx.db.from("sponsorships").select("*").eq("id", id);
  if (sponsorId) query = query.eq("sponsor_id", sponsorId);
  const row = (await q(query, "read sponsorship"))[0];
  if (!row) throw new SponsorshipError(404, "not_found", "We couldn't find that gift.");
  return row;
}

const seatsOf = (ctx: SponsorshipContext, id: string) => q(ctx.db.from("sponsorship_seats").select("*").eq("sponsorship_id", id), "read places");
const sync = async (ctx: SponsorshipContext, id: string) => {
  await q(ctx.db.rpc("sync_sponsorship", { p_sponsorship: id }), "sync sponsorship");
};
const metadataOf = (sp: Row) => ({ readli_kind: "sponsorship", sponsorship_id: sp.id as string, sponsor_id: String(sp.sponsor_id ?? ""), plan: sp.plan as string });

/** A place's invitation row, made with an unusable token; a real one is issued when it's sent. */
function invitationRow(ctx: SponsorshipContext, seatId: string, email: string, expires: Date): Row {
  return {
    seat_id: seatId,
    token_hash: hashInvitationToken(`unsent:${randomBytes(24).toString("base64url")}`),
    recipient_email_hash: emailHash(ctx.secret, email),
    recipient_email_encrypted: new ProviderRefCipher(ctx.secret).encrypt(email),
    expires_at: expires.toISOString(),
  };
}

export interface StartedGift {
  sponsorshipId: string;
  url: string;
}

/**
 * Saves the gift as awaiting payment and opens Stripe Checkout. The year is a one-time payment with no
 * card saved, so it can never renew without a new checkout. Monthly pays the first month now and saves
 * the card; the subscription is made when the payment is confirmed, first charging a month after delivery.
 */
export async function startGift(ctx: SponsorshipContext, sponsor: { id: string; email: string | null }, gift: GiveRequest): Promise<StartedGift> {
  if (!ctx.stripe) throw new SponsorshipError(404, "payments_off", "Gifts can't be bought yet.");
  const schedule = chargeSchedule(gift.plan, gift.deliverAt);
  let consentId: string | null = null;
  if (gift.sharesVoice) {
    const receipt = await q(
      ctx.db
        .from("consent_receipts")
        .insert({
          user_id: sponsor.id,
          policy_version: SPONSOR_CONSENT_VERSION,
          purpose: "sponsored_voice_share",
          adult_owner_declared: true,
          accepted_fields: { statements: [SPONSOR_CONSENT], families: gift.recipients.filter((r) => r.shareVoice).length },
        })
        .select("id"),
      "save consent",
    );
    consentId = receipt[0]?.id as string;
  }
  const [sp] = await q<[Row]>(
    ctx.db
      .from("sponsorships")
      .insert({
        sponsor_id: sponsor.id,
        plan: gift.plan,
        status: "awaiting_payment",
        price_cents: priceCents(gift.plan),
        max_households: SPONSORED.households,
        monthly_credits: SPONSORED.monthlyCredits,
        giver_display_name: gift.giverName,
        message: gift.message || null,
        consent_receipt_id: consentId,
        deliver_at: gift.deliverAt.toISOString(),
        livemode: ctx.livemode,
      })
      .select("*"),
    "save gift",
  );
  const id = sp.id as string;
  for (const [i, r] of gift.recipients.entries()) await addPlace(ctx, id, i + 1, r, new Date(schedule.accessStarts.getTime() + SPONSORED.invitationDays * 86_400_000));

  const { data: earlier } = await ctx.db.from("sponsorships").select("provider_customer_ref").eq("sponsor_id", sponsor.id).not("provider_customer_ref", "is", null).limit(1);
  const customer = (earlier as Row[] | null)?.[0]?.provider_customer_ref as string | undefined;
  const metadata = { ...metadataOf(sp), item: `sponsorship:${gift.plan}`, deliver_at: schedule.accessStarts.toISOString(), paid_through: schedule.paidThrough.toISOString() };
  const copy = chargeCopy(gift.plan, gift.deliverAt);
  const price = await ctx.stripe.priceFor(sponsorPrice(gift.plan === "annual" ? "year" : "first_month"));
  const checkout = await ctx.stripe.createCheckoutSession({
    mode: "payment",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: id,
    customer,
    customer_creation: customer ? undefined : "always",
    customer_email: customer ? undefined : (sponsor.email ?? undefined),
    metadata,
    payment_intent_data: { metadata, setup_future_usage: gift.plan === "monthly" ? "off_session" : undefined },
    custom_text: { submit: { message: gift.plan === "annual" ? copy.summary : `${copy.summary}. ${copy.renewal}` } },
    success_url: `${ctx.base}${SPONSOR_HOME}?gift=${id}&checkout=success`,
    cancel_url: `${ctx.base}${SPONSOR_HOME}?gift=${id}&checkout=canceled`,
  });
  await track(ctx.db, "sponsor_checkout_started", {
    sponsorship_id: id,
    plan: gift.plan,
    families: gift.recipients.length,
    voice_families: gift.recipients.filter((r) => r.shareVoice).length,
    lead_days: Math.round((gift.deliverAt.getTime() - clock(ctx).getTime()) / 86_400_000),
  }, sponsor.id);
  return { sponsorshipId: id, url: checkout.url };
}

async function addPlace(ctx: SponsorshipContext, sponsorshipId: string, seat: number, r: Recipient, expires: Date, share: number = SPONSORED.startingShare): Promise<{ seatId: string; invitationId: string }> {
  const [row] = await q<[Row]>(
    ctx.db.from("sponsorship_seats").insert({ sponsorship_id: sponsorshipId, seat, status: "invited", recipient_name: r.name, share_voice: r.shareVoice, credit_share: share }).select("id"),
    "save place",
  );
  const [inv] = await q<[Row]>(ctx.db.from("sponsorship_invitations").insert(invitationRow(ctx, row.id as string, r.email, expires)).select("id"), "save invitation");
  return { seatId: row.id as string, invitationId: inv.id as string };
}

/** Applies a sponsorship Stripe event. Safe to repeat. */
export async function applySponsorshipChange(ctx: SponsorshipContext, change: SponsorshipChange): Promise<void> {
  const now = clock(ctx);
  if (change.kind === "ignore") return;

  // An id this database doesn't know (another environment's gift) is left alone rather than retried forever.
  const known = "sponsorshipId" in change && change.sponsorshipId ? (await q(ctx.db.from("sponsorships").select("id").eq("id", change.sponsorshipId), "find gift")).length > 0 : true;
  if (!known) return;

  if (change.kind === "paid") {
    const sp = await sponsorshipFor(ctx, change.sponsorshipId);
    if (sp.status === "awaiting_payment") {
      await q(
        ctx.db
          .from("sponsorships")
          .update({ status: "scheduled", provider_customer_ref: change.customerRef, provider_payment_ref: change.paymentRef })
          .eq("id", sp.id as string)
          .eq("status", "awaiting_payment"),
        "mark gift paid",
      );
      Object.assign(sp, { status: "scheduled", provider_customer_ref: change.customerRef, provider_payment_ref: change.paymentRef });
      await track(ctx.db, "sponsor_paid", { sponsorship_id: sp.id, plan: sp.plan }, (sp.sponsor_id as string | null) ?? null);
    }
    if (sp.plan === "monthly" && !sp.provider_subscription_ref && ["scheduled", "active"].includes(sp.status as string)) await createRenewals(ctx, sp);
    if (sp.status === "scheduled" && !sp.delivered_at && Date.parse(sp.deliver_at as string) <= now.getTime()) await deliver(ctx, sp);
    return;
  }

  if (change.kind === "disputed") {
    const sp = (await q(ctx.db.from("sponsorships").select("*").eq("provider_payment_ref", change.paymentRef), "read disputed gift"))[0];
    if (sp) await endNow(ctx, sp, "ended");
    return;
  }

  if (change.kind === "refunded") {
    const rows = change.sponsorshipId
      ? await q(ctx.db.from("sponsorships").select("*").eq("id", change.sponsorshipId), "read refunded gift")
      : change.paymentRef
        ? await q(ctx.db.from("sponsorships").select("*").eq("provider_payment_ref", change.paymentRef), "read refunded gift")
        : [];
    const sp = rows[0];
    // Only a full refund of the gift's own payment ends it; a refunded renewal is support's call.
    if (!sp || !change.full || (change.paymentRef && change.paymentRef !== sp.provider_payment_ref)) return;
    await endNow(ctx, sp, "refunded");
    return;
  }

  const sp = await sponsorshipFor(ctx, change.sponsorshipId);
  if (sp.status === "refunded" || (sp.status === "ended" && change.kind !== "subscription")) return;

  if (change.kind === "renewal_failed") {
    if (!sp.delivered_at) return;
    await q(ctx.db.from("sponsorships").update({ status: "past_due" }).eq("id", sp.id as string).in("status", ["active"]), "mark renewal failed");
    await track(ctx.db, "sponsor_renewal_failed", { sponsorship_id: sp.id });
    await notifySponsor(ctx, sp, "S3", `S3:${sp.id}:${now.toISOString().slice(0, 10)}`, {
      subject: "Your Readli gift payment didn't go through",
      title: "Please update your card",
      paragraphs: [
        "We couldn't take this month's payment for your Readli Family gift. Your families can still listen while we try again over the next two weeks.",
        "If the payment still can't be taken, the gift ends and each family is told. Updating your card keeps everything as it is.",
      ],
      cta: "Update my card",
    });
    return;
  }

  if (change.kind === "renewed") {
    const paidThrough = later(sp.paid_through as string | null, change.paidThrough);
    await q(
      ctx.db
        .from("sponsorships")
        .update({ paid_through: paidThrough, ...(sp.status === "past_due" ? { status: "active" } : {}) })
        .eq("id", sp.id as string),
      "record renewal",
    );
    await sync(ctx, sp.id as string);
    return;
  }

  // Subscription updates. Before delivery the subscription is only waiting; the gift stays scheduled.
  const update: Row = { provider_subscription_ref: change.subscriptionRef };
  if (sp.delivered_at) {
    if (change.paidThrough) update.paid_through = later(sp.paid_through as string | null, change.paidThrough);
    if (change.state === "live") Object.assign(update, { status: "active", ends_at: null, cancel_requested_at: null });
    if (change.state === "past_due") update.status = "past_due";
    if (change.state === "canceling") Object.assign(update, { status: "canceling", ends_at: change.endsAt });
    if (change.state === "ended") Object.assign(update, { status: "ended", ends_at: change.endsAt });
  }
  await q(ctx.db.from("sponsorships").update(update).eq("id", sp.id as string), "update gift subscription");
  if (update.status === "ended" && sp.status !== "ended") await track(ctx.db, "sponsor_gift_ended", { sponsorship_id: sp.id, plan: sp.plan, reason: sp.status === "canceling" ? "canceled" : "payment_failed", delivered: true });
  if (sp.delivered_at) await sync(ctx, sp.id as string);
}

const later = (a: string | null, b: string): string => (a && Date.parse(a) > Date.parse(b) ? a : b);

/** The monthly renewals: a subscription on the saved card whose first charge is a month after delivery. */
async function createRenewals(ctx: SponsorshipContext, sp: Row): Promise<void> {
  if (!ctx.stripe) throw new Error("payments are off");
  const pi = await ctx.stripe.getPaymentIntent(sp.provider_payment_ref as string);
  const method = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id;
  const customer = (sp.provider_customer_ref as string | null) ?? (typeof pi.customer === "string" ? pi.customer : pi.customer?.id);
  if (!method || !customer) throw new Error("monthly gift payment has no saved card");
  const firstCharge = chargeSchedule("monthly", new Date(sp.deliver_at as string)).nextChargeAt!;
  const sub = await ctx.stripe.createSubscription(
    {
      customer,
      items: [{ price: await ctx.stripe.priceFor(sponsorPrice("monthly")), quantity: 1 }],
      default_payment_method: method,
      trial_end: Math.floor(firstCharge.getTime() / 1000),
      proration_behavior: "none",
      off_session: true,
      metadata: metadataOf(sp),
    },
    `sponsorship-renewals-${sp.id}`,
  );
  await q(ctx.db.from("sponsorships").update({ provider_subscription_ref: sub.id, provider_customer_ref: customer }).eq("id", sp.id as string), "save gift subscription");
  sp.provider_subscription_ref = sub.id;
}

/** Ends a gift at once (a dispute, or a full refund): both families' access stops now. */
async function endNow(ctx: SponsorshipContext, sp: Row, status: "ended" | "refunded"): Promise<void> {
  const now = clock(ctx);
  if (sp.status === status && sp.ends_at) return;
  if (sp.provider_subscription_ref && ctx.stripe) await ctx.stripe.cancelSubscription(sp.provider_subscription_ref as string).catch(() => undefined);
  await q(
    ctx.db
      .from("sponsorships")
      .update({ status, ends_at: now.toISOString(), ...(status === "refunded" ? { refund_state: "refunded" } : {}) })
      .eq("id", sp.id as string),
    "end gift",
  );
  await track(ctx.db, "sponsor_gift_ended", { sponsorship_id: sp.id, plan: sp.plan, reason: status === "refunded" ? "refund" : "dispute", delivered: Boolean(sp.delivered_at) });
  if (!sp.delivered_at) {
    await withdrawUnsent(ctx, sp.id as string);
    return;
  }
  await sync(ctx, sp.id as string);
}

async function withdrawUnsent(ctx: SponsorshipContext, id: string): Promise<void> {
  const now = clock(ctx).toISOString();
  const seats = await seatsOf(ctx, id);
  const ids = seats.filter((s) => s.status === "invited").map((s) => s.id as string);
  if (!ids.length) return;
  await q(ctx.db.from("sponsorship_invitations").update({ revoked_at: now }).in("seat_id", ids).is("accepted_at", null), "withdraw invitations");
  await q(ctx.db.from("sponsorship_seats").update({ status: "canceled" }).in("id", ids), "withdraw places");
}

/**
 * Delivers a paid gift on its day: paid access starts, and each family's invitation goes out with a
 * fresh link. Only the first run delivers; a repeat finds nothing to do.
 */
async function deliver(ctx: SponsorshipContext, sp: Row): Promise<boolean> {
  const now = clock(ctx);
  const deliverAt = new Date(sp.deliver_at as string);
  const startsAt = deliverAt < now ? deliverAt : now;
  const paidThrough = chargeSchedule(sp.plan as SponsorPlan, startsAt).paidThrough;
  const claimed = await q(
    ctx.db
      .from("sponsorships")
      .update({ status: "active", delivered_at: now.toISOString(), starts_at: startsAt.toISOString(), paid_through: later(sp.paid_through as string | null, paidThrough.toISOString()) })
      .eq("id", sp.id as string)
      .eq("status", "scheduled")
      .is("delivered_at", null)
      .select("id"),
    "deliver gift",
  );
  if (!claimed.length) return false;
  Object.assign(sp, { status: "active", delivered_at: now.toISOString(), starts_at: startsAt.toISOString() });
  const seats = (await seatsOf(ctx, sp.id as string)).filter((s) => s.status === "invited");
  for (const seat of seats) await sendInvitation(ctx, sp, seat);
  await track(ctx.db, "sponsor_gift_delivered", { sponsorship_id: sp.id, plan: sp.plan, families: seats.length, late_minutes: Math.round((now.getTime() - deliverAt.getTime()) / 60_000) });
  await notifySponsor(ctx, sp, "S2", `S2:${sp.id}`, {
    subject: "Your Readli gift has arrived",
    title: "Your families have their invitations",
    paragraphs: [
      `We've sent ${seats.map((s) => s.recipient_name as string).join(" and ")} an invitation to your Readli Family gift.`,
      "Each family adds their own children and decides who each child hears. You'll see when they join, never their children's details or what they listen to.",
    ],
    cta: "See your gift",
  });
  return true;
}

/** Issues a fresh invitation link for a place and queues the email to the family. */
async function sendInvitation(ctx: SponsorshipContext, sp: Row, seat: Row): Promise<void> {
  const now = clock(ctx);
  const inv = (await q(ctx.db.from("sponsorship_invitations").select("*").eq("seat_id", seat.id as string).is("revoked_at", null).is("accepted_at", null), "read invitation"))[0];
  if (!inv) return;
  const token = randomBytes(24).toString("base64url");
  const sentCount = Number(inv.sent_count ?? 0) + 1;
  await q(
    ctx.db
      .from("sponsorship_invitations")
      .update({ token_hash: hashInvitationToken(token), sent_at: now.toISOString(), sent_count: sentCount, expires_at: new Date(now.getTime() + SPONSORED.invitationDays * 86_400_000).toISOString() })
      .eq("id", inv.id as string),
    "issue invitation",
  );
  const from = sp.giver_display_name as string;
  const email: QueuedEmail = {
    emailId: "S1",
    dedupeKey: `S1:${inv.id}:${sentCount}`,
    to: { email: new ProviderRefCipher(ctx.secret).decrypt(inv.recipient_email_encrypted as string) },
    message: readliEmail({
      subject: `${from} gave your family Readli`,
      name: String(seat.recipient_name ?? ""),
      title: `${from} gave your family Readli`,
      paragraphs: [
        `You add your children and decide who each one hears, ${from} included. ${from} pays for the plan and doesn't see your children's profiles.`,
        ...(sp.message ? [`${from} wrote: "${sp.message as string}"`] : []),
        `This invitation is open until ${shortDate(new Date(now.getTime() + SPONSORED.invitationDays * 86_400_000))}.`,
      ],
      cta: { label: "Open your gift", url: `${ctx.base}/gift/join/${token}` },
      reason: `You're getting this because ${from} gave your family a Readli gift.`,
      preferencesUrl: `${ctx.base}/email/preferences`,
    }),
  };
  await queueEmails(ctx.db, ctx.secret, [email], now);
}

async function notifySponsor(ctx: SponsorshipContext, sp: Row, emailId: string, dedupeKey: string, m: { subject: string; title: string; paragraphs: string[]; cta: string }): Promise<void> {
  if (!sp.sponsor_id) return;
  await queueEmails(
    ctx.db,
    ctx.secret,
    [
      {
        emailId,
        dedupeKey,
        to: { userId: sp.sponsor_id as string },
        message: readliEmail({
          subject: m.subject,
          name: "",
          title: m.title,
          paragraphs: m.paragraphs,
          cta: { label: m.cta, url: `${ctx.base}${SPONSOR_HOME}?gift=${sp.id}` },
          reason: "You're getting this because you gave a Readli Family gift.",
          preferencesUrl: preferencesUrl(ctx.base, ctx.secret, sp.sponsor_id as string),
        }),
      },
    ],
    clock(ctx),
  );
}

async function notifyFamily(ctx: SponsorshipContext, householdId: string, dedupeKey: string, m: { subject: string; title: string; paragraphs: string[]; cta: string; path: string }, emailId = "S5"): Promise<void> {
  const guardians = await q(ctx.db.from("household_members").select("user_id").eq("household_id", householdId).eq("role", "guardian").is("removed_at", null), "read parents");
  await queueEmails(
    ctx.db,
    ctx.secret,
    guardians.map((g) => ({
      emailId,
      dedupeKey: `${dedupeKey}:${g.user_id}`,
      to: { userId: g.user_id as string },
      householdId,
      message: readliEmail({
        subject: m.subject,
        name: "",
        title: m.title,
        paragraphs: m.paragraphs,
        cta: { label: m.cta, url: `${ctx.base}${m.path}` },
        reason: "You're getting this because your family has a Readli Family gift.",
        preferencesUrl: preferencesUrl(ctx.base, ctx.secret, g.user_id as string),
      }),
    })),
    clock(ctx),
  );
}

export interface LifecycleReport {
  delivered: number;
  ended: number;
  synced: number;
  notices: number;
  errors: string[];
}

/**
 * The hourly run: deliver gifts whose day has come, end prepaid years that ran out, bring every
 * family's plan in line with its gift (removals, endings, credit splits), and send ending notices.
 */
export async function runSponsorships(ctx: SponsorshipContext): Promise<LifecycleReport> {
  const now = clock(ctx);
  const report: LifecycleReport = { delivered: 0, ended: 0, synced: 0, notices: 0, errors: [] };
  const attempt = async (what: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      report.errors.push(`${what}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const due = await q(ctx.db.from("sponsorships").select("*").eq("status", "scheduled").is("delivered_at", null).lte("deliver_at", now.toISOString()), "read gifts due");
  for (const sp of due) {
    await attempt(`deliver ${sp.id}`, async () => {
      if (sp.plan === "monthly" && !sp.provider_subscription_ref) await createRenewals(ctx, sp);
      if (await deliver(ctx, sp)) report.delivered += 1;
    });
  }

  const years = await q(ctx.db.from("sponsorships").select("id, paid_through").eq("plan", "annual").in("status", ["active", "past_due"]).lte("paid_through", now.toISOString()), "read years ending");
  for (const sp of years) {
    await attempt(`end ${sp.id}`, async () => {
      await q(ctx.db.from("sponsorships").update({ status: "ended", ends_at: sp.paid_through }).eq("id", sp.id as string).in("status", ["active", "past_due"]), "end year");
      await track(ctx.db, "sponsor_gift_ended", { sponsorship_id: sp.id, plan: "annual", reason: "year_ended", delivered: true });
      report.ended += 1;
    });
  }

  // Whether or not anyone has joined, the sponsor hears before a year runs out.
  const soon = new Date(now.getTime() + (SPONSORED.sponsorNoticeDays[0] + 1) * 86_400_000).toISOString();
  const yearsEnding = await q(ctx.db.from("sponsorships").select("*").eq("plan", "annual").in("status", ["active", "past_due"]).lte("paid_through", soon), "read years ending soon");
  for (const sp of yearsEnding) {
    await attempt(`year notice ${sp.id}`, async () => {
      report.notices += await yearEndNotice(ctx, sp, now);
    });
  }

  const seats = await q(ctx.db.from("sponsorship_seats").select("*").in("status", ["active", "removal_scheduled"]), "read live places");
  const ids = [...new Set(seats.map((s) => s.sponsorship_id as string))];
  const gifts = ids.length ? await q(ctx.db.from("sponsorships").select("*").in("id", ids), "read live gifts") : [];
  for (const sp of gifts) {
    await attempt(`sync ${sp.id}`, async () => {
      await rollShares(ctx, sp.id as string, now);
      await sync(ctx, sp.id as string);
      report.synced += 1;
    });
    await attempt(`notices ${sp.id}`, async () => {
      report.notices += await endingNotices(ctx, sp, seats.filter((s) => s.sponsorship_id === sp.id), now);
    });
  }
  return report;
}

/** A credit split that has taken effect becomes the place's current share. */
async function rollShares(ctx: SponsorshipContext, id: string, now: Date): Promise<void> {
  const seats = await seatsOf(ctx, id);
  for (const s of seats) {
    if (s.next_credit_share == null || !s.next_credits_from || Date.parse(s.next_credits_from as string) > now.getTime()) continue;
    await q(ctx.db.from("sponsorship_seats").update({ credit_share: s.next_credit_share, next_credit_share: null, next_credits_from: null }).eq("id", s.id as string), "apply credit split");
  }
}

const DAY_MS = 86_400_000;
const within = (end: Date, days: number, now: Date) => end.getTime() - now.getTime() <= days * DAY_MS && end.getTime() > now.getTime();

/** 30 and 7 days before a prepaid year ends, the sponsor is asked whether to give again (a new purchase). */
async function yearEndNotice(ctx: SponsorshipContext, sp: Row, now: Date): Promise<number> {
  const end = sponsorshipFacts(sp).paidThrough;
  // The nearest notice that's due; the dedupe key sends each one once.
  const days = end && [...SPONSORED.sponsorNoticeDays].sort((a, b) => a - b).find((d) => within(end, d, now));
  if (!end || !days) return 0;
  await notifySponsor(ctx, sp, "S4", `S4:${sp.id}:${days}`, {
    subject: "Your Readli Family gift year is ending",
    title: `Your gift ends on ${shortDate(new Date(end.getTime() - DAY_MS))}`,
    paragraphs: [
      "Your year of Readli for your families doesn't renew on its own, and nothing will be charged.",
      "If you'd like to keep it going, you can give another year or switch to monthly. Either is a new, separate purchase.",
    ],
    cta: "Keep the gift going",
  });
  return 1;
}

async function endingNotices(ctx: SponsorshipContext, sp: Row, seats: Row[], now: Date): Promise<number> {
  const facts = sponsorshipFacts(sp);
  const from = sp.giver_display_name as string;
  let sent = 0;
  for (const seat of seats) {
    const end = accessEnd(facts, { accessUntil: date(seat.access_until) });
    if (!end || !seat.household_id) continue;
    for (const days of [...SPONSORED.familyNoticeDays].sort((a, b) => a - b)) {
      if (!within(end, days, now)) continue;
      const last = shortDate(new Date(end.getTime() - DAY_MS));
      await notifyFamily(ctx, seat.household_id as string, `S5:${seat.id}:${end.toISOString().slice(0, 10)}:${days}`, {
        subject: `${from}'s Readli gift ends on ${last}`,
        title: `${from}'s gift ends on ${last}`,
        paragraphs: [
          `Listening pauses on ${shortDate(end)} unless you choose a plan. Your children's profiles, approvals and progress are kept.`,
          `Stories in ${from}'s voice stay with your family as long as ${from} keeps sharing their voice with you.`,
          `Continue with your own plan: $19.99 a month, starting ${shortDate(end)}, so there's no gap and no double charge.`,
        ],
        cta: "Choose a plan",
        path: "/family/settings/plan",
      });
      sent += 1;
      break;
    }
  }
  return sent;
}

/** Cancels a gift: a full refund before delivery, or no more renewals after it. */
export async function cancelGift(ctx: SponsorshipContext, sponsorId: string, id: string): Promise<CancelOutcome> {
  const sp = await sponsorshipFor(ctx, id, sponsorId);
  const outcome = cancelOutcome(sponsorshipFacts(sp));
  if (outcome.kind !== "nothing_to_cancel") await track(ctx.db, "sponsor_canceled", { sponsorship_id: id, plan: sp.plan, outcome: outcome.kind }, sponsorId);
  if (outcome.kind === "refund_before_delivery") {
    if (!ctx.stripe) throw new SponsorshipError(503, "payments_off", "Payments are switched off. Please contact support.");
    if (sp.provider_subscription_ref) await ctx.stripe.cancelSubscription(sp.provider_subscription_ref as string);
    await ctx.stripe.refundPayment(sp.provider_payment_ref as string, metadataOf(sp), `sponsorship-refund-${id}`);
    await q(
      ctx.db.from("sponsorships").update({ status: "refunded", refund_state: "pending", cancel_requested_at: clock(ctx).toISOString() }).eq("id", id).eq("status", "scheduled").is("delivered_at", null),
      "cancel gift",
    );
    await withdrawUnsent(ctx, id);
    return outcome;
  }
  if (outcome.kind === "stop_renewal") {
    if (!ctx.stripe || !sp.provider_subscription_ref) throw new SponsorshipError(503, "payments_off", "Payments are switched off. Please contact support.");
    await ctx.stripe.updateSubscription(sp.provider_subscription_ref as string, { cancel_at_period_end: true }, `sponsorship-stop-${id}`);
    await q(
      ctx.db.from("sponsorships").update({ status: "canceling", ends_at: outcome.endsAt.toISOString(), cancel_requested_at: clock(ctx).toISOString() }).eq("id", id),
      "stop renewals",
    );
    await sync(ctx, id);
  }
  return outcome;
}

/** Moves the delivery day before the gift arrives. The monthly renewal date moves with it. */
export async function changeDelivery(ctx: SponsorshipContext, sponsorId: string, id: string, day: unknown, timeZone: unknown): Promise<Date> {
  const sp = await sponsorshipFor(ctx, id, sponsorId);
  if (sp.status !== "scheduled" || sp.delivered_at) throw new SponsorshipError(409, "already_delivered", "This gift has already arrived.");
  const now = clock(ctx);
  const at = day === "now" ? now : zonedTime(String(day ?? ""), typeof timeZone === "string" ? timeZone : "UTC", SPONSORED.deliveryHour);
  if (!at || now.getTime() - at.getTime() > 86_400_000 || at.getTime() - now.getTime() > SPONSORED.maxDeliveryDays * 86_400_000) {
    throw new SponsorshipError(400, "bad_date", `Choose today or a date within ${SPONSORED.maxDeliveryDays} days.`);
  }
  const deliverAt = at < now ? now : at;
  if (sp.provider_subscription_ref && ctx.stripe) {
    const firstCharge = chargeSchedule("monthly", deliverAt).nextChargeAt!;
    await ctx.stripe.updateSubscription(sp.provider_subscription_ref as string, { trial_end: Math.floor(firstCharge.getTime() / 1000), proration_behavior: "none" });
  }
  await q(ctx.db.from("sponsorships").update({ deliver_at: deliverAt.toISOString() }).eq("id", id).eq("status", "scheduled"), "move delivery");
  return deliverAt;
}

const placeOf = (seats: Row[], seat: number) => seats.find((s) => s.seat === seat && LIVE_SEATS.includes(s.status as SeatStatus));

/**
 * Removes a family from the gift. It takes effect at the end of the current gift month (the date the
 * confirmation names), and the sponsor must have confirmed. A family that hasn't joined yet is
 * withdrawn at once.
 */
export async function removeFamily(ctx: SponsorshipContext, sponsorId: string, id: string, seatNumber: number, confirmed: boolean): Promise<{ accessUntil: Date }> {
  if (!confirmed) throw new SponsorshipError(400, "confirm_required", "Please confirm you understand when their access ends.");
  const sp = await sponsorshipFor(ctx, id, sponsorId);
  const seat = placeOf(await seatsOf(ctx, id), seatNumber);
  if (!seat || seat.status === "removal_scheduled") throw new SponsorshipError(404, "no_family", "There's no family in that place to remove.");
  const now = clock(ctx);
  const until = removalDate(sponsorshipFacts(sp), { status: seat.status as SeatStatus }, now);
  if (seat.status === "invited") {
    await q(ctx.db.from("sponsorship_invitations").update({ revoked_at: now.toISOString() }).eq("seat_id", seat.id as string).is("accepted_at", null), "withdraw invitation");
    await q(ctx.db.from("sponsorship_seats").update({ status: "canceled", removal_requested_at: now.toISOString(), access_until: now.toISOString() }).eq("id", seat.id as string), "withdraw place");
    await track(ctx.db, "sponsor_family_removed", { sponsorship_id: id, seat: seatNumber, joined: false }, sponsorId);
    return { accessUntil: now };
  }
  await q(
    ctx.db.from("sponsorship_seats").update({ status: "removal_scheduled", removal_requested_at: now.toISOString(), access_until: until.toISOString() }).eq("id", seat.id as string).eq("status", "active"),
    "schedule removal",
  );
  await sync(ctx, id);
  await track(ctx.db, "sponsor_family_removed", { sponsorship_id: id, seat: seatNumber, joined: true, household_id: seat.household_id }, sponsorId);
  if (seat.household_id) {
    const from = sp.giver_display_name as string;
    await notifyFamily(ctx, seat.household_id as string, `S5:${seat.id}:removed`, {
      subject: `${from}'s Readli gift for your family ends on ${shortDate(new Date(until.getTime() - 86_400_000))}`,
      title: `Your gift ends on ${shortDate(new Date(until.getTime() - 86_400_000))}`,
      paragraphs: [
        `${from} has changed who their Readli gift covers. Your family keeps Readli until ${shortDate(new Date(until.getTime() - 86_400_000))}.`,
        "After that, listening pauses unless you choose your own plan. Your children's profiles, approvals and progress are kept.",
        `Stories in ${from}'s voice stay with your family as long as ${from} keeps sharing their voice with you.`,
      ],
      cta: "Choose a plan",
      path: "/family/settings/plan",
    });
  }
  return { accessUntil: until };
}

/** Takes back a scheduled removal before it happens. */
export async function undoRemoval(ctx: SponsorshipContext, sponsorId: string, id: string, seatNumber: number): Promise<void> {
  await sponsorshipFor(ctx, id, sponsorId);
  const seat = placeOf(await seatsOf(ctx, id), seatNumber);
  if (!seat || seat.status !== "removal_scheduled" || Date.parse(seat.access_until as string) <= clock(ctx).getTime()) {
    throw new SponsorshipError(409, "nothing_to_undo", "There's no removal to undo.");
  }
  await q(ctx.db.from("sponsorship_seats").update({ status: "active", removal_requested_at: null, access_until: null }).eq("id", seat.id as string), "undo removal");
  await sync(ctx, id);
  await track(ctx.db, "sponsor_removal_undone", { sponsorship_id: id, seat: seatNumber }, sponsorId);
}

/** Offers a free place to another family, at most twice in any 12 months. */
export async function offerPlace(ctx: SponsorshipContext, sponsorId: string, id: string, seatNumber: number, recipient: Recipient): Promise<void> {
  const sp = await sponsorshipFor(ctx, id, sponsorId);
  if (!["active", "past_due"].includes(sp.status as string) || !sp.delivered_at) throw new SponsorshipError(409, "not_active", "You can offer a place once your gift has arrived.");
  if (seatNumber < 1 || seatNumber > SPONSORED.households) throw new SponsorshipError(400, "bad_place", "Pick a place.");
  const seats = await seatsOf(ctx, id);
  if (placeOf(seats, seatNumber)) throw new SponsorshipError(409, "place_taken", "That place is already taken.");
  const delivered = Date.parse(sp.delivered_at as string);
  const offered = seats.map((s) => new Date(s.created_at as string)).filter((d) => d.getTime() > delivered);
  if (!canOfferPlace(offered, clock(ctx))) throw new SponsorshipError(409, "too_many_changes", `You can change families up to ${SPONSORED.placeChangesPerYear} times in 12 months.`);
  if (recipient.shareVoice && !sp.consent_receipt_id) throw new SponsorshipError(400, "consent_required", "Please agree to share your voice with this family.");
  const other = seats.filter((s) => LIVE_SEATS.includes(s.status as SeatStatus)).reduce((n, s) => n + Number(s.next_credit_share ?? s.credit_share ?? 0), 0);
  const share = Math.max(SPONSORED.minShare, Math.min(SPONSORED.startingShare, SPONSORED.monthlyCredits - other));
  const now = clock(ctx);
  const { seatId } = await addPlace(ctx, id, seatNumber, recipient, new Date(now.getTime() + SPONSORED.invitationDays * 86_400_000), share);
  await sendInvitation(ctx, sp, { id: seatId, recipient_name: recipient.name });
  await track(ctx.db, "sponsor_place_offered", { sponsorship_id: id, seat: seatNumber, shares_voice: recipient.shareVoice }, sponsorId);
}

/** A new credit split, from the next gift month (straight away if the gift hasn't arrived yet). */
export async function rebalanceCredits(ctx: SponsorshipContext, sponsorId: string, id: string, shares: Record<number, unknown>): Promise<{ from: Date | null }> {
  const sp = await sponsorshipFor(ctx, id, sponsorId);
  const now = clock(ctx);
  await rollShares(ctx, id, now);
  const live = (await seatsOf(ctx, id)).filter((s) => LIVE_SEATS.includes(s.status as SeatStatus));
  const split = creditSplit(shares, live.map((s) => s.seat as number));
  const facts = sponsorshipFacts(sp);
  const from = facts.startsAt ? giftMonth(facts.startsAt, now).end : null;
  for (const s of live) {
    const share = split[s.seat as number]!;
    const values = from ? { next_credit_share: share, next_credits_from: from.toISOString() } : { credit_share: share };
    await q(ctx.db.from("sponsorship_seats").update(values).eq("id", s.id as string), "save credit split");
    // The family hears before the month it changes in.
    if (from && s.household_id && share !== Number(s.credit_share)) {
      const giver = sp.giver_display_name as string;
      await notifyFamily(
        ctx,
        s.household_id as string,
        `S7:${s.id}:${from.toISOString().slice(0, 10)}:${share}`,
        {
          subject: `Your story credits from ${giver}'s gift from ${shortDate(from)}`,
          title: `From ${shortDate(from)}, your family has ${share} story credits a month from ${giver}'s gift`,
          paragraphs: ["This month stays as it is. Credits you bought yourselves aren't affected."],
          cta: "See your credits",
          path: "/family/settings/plan",
        },
        "S7",
      );
    }
  }
  if (facts.deliveredAt) await sync(ctx, id);
  await track(ctx.db, "sponsor_credits_rebalanced", { sponsorship_id: id, shares: split }, sponsorId);
  return { from };
}

/**
 * A family asks the sponsor for more credits next month. The sponsor hears the family's name only, never
 * which story; once a gift month per family.
 */
export async function askForCredits(ctx: SponsorshipContext, householdId: string, userId: string): Promise<{ asked: boolean }> {
  const seat = (await q(ctx.db.from("sponsorship_seats").select("*").eq("household_id", householdId).in("status", ["active"]), "read gift place"))[0];
  if (!seat) throw new SponsorshipError(404, "no_gift", "Your family doesn't have a gift right now.");
  const sp = await sponsorshipFor(ctx, seat.sponsorship_id as string);
  const facts = sponsorshipFacts(sp);
  if (!facts.startsAt) throw new SponsorshipError(409, "not_active", "Your gift hasn't started yet.");
  const month = giftMonth(facts.startsAt, clock(ctx));
  const queued = await queueEmails(
    ctx.db,
    ctx.secret,
    sp.sponsor_id
      ? [
          {
            emailId: "S6",
            dedupeKey: `S6:${seat.id}:${month.start.toISOString().slice(0, 10)}`,
            to: { userId: sp.sponsor_id as string },
            message: readliEmail({
              subject: `${seat.recipient_name as string} would love a few more story credits`,
              name: "",
              title: `${seat.recipient_name as string} asked for more story credits`,
              paragraphs: [
                `They've used most of this month's share of your gift. If you'd like, you can give them more from ${shortDate(month.end)} by moving credits between your families.`,
                "You don't need to do anything. Their credits refresh on their own each gift month.",
              ],
              cta: { label: "See your gift", url: `${ctx.base}${SPONSOR_HOME}?gift=${sp.id}` },
              reason: "You're getting this because you gave a Readli Family gift.",
              preferencesUrl: preferencesUrl(ctx.base, ctx.secret, sp.sponsor_id as string),
            }),
          },
        ]
      : [],
    clock(ctx),
  );
  if (queued.length) await track(ctx.db, "sponsored_credit_ask", { sponsorship_id: sp.id, seat: seat.seat }, userId);
  return { asked: queued.length > 0 };
}

export const ACCEPT_MESSAGES: Record<string, string> = {
  invalid: "This gift link isn't valid any more. Ask the person who sent it to send a new one.",
  expired: "This gift link has expired. Ask the person who sent it to send a new one.",
  not_ready: "This gift isn't ready to open yet.",
  self: "You can't join a gift you gave. Share the link with the family it's for.",
  not_guardian: "Only a parent or guardian can add the gift to their family.",
  already_sponsored: "Your family already has a Readli gift.",
  has_plan: "Your family already has Readli Family. You can join this gift when your current plan ends.",
};

/** A parent adds the gift to their own family. Their approvals and Kids Mode stay theirs. */
export async function joinGift(ctx: SponsorshipContext, token: string, userId: string, householdId: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return "invalid";
  const result = String(await q<unknown>(ctx.db.rpc("accept_sponsored_invitation", { p_token_hash: hashInvitationToken(token), p_user: userId, p_household: householdId }), "join gift"));
  // Recipient families are activations, never paying customers.
  await track(ctx.db, result === "accepted" ? "sponsored_family_joined" : "sponsored_join_refused", { household_id: householdId, result }, userId);
  return result;
}

export { SponsorshipError };
