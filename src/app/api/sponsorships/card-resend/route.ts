import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { fail } from "@/lib/server/http";
import { allow, clientAddress } from "@/lib/server/rate-limit";
import { SponsorshipError } from "@/lib/sponsorship/rules";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { resendFromCard } from "@/lib/sponsorship/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * { id, seat }: sends a gift's invitation again, from the page the printed card opens. No sign-in, since
 * the family may not have an account yet; it only ever emails the address the giver entered.
 */
export async function POST(req: Request) {
  const body = await jsonBody(req);
  const id = String(body.id ?? "");
  const seat = Number(body.seat);
  if (!UUID.test(id) || !Number.isInteger(seat)) return fail(400, "bad_request", "That gift link isn't complete.");
  if (!allow(`card-resend:${clientAddress(req)}`, 5, 60 * 60_000)) return fail(429, "slow_down", "Please wait a little while before asking again.");
  const ctx = await sponsorshipContext();
  if (!ctx) return fail(404, "not_found", "Not found.");
  try {
    await resendFromCard(ctx, id, seat);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SponsorshipError) return fail(err.status, err.code, err.message);
    throw err;
  }
}
