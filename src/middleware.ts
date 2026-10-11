import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdmin, isAdminPath } from "@/lib/admin/emails";

/** Keeps the Supabase sign-in fresh on the pages that use it, and keeps /admin to named admins. */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (isAdminPath(path) && !isAdmin(data.user)) {
    const api = path.startsWith("/api/");
    let denied: NextResponse;
    if (api) denied = NextResponse.json({ error: { code: data.user ? "not_found" : "sign_in_required" } }, { status: data.user ? 404 : 401 });
    else if (!data.user) denied = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, request.url));
    // Anyone signed in but not an admin sees the ordinary "not found" page, so /admin isn't advertised.
    else denied = NextResponse.rewrite(new URL("/__readli-not-found", request.url));
    for (const c of response.cookies.getAll()) denied.cookies.set(c);
    return denied;
  }
  return response;
}

export const config = {
  matcher: [
    "/family/:path*",
    "/kids/:path*",
    "/login",
    "/auth/:path*",
    "/api/family/:path*",
    "/api/kids/:path*",
    "/billing/:path*",
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/account/:path*",
  ],
};
