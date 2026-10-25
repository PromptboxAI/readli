import { NextResponse } from "next/server";
import { findCatalogBook } from "@/lib/library/catalog";
import { revisionInfo } from "@/lib/library/revisions";
import { jsonBody, withFamily } from "@/lib/family/http";
import { heardAt } from "@/lib/family/places";
import { guardianHousehold, saveAdultProgress } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Saves a grown-up's own place in a book in the Parent Portal player: { sentence, voiceId, textRevision?,
 * listenedAt?, sentAt? }. Kept apart from every child's place; the place heard last wins, as for children.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await jsonBody(req);
  const { sentence, voiceId, textRevision } = body;
  if (!findCatalogBook(slug) || !Number.isInteger(sentence) || (sentence as number) < 0 || (voiceId !== null && typeof voiceId !== "string")) {
    return fail(400, "bad_request", "That page doesn't exist.");
  }
  const revision = typeof textRevision === "string" && revisionInfo(slug, textRevision) ? textRevision : null;
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can listen here.");
    const saved = await saveAdultProgress(store, actor, {
      householdId,
      bookSlug: slug,
      sentence: sentence as number,
      voiceId: voiceId as string | null,
      textRevision: revision,
      listenedAt: heardAt(body, new Date()),
    });
    return NextResponse.json({ ok: true, saved });
  });
}
