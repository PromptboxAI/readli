import { NextResponse } from "next/server";
import { currentSession, setSession } from "@/lib/family/session";

export const dynamic = "force-dynamic";

/**
 * Signs the grown-up out on this device, closing any kids profile too, and returns to the homepage.
 * A browser in Kids Mode stays there: only a grown-up's sign-in or the family PIN ends it.
 */
export async function POST(req: Request) {
  const session = await currentSession();
  if (session?.device || (session?.temporary && session.account)) return NextResponse.redirect(new URL("/kids", req.url), { status: 303 });
  await setSession(null);
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
