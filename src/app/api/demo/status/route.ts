import { NextResponse } from "next/server";
import { currentGuest, effectiveMode, guestDemoDeps, previewsLeft } from "@/lib/server/guest-demo";

export const dynamic = "force-dynamic";

/** Whether voice previews are available, and this guest's remaining previews. */
export async function GET() {
  const deps = guestDemoDeps();
  const mode = await effectiveMode(deps).catch(() => "off" as const);
  const guest = deps && mode !== "off" ? await currentGuest(deps).catch(() => null) : null;
  return NextResponse.json(
    { mode, guest: guest ? { previewsLeft: previewsLeft(guest), hasVoice: guest.hasVoice, expiresAt: guest.expiresAt } : null },
    { headers: { "cache-control": "no-store" } },
  );
}
