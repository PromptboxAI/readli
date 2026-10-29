import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Real sign-in (email link and Google) through Supabase Auth. It is on wherever the public Supabase
 * URL and anon key are set; without them the family preview keeps using its example household.
 */
export function authConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        // Server Components can't set cookies; the middleware refreshes the session for them.
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {}
      },
    },
  });
}

export interface SignedInUser {
  id: string;
  email: string | null;
  name: string;
  /** True when the name is one they gave (at sign-up, from Google, or saved on /family/account), not the stand-in. */
  named?: boolean;
}

type AuthUser = { email?: string | null; user_metadata?: Record<string, unknown> };

/** The name in their sign-in details, if they ever gave one. Saving a name on /family/account writes full_name. */
function givenName(user: AuthUser): string | null {
  const meta = user.user_metadata ?? {};
  for (const key of ["full_name", "name"]) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 60);
  }
  return null;
}

export function displayName(user: AuthUser): string {
  return givenName(user) ?? (user.email?.split("@")[0]?.slice(0, 60) || "Grown-up");
}

/** The signed-in grown-up, verified with Supabase Auth, or null. */
export async function currentUser(): Promise<SignedInUser | null> {
  if (!authConfigured()) return null;
  const { data, error } = await (await supabaseServer()).auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null, name: displayName(data.user), named: givenName(data.user) !== null };
}

/** Only same-site paths may follow sign-in, so a link can't bounce someone to another site. */
export function safeNext(value: string | null | undefined, fallback = "/family"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
