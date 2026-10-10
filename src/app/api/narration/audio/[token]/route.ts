import { withFamily } from "@/lib/family/http";
import { playbackKey } from "@/lib/family/session";
import { readPlayback } from "@/lib/narration/narration";

export const dynamic = "force-dynamic";

/** Stored narration for a signed, expiring URL. Permissions are re-checked on every request. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withFamily(async ({ store, actor }) => {
    const { audio, contentType } = await readPlayback(store, actor, token, playbackKey());
    return new Response(audio, { headers: { "content-type": contentType, "cache-control": "private, no-store" } });
  });
}
