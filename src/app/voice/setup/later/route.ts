import { VOICE_SETUP_LATER_COOKIE } from "@/lib/family/setup-cookie";
import { leaveSetup } from "@/lib/family/setup-later";

export const dynamic = "force-dynamic";

/** A storyteller's "Finish later": My Voice stops sending this browser back into setup until it's next opened. */
export async function GET(req: Request) {
  return leaveSetup(req, VOICE_SETUP_LATER_COOKIE, "/voice");
}
