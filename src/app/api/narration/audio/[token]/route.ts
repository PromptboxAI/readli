import { withFamily } from "@/lib/family/http";
import { playbackKey } from "@/lib/family/session";
import { readPlayback } from "@/lib/narration/narration";
import { audioResponse, parseRange } from "@/lib/server/range";

export const dynamic = "force-dynamic";

/**
 * Stored narration for a signed, expiring URL: one sentence or a whole chapter track. Permissions are
 * re-checked on every request, including each byte range a phone asks for while it plays.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const range = parseRange(req.headers.get("range"));
  return withFamily(async ({ store, actor }) => audioResponse(await readPlayback(store, actor, token, playbackKey(), Date.now(), range ?? undefined), range));
}
