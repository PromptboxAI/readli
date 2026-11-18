import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { checkDownloads } from "@/lib/narration/narration";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 100;

/**
 * { items: [{ voiceId, bookSlug, revision }] }: which of this device's downloads the child may still
 * hear, each with a fresh offline week. The device removes the rest.
 */
export async function POST(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { items } = await jsonBody(req);
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return fail(400, "bad_request", "That list of downloads isn't right.");
  const clean = items.filter(
    (i): i is { voiceId: string; bookSlug: string; revision: string } =>
      Boolean(i) && typeof i.voiceId === "string" && typeof i.bookSlug === "string" && typeof i.revision === "string",
  );
  return withFamily(async ({ store, actor }) =>
    NextResponse.json(await checkDownloads(store, actor, { childId, items: clean }), { headers: { "cache-control": "no-store" } }),
  );
}
