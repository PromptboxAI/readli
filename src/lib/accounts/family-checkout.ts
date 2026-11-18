import { newMetaEventId, rememberCheckout, trackMeta } from "@/lib/marketing/meta-pixel";
import { trackGaEvent } from "@/lib/marketing/google-analytics";

export type FamilyBilling = "monthly" | "annual";

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  } & Record<string, unknown>;
  if (!res.ok) throw new Error(json.error?.message ?? "Checkout couldn't start. Please try again.");
  return json;
}

/**
 * In the browser: start the signed-in grown-up's family (named, or with a stand-in name that setup asks
 * about once paid), then open Stripe checkout for the plan chosen. `from` picks where Stripe comes back to
 * when checkout is canceled: Family signup, or the welcome's plan page. `fromTry` keeps a canceled Family
 * signup pointing back to the /try stories, so the guest can still switch plans without recording again.
 */
export async function startFamilyCheckout(opts: { billing: FamilyBilling; cents: number; familyName: string | null; from: "signup" | "start"; fromTry?: { cleanUp: boolean } }): Promise<void> {
  await post("/api/family/household", opts.familyName ? { name: opts.familyName } : { provisional: true });
  const item = opts.billing === "annual" ? "family_annual" : "family_monthly";
  // The server reports the same checkout with this id once Stripe's session exists.
  const eventId = newMetaEventId();
  trackMeta("InitiateCheckout", { value: opts.cents / 100, currency: "USD", content_name: item }, eventId);
  trackGaEvent("begin_checkout", { value: opts.cents / 100, currency: "USD", plan: item });
  rememberCheckout(opts.cents);
  const { url } = await post("/api/billing/checkout", {
    item,
    from: opts.from,
    ...(opts.fromTry ? { fromTry: true, cleanUp: opts.fromTry.cleanUp } : {}),
    ...(eventId ? { metaEventId: eventId } : {}),
  });
  if (typeof url !== "string") throw new Error("Checkout couldn't start. Please try again.");
  window.location.assign(url);
}
