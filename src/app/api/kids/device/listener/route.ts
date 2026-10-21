import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { chooseListener } from "@/lib/family/devices";
import { PermissionError } from "@/lib/family/service";
import { currentDevice } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** "Who's listening?" on a kids device: one of the kids the parent put on it, or null for the picker. */
export async function POST(req: Request) {
  const found = await currentDevice();
  if (!found) return fail(401, "device_ended", "Readli Kids isn't set up on this device. Ask a grown-up.");
  const { childId } = await jsonBody(req);
  try {
    await chooseListener(found.registry, found.device, typeof childId === "string" ? childId : null);
  } catch (err) {
    if (err instanceof PermissionError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
  return NextResponse.json({ ok: true });
}
