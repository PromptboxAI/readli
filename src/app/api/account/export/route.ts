import { NextResponse } from "next/server";
import { exportAccountData } from "@/lib/account/privacy";
import { withAccount } from "@/lib/account/server";

export const dynamic = "force-dynamic";

/** Downloads a copy of the signed-in grown-up's data as a JSON file. */
export async function GET() {
  return withAccount(async ({ db, user }) => {
    const data = await exportAccountData(db, user);
    const day = data.exportedAt.slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="readli-my-data-${day}.json"`,
        "cache-control": "no-store",
      },
    });
  });
}
