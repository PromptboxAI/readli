import { NextResponse } from "next/server";
import { findCatalogBook } from "@/lib/library/catalog";
import { jsonBody, withFamily } from "@/lib/family/http";
import { setFavorite } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** { bookSlug, on } — each child keeps their own favourites. */
export async function PUT(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { bookSlug, on } = await jsonBody(req);
  if (typeof bookSlug !== "string" || !findCatalogBook(bookSlug) || typeof on !== "boolean") return fail(400, "bad_request", "Pick a story.");
  return withFamily(async ({ store, actor }) => NextResponse.json({ favorites: await setFavorite(store, actor, childId, bookSlug, on) }));
}
