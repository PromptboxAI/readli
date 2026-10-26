import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";
import { fail } from "@/lib/server/http";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { SponsorshipError } from "@/lib/sponsorship/rules";
import { askForCredits } from "@/lib/sponsorship/server";

export const dynamic = "force-dynamic";

/** A parent asks the family's sponsor for more credits next month. The sponsor never sees which story. */
export async function POST() {
  const ctx = await sponsorshipContext();
  if (!ctx) return fail(404, "not_found", "Not found.");
  return withFamily(async ({ store, actor }) => {
    if (actor.kind !== "adult") return fail(403, "not_guardian", "Only a parent or guardian can ask.");
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can ask.");
    try {
      return NextResponse.json(await askForCredits(ctx, householdId, actor.adultId));
    } catch (err) {
      if (err instanceof SponsorshipError) return fail(err.status, err.code, err.message);
      throw err;
    }
  });
}
