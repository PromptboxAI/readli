import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { exitWithPin } from "@/lib/family/devices";
import { PermissionError } from "@/lib/family/service";
import { currentDevice, endKidsDevice } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Leaves Readli Kids on this device with the family's grown-up PIN. This ends the device; it signs
 * nobody in, so a grown-up then signs in as usual to use their account here.
 */
export async function POST(req: Request) {
  const found = await currentDevice();
  if (!found) {
    await endKidsDevice();
    return NextResponse.json({ ok: true });
  }
  const { pin } = await jsonBody(req);
  try {
    await exitWithPin(found.registry, found.device, pin);
  } catch (err) {
    if (err instanceof PermissionError) return fail(err.status, err.code, err.userMessage, err.details);
    throw err;
  }
  await endKidsDevice();
  return NextResponse.json({ ok: true });
}
