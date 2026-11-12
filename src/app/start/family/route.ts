import { NextResponse } from "next/server";
import { currentAdult } from "@/lib/auth/adult";
import { cleanFamilyName, FAMILY_NAME_COOKIE, familyNameCookie, startHref } from "@/lib/onboarding/start";

export const dynamic = "force-dynamic";

/**
 * The welcome's family name, from a plain form post. It's kept in a cookie until the family is started at
 * checkout, so someone who stays on free Readli Voice never ends up running an empty family.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const user = await currentAdult().catch(() => null);
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(startHref("family"))}`, req.url), 303);
  const name = cleanFamilyName(form?.get("name"));
  if (!name) return NextResponse.redirect(new URL(`${startHref("family")}&error=name`, req.url), 303);
  const res = NextResponse.redirect(new URL(startHref("voice"), req.url), 303);
  res.cookies.set(FAMILY_NAME_COOKIE, familyNameCookie(user.id, name), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: new URL(req.url).protocol === "https:",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
