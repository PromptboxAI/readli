import { NextResponse } from "next/server";
import { dismissNewThisWeek } from "@/lib/email/bedtime";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody, withFamily } from "@/lib/family/http";

export const dynamic = "force-dynamic";

/** Closes the "New this week" notice for the signed-in grown-up. */
export async function POST(req: Request) {
  return withFamily(async ({ session }) => {
    const db = accountDb();
    const { weekOf } = await jsonBody(req);
    if (db && session.account && session.actor.kind === "adult" && !session.device && typeof weekOf === "string") await dismissNewThisWeek(db, session.account.id, weekOf);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  });
}
