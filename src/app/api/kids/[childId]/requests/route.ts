import { NextResponse } from "next/server";
import { findCatalogBook } from "@/lib/library/catalog";
import { jsonBody, withFamily } from "@/lib/family/http";
import { childRequests, requestStory } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** The books this child has asked a grown-up for. */
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  return withFamily(async ({ store, actor }) => NextResponse.json({ requested: await childRequests(store, actor, childId) }));
}

/** { bookSlug }: ask a grown-up for a book. It never prepares anything or spends credits. */
export async function POST(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { bookSlug } = await jsonBody(req);
  if (typeof bookSlug !== "string" || !findCatalogBook(bookSlug)) return fail(400, "bad_request", "Pick a story.");
  return withFamily(async ({ store, actor }) => NextResponse.json({ requested: await requestStory(store, actor, childId, bookSlug) }));
}
