import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdmin, isAdminPath } from "@/lib/admin/emails";
import { KIDS_COOKIE, kidsModeRoute } from "@/lib/family/kids-mode";

/** Pages and routes that use the Supabase sign-in, so it's kept fresh there. */
const SIGN_IN_PATHS = ["/family", "/kids", "/login", "/auth", "/api/family", "/api/kids", "/billing", "/admin", "/api/admin", "/api/account", "/api/people"];

/**
 * Keeps a device in Kids Mode on the child's side (the server checks again on every grown-up route),
 * keeps the Supabase sign-in fresh on the pages that use it, and keeps /admin to named admins.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (request.cookies.get(KIDS_COOKIE)?.value) {
    const verdict = kidsModeRoute(path);
    if (verdict === "deny") {
      return NextResponse.json({ error: { code: "kids_mode", message: "This isn't available in Readli Kids. Ask a grown-up." } }, { status: 403 });
    }
    if (verdict === "to_kids") return NextResponse.redirect(new URL("/kids", request.url));
  }
  if (!SIGN_IN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return NextResponse.next();

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
  // Every page and route except build assets and static files, so Kids Mode is enforced everywhere.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico|woff2|mp3|webm)$).*)"],
};
