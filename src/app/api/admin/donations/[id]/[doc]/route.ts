import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin/access";
import { documentUrl } from "@/lib/donations/server";
import { accountDb } from "@/lib/family/account-store";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** An applicant's uploaded flyer or reply document, through a two-minute signed link. Admins only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; doc: string }> }) {
  const { id, doc } = await params;
  const admin = await currentAdmin();
  const db = accountDb();
  if (!admin || !db || (doc !== "flyer" && doc !== "reply")) return fail(404, "not_found", "Not found.");
  const url = await documentUrl(db, id, doc);
  if (!url) return fail(404, "not_found", "No document was attached.");
  return NextResponse.redirect(url, { headers: { "cache-control": "private, no-store" } });
}
