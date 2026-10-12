import { NextResponse } from "next/server";
import { accountDb } from "@/lib/family/account-store";
import { deliverDueGifts, mailerGiftSender } from "@/lib/gifting/delivery";
import { invitationMailer } from "@/lib/invitations/email";
import { invitationSecret } from "@/lib/invitations/server";
import { serverConfig } from "@/lib/server/config";
import { sameHash } from "@/lib/server/guest-token";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Emails paid gifts whose delivery date has come. Vercel Cron calls this daily with CRON_SECRET. */
export async function GET(req: Request) {
  const config = serverConfig();
  const auth = req.headers.get("authorization") ?? "";
  if (!config.cronSecret || !sameHash(auth, `Bearer ${config.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = accountDb();
  const mailer = invitationMailer();
  const secret = invitationSecret();
  if (!db || !mailer || !secret) return NextResponse.json({ sent: 0, failed: 0, held: 0, skipped: "not configured" });
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://readli.ai";
  return NextResponse.json(await deliverDueGifts(db, mailerGiftSender(db, mailer, origin, secret)));
}
