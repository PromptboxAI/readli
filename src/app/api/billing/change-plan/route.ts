import { NextResponse } from "next/server";
import { catalogItem } from "@/lib/billing/catalog";
import { billingConfig } from "@/lib/billing/config";
import { currentTarget, describeChange, planChange, previewParams, schedulePhases, type ChangeTiming, type PlanChangeRequest, type PlanTarget } from "@/lib/billing/plan-change";
import { effectivePlan } from "@/lib/billing/price-settings";
import { StripeApi, StripeError, type StripeSubscription } from "@/lib/billing/stripe-api";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody, withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";
import { writeAudit } from "@/lib/lifecycle/db";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGETS: PlanTarget[] = ["family_monthly", "family_annual", "archive_monthly"];

const REFUSALS = {
  no_plan_item: [409, "We couldn't find your Readli plan in billing. Please contact admin@readli.ai."],
  same_plan: [409, "You're already on that plan."],
  not_active: [409, "Your plan isn't active, so it can't be changed. Start a new plan instead."],
  has_slots: [409, "Extra storyteller slots bill monthly. Remove them in billing first, then switch to yearly."],
  no_period_end: [409, "We couldn't find when your current plan renews. Please contact admin@readli.ai."],
  trial_end_unconfirmed: [409, "Starting your paid plan now ends your free trial today. Please confirm that first."],
} as const;

type Loaded = { stripe: StripeApi; sub: StripeSubscription; householdId: string; actor: string; db: NonNullable<ReturnType<typeof accountDb>> };

/** The household's Stripe subscription, for a parent or guardian of that household. */
async function withSubscription(run: (l: Loaded) => Promise<Response>): Promise<Response> {
  const config = billingConfig();
  if (config.mode === "off") return fail(404, "not_found", "Not found.");
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId || actor?.kind !== "adult") return fail(403, "not_guardian", "Only a parent or guardian can change your family's plan.");
    const db = accountDb();
    if (!db) return fail(503, "no_account", "Sign in with a Readli account to manage billing.");
    const { data: ent } = await db
      .from("household_entitlements")
      .select("provider_subscription_ref")
      .eq("household_id", householdId)
      .eq("source", "subscription")
      .eq("status", "active")
      .not("provider_subscription_ref", "is", null)
      .limit(1)
      .maybeSingle();
    if (!ent?.provider_subscription_ref) return fail(404, "no_subscription", "Your family doesn't have a paid plan to change.");
    const stripe = new StripeApi(config);
    try {
      const sub = await stripe.subscription(ent.provider_subscription_ref as string);
      if (sub.metadata?.household_id && sub.metadata.household_id !== householdId) return fail(403, "not_yours", "That plan belongs to another family.");
      return await run({ stripe, sub, householdId, actor: actor.adultId, db });
    } catch (err) {
      if (err instanceof StripeError) return fail(402, "stripe_error", "Billing couldn't make that change. Please check your card in billing and try again.");
      throw err;
    }
  });
}

const iso = (s: number) => new Date(s * 1000).toISOString();

/** The plan change already scheduled (a downgrade at the end of the paid term or trial), if any. */
export async function GET() {
  return withSubscription(async ({ stripe, sub }) => {
    let scheduled: { to: PlanTarget | null; effectiveAt: string } | null = null;
    if (sub.schedule) {
      const schedule = await stripe.schedule(sub.schedule);
      const next = schedule.phases.find((p) => p.start_date > Math.floor(Date.now() / 1000));
      const to = next?.metadata?.last_plan_change?.split("->")[1] as PlanTarget | undefined;
      if (next) scheduled = { to: to && TARGETS.includes(to) ? to : null, effectiveAt: iso(next.start_date) };
    }
    return NextResponse.json(
      { current: currentTarget(sub), trialEndsAt: sub.status === "trialing" && sub.trial_end ? iso(sub.trial_end) : null, scheduled },
      { headers: { "cache-control": "no-store" } },
    );
  });
}

/**
 * { to, timing?, endTrial?, step: "preview" | "confirm", trialEndConfirmed?, prorationDate? }.
 * "preview" changes nothing and returns the effective date, any adjustment and the resulting amount;
 * "confirm" asks Stripe to make the change. The household's plan changes only when Stripe confirms it
 * through the webhook.
 */
export async function POST(req: Request) {
  const body = await jsonBody(req);
  const to = body.to as PlanTarget;
  if (!TARGETS.includes(to)) return fail(400, "bad_request", "Choose a plan.");
  const step = body.step === "confirm" ? "confirm" : "preview";
  const request: PlanChangeRequest = {
    to,
    timing: body.timing === "now" ? "now" : ("period_end" as ChangeTiming),
    endTrial: body.endTrial === true,
    trialEndConfirmed: body.trialEndConfirmed === true,
  };
  const pinned = typeof body.prorationDate === "number" && Number.isInteger(body.prorationDate) ? body.prorationDate : null;
  return withSubscription(async ({ stripe, sub, householdId, actor, db }) => {
    const plan = await effectivePlan(db);
    const item = catalogItem(plan, to)!;
    const price = await stripe.priceFor(item);
    const now = Math.floor(Date.now() / 1000);
    // The preview is shown before the customer confirms ending a trial, so it doesn't need that confirmation yet.
    const change = planChange(sub, step === "preview" ? { ...request, trialEndConfirmed: true } : request, price, now);
    if (!change.ok) {
      const [status, message] = REFUSALS[change.reason];
      return fail(status, change.reason, message);
    }

    if (step === "preview") {
      const prorationDate = change.kind === "now" && !change.keepsTrial ? now : null;
      const invoice = change.kind === "now" && !change.keepsTrial ? await stripe.previewInvoice(previewParams(sub, change, prorationDate!)) : null;
      return NextResponse.json({ preview: describeChange(sub, change, item.amountCents, invoice, prorationDate, now) }, { headers: { "cache-control": "no-store" } });
    }

    // A retried click within the same minute reuses the key, so Stripe applies the change once.
    const key = `plan-change:${sub.id}:${change.from}->${change.to}:${change.kind}:${Math.floor(Date.now() / 60_000)}`;
    let pending = false;
    if (change.kind === "scheduled") {
      const schedule = await stripe.scheduleFor(sub, `${key}:schedule`);
      await stripe.updateSchedule(schedule.id, schedulePhases(schedule, change), `${key}:phases`);
    } else {
      // A change made now replaces any downgrade scheduled earlier.
      if (sub.schedule) await stripe.releaseSchedule(sub.schedule);
      const params = pinned && change.params.proration_behavior !== "none" ? { ...change.params, proration_date: pinned } : change.params;
      const updated = await stripe.updateSubscription(sub.id, params, key);
      pending = Boolean(updated.pending_update);
    }
    await writeAudit(db, [
      {
        actor,
        action: "plan_change_requested",
        householdId,
        detail: { from: change.from, to: change.to, kind: change.kind, effective_at: iso(change.effectiveAt), keeps_trial: change.keepsTrial, ends_trial: change.endsTrial, pending },
      },
    ]).catch((err) => console.error("plan change log failed", err));
    return NextResponse.json({ from: change.from, to: change.to, kind: change.kind, effectiveAt: iso(change.effectiveAt), pending });
  });
}

/** Cancels a scheduled plan change: the current plan carries on as it is. */
export async function DELETE() {
  return withSubscription(async ({ stripe, sub, householdId, actor, db }) => {
    if (!sub.schedule) return fail(404, "nothing_scheduled", "There's no plan change scheduled.");
    await stripe.releaseSchedule(sub.schedule);
    await writeAudit(db, [{ actor, action: "plan_change_requested", householdId, detail: { canceled_scheduled_change: true } }]).catch((err) =>
      console.error("plan change log failed", err),
    );
    return NextResponse.json({ scheduled: null });
  });
}
