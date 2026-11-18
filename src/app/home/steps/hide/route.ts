import { NextResponse } from "next/server";
import { currentAdult } from "@/lib/auth/adult";
import { accountDb } from "@/lib/family/account-store";
import { markVoiceHome } from "@/lib/voice/home-progress";

export const dynamic = "force-dynamic";

/** "Hide this list" on a free account's Home: the getting-started steps stay hidden for this account. */
export async function POST(req: Request) {
  const user = await currentAdult().catch(() => null);
  if (user) await markVoiceHome(accountDb(), user.id, "hidden");
  return NextResponse.redirect(new URL("/home", req.url), 303);
}
