import { NextResponse } from "next/server";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody, withFamily } from "@/lib/family/http";
import { switchPlanTier } from "@/lib/family/plan-change";
import { guardianHousehold } from "@/lib/family/service";
import { writeAudit } from "@/lib/lifecycle/db";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * { tier: "family" | "archive" }: moves the family between Readli Family and the Family Archive on a
 * tester plan or in the preview. A Stripe subscription answers use_billing_portal: the change happens
 * in the billing portal and arrives through the webhook.
 */
export async function POST(req: Request) {
  const { tier } = await jsonBody(req);
  if (tier !== "family" && tier !== "archive") return fail(400, "bad_request", "Choose Readli Family or the Family Archive.");
  return withFamily(async ({ store, actor, session }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId || actor.kind !== "adult") return fail(403, "not_guardian", "Only a parent or guardian can change your family's plan.");
    const result = await switchPlanTier(store, actor, householdId, tier);
    const db = session.account ? accountDb() : null;
    if (db && result.from !== result.tier) {
      await writeAudit(db, [{ actor: actor.adultId, action: "plan_changed", householdId, detail: { from: result.from, to: result.tier, stopped_jobs: result.stoppedJobs, via: "readli" } }]).catch((err) =>
        console.error("plan change log failed", err),
      );
    }
    return NextResponse.json(result);
  });
}
