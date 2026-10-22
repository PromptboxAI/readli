import { NextResponse } from "next/server";
import { cleanupExpiredGuests, currentGuest, effectiveMode, guestDemoDeps, previewCounts, startGuest } from "@/lib/server/guest-demo";
import { fail, PREVIEWS_OFF } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Starts a guest preview session after the two consent declarations (PRD F-01, Amendment 001 §B). */
export async function POST(req: Request) {
  const deps = guestDemoDeps();
  if ((await effectiveMode(deps)) === "off" || !deps) return fail(503, "previews_off", PREVIEWS_OFF);

  const body = (await req.json().catch(() => ({}))) as { adultOwner?: unknown; processing?: unknown };
  if (body.adultOwner !== true || body.processing !== true) {
    return fail(400, "consent_required", "Please confirm both statements before recording.");
  }

  // Opportunistic cleanup removes expired demos between daily cron runs, well within the 48-hour promise.
  await cleanupExpiredGuests(deps, 5).catch(() => undefined);

  const session = (await currentGuest(deps)) ?? (await startGuest(deps));
  return NextResponse.json({ ...previewCounts(session), expiresAt: session.expiresAt }, { headers: { "cache-control": "no-store" } });
}
