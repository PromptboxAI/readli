import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { myVoices } from "@/lib/family/service";

export const dynamic = "force-dynamic";

/** The signed-in adult's own voices and who they are shared with. */
export async function GET() {
  return withFamily(async ({ store, actor }) => NextResponse.json({ voices: await myVoices(store, actor) }));
}
