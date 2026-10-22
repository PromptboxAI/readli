import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { narratorsFor } from "@/lib/family/service";
import { bookTexts, kidsReadiness } from "@/lib/narration/narration";

export const dynamic = "force-dynamic";

/**
 * This child's approved narrators for a book, with which sentences each has ready and the text each
 * reads. `?have=` lists the texts the player already holds, so only a new one is sent.
 */
export async function GET(req: Request, { params }: { params: Promise<{ childId: string; slug: string }> }) {
  const { childId, slug } = await params;
  const have = (new URL(req.url).searchParams.get("have") ?? "").split(",").filter(Boolean);
  return withFamily(async ({ store, actor }) => {
    const narrators = await narratorsFor(store, actor, childId);
    const readiness = await kidsReadiness(store, actor, childId, slug);
    const texts = bookTexts(slug, readiness.map((r) => r.revision), store.plan.narrationModelId, have);
    return NextResponse.json({ narrators, readiness, texts }, { headers: { "cache-control": "no-store" } });
  });
}
