import { currentAdmin } from "@/lib/admin/access";
import { download } from "@/lib/admin/complimentary-http";
import { listRequests, requestsCsv } from "@/lib/donations/server";
import { accountDb } from "@/lib/family/account-store";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Every donation request as CSV, for spreadsheets and reporting. Admins only. */
export async function GET() {
  const admin = await currentAdmin();
  const db = accountDb();
  if (!admin || !db) return fail(404, "not_found", "Not found.");
  const rows = await listRequests(db, "all");
  return download(requestsCsv(rows), `readli-gives-back-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv; charset=utf-8");
}
