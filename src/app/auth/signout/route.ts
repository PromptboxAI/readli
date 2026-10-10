import { NextResponse } from "next/server";
import { setSession } from "@/lib/family/session";

export const dynamic = "force-dynamic";

/** Signs the grown-up out on this device, closing any kids profile too. */
export async function POST(req: Request) {
  await setSession(null);
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
