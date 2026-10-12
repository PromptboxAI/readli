import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/supabase";
import { serverConfig } from "@/lib/server/config";
import { currentGuest, guestDemoDeps } from "@/lib/server/guest-demo";
import { fail } from "@/lib/server/http";
import { CLIENT_VOICE_EVENTS, cleanProperties, recordVoiceEvent, type VoiceEventName } from "@/lib/server/voice-analytics";

export const dynamic = "force-dynamic";

/** Recording-flow events from the browser (retakes, warnings, tips, "doesn't sound like me"). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: unknown; properties?: unknown } | null;
  const name = CLIENT_VOICE_EVENTS.find((n) => n === body?.name) as VoiceEventName | undefined;
  if (!name) return fail(400, "unknown_event", "Unknown event.");

  const config = serverConfig();
  const deps = guestDemoDeps(config);
  const guest = deps ? await currentGuest(deps).catch(() => null) : null;
  const user = guest ? null : await currentUser().catch(() => null);
  await recordVoiceEvent(config, { name, guestSessionId: guest?.id ?? null, userId: user?.id ?? null, properties: cleanProperties(body?.properties) });
  return new NextResponse(null, { status: 204 });
}
