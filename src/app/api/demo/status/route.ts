import { NextResponse } from "next/server";
import { demoEmailOn } from "@/lib/email/guest-demo";
import { emailSecret, readliMailer } from "@/lib/email/send";
import { accountDb } from "@/lib/family/account-store";
import { currentGuest, effectiveMode, guestDemoDeps, previewCounts } from "@/lib/server/guest-demo";

export const dynamic = "force-dynamic";

/** Whether voice previews are available, this guest's remaining previews, and whether a demo can be emailed. */
export async function GET() {
  const deps = guestDemoDeps();
  const mode = await effectiveMode(deps).catch(() => "off" as const);
  const guest = deps && mode !== "off" ? await currentGuest(deps).catch(() => null) : null;
  const demoEmail = mode !== "off" && (await demoEmailOn(accountDb(), Boolean(emailSecret() && readliMailer())));
  return NextResponse.json(
    { mode, demoEmail, guest: guest ? { ...previewCounts(guest), hasVoice: guest.hasVoice, expiresAt: guest.expiresAt } : null },
    { headers: { "cache-control": "no-store" } },
  );
}
