import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { narratorsFor } from "@/lib/family/service";
import { kidsReadiness } from "@/lib/narration/narration";

export const dynamic = "force-dynamic";

/** This child's approved narrators for a book, with which sentences each has ready. */
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string; slug: string }> }) {
  const { childId, slug } = await params;
  return withFamily(async ({ store, actor }) => {
    const narrators = await narratorsFor(store, actor, childId);
    const readiness = await kidsReadiness(store, actor, childId, slug);
    return NextResponse.json({ narrators, readiness }, { headers: { "cache-control": "no-store" } });
  });
}
