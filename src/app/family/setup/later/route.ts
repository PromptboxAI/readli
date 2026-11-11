import { SETUP_LATER_COOKIE } from "@/lib/family/setup-cookie";
import { leaveSetup } from "@/lib/family/setup-later";

export const dynamic = "force-dynamic";

/** "Finish setting up later": Family Home stops sending this browser back into setup until it's next opened. */
export function GET(req: Request) {
  return leaveSetup(req, SETUP_LATER_COOKIE, "/home");
}
