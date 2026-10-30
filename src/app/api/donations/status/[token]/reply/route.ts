import { NextResponse } from "next/server";
import { formFile, text, withDonations } from "@/lib/donations/http";
import { applicantReply } from "@/lib/donations/server";
import { fail } from "@/lib/server/http";
import { allow, clientAddress } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The applicant answers "more information needed": a note and an optional document. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!allow(`donation-reply:${clientAddress(req)}`, 10, 10 * 60_000)) return fail(429, "slow_down", "Please wait a few minutes and try again.");
  const { token } = await params;
  const form = await req.formData().catch(() => null);
  if (!form) return fail(400, "bad_form", "Write a reply or attach a document.");
  const file = await formFile(form, "document");
  return withDonations(async (ctx) => {
    await applicantReply(ctx, token, text(form, "reply"), file);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  });
}
